'use client';

import React, { useState, useTransition, useEffect } from 'react';
import Link from 'next/link';
import {
  createVenueAction,
} from '@/server/actions/venues';
import {
  createEventAction,
  toggleEventStatusAction,
  updateActiveTablesAction,
} from '@/server/actions/events';
import type { Venue, Event } from '@/types/database';
import {
  Building2,
  CalendarDays,
  FileDown,
  Tv,
  Plus,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Sliders,
  Sparkles,
  Loader2,
  Power,
  Layers,
  Clock,
  ShieldCheck,
  LogOut,
  Palette,
  Download,
  X,
  Printer,
  RotateCcw,
  Check,
} from 'lucide-react';
import { logoutAdminAction } from '@/server/actions/auth';

export const QR_DESIGN_PRESETS = [
  {
    id: 'neon',
    name: 'Violeta Neón',
    bg: '#ffffff',
    accent: '#7c3aed',
    text: '#18181b',
    badgeText: '#ffffff',
    subtext: '#52525b',
    dotColor: '#7c3aed',
  },
  {
    id: 'gala',
    name: 'Noche de Gala',
    bg: '#09090b',
    accent: '#d97706',
    text: '#f4f4f5',
    badgeText: '#000000',
    subtext: '#a1a1aa',
    dotColor: '#d97706',
  },
  {
    id: 'wedding',
    name: 'Boda Elegante',
    bg: '#faf7f2',
    accent: '#b45309',
    text: '#27272a',
    badgeText: '#ffffff',
    subtext: '#71717a',
    dotColor: '#b45309',
  },
  {
    id: 'rose',
    name: 'Rose & Pink',
    bg: '#fff5f7',
    accent: '#e11d48',
    text: '#18181b',
    badgeText: '#ffffff',
    subtext: '#71717a',
    dotColor: '#e11d48',
  },
  {
    id: 'sapphire',
    name: 'Azul Zafiro',
    bg: '#0a1128',
    accent: '#2563eb',
    text: '#f8fafc',
    badgeText: '#ffffff',
    subtext: '#94a3b8',
    dotColor: '#2563eb',
  },
  {
    id: 'minimal',
    name: 'B&W Minimal',
    bg: '#ffffff',
    accent: '#18181b',
    text: '#18181b',
    badgeText: '#ffffff',
    subtext: '#52525b',
    dotColor: '#18181b',
  },
  {
    id: 'emerald',
    name: 'Verde Esmeralda',
    bg: '#042219',
    accent: '#059669',
    text: '#f0fdf4',
    badgeText: '#ffffff',
    subtext: '#86efac',
    dotColor: '#059669',
  },
];

interface VenueWithStats extends Venue {
  totalTables: number;
}

interface EventWithVenueData extends Event {
  venue: {
    id: string;
    name: string;
    slug: string;
  };
  photosCount?: number;
}

interface AdminDashboardClientProps {
  venues: VenueWithStats[];
  events: EventWithVenueData[];
}

export default function AdminDashboardClient({
  venues: initialVenues,
  events: initialEvents,
}: AdminDashboardClientProps) {
  const [venues, setVenues] = useState<VenueWithStats[]>(initialVenues);
  const [events, setEvents] = useState<EventWithVenueData[]>(initialEvents);
  const [activeTab, setActiveTab] = useState<'events' | 'venues'>('events');

  const [isPending, startTransition] = useTransition();
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form State: New Venue
  const [showVenueModal, setShowVenueModal] = useState<boolean>(false);
  const [venueName, setVenueName] = useState<string>('');
  const [venueSlug, setVenueSlug] = useState<string>('');
  const [venueTables, setVenueTables] = useState<number>(30);

  // Form State: New Event
  const [showEventModal, setShowEventModal] = useState<boolean>(false);
  const [selectedVenueId, setSelectedVenueId] = useState<string>(initialVenues[0]?.id || '');
  const [eventTitle, setEventTitle] = useState<string>('');
  const [eventStartTime, setEventStartTime] = useState<string>('');
  const [eventEndTime, setEventEndTime] = useState<string>('');
  const [activeTablesCount, setActiveTablesCount] = useState<number>(20);
  const [eventIsActive, setEventIsActive] = useState<boolean>(true);
  const [eventModerationMode, setEventModerationMode] = useState<'auto_approve' | 'strict'>('auto_approve');

  // QR Customizer Modal State
  const [customizingVenue, setCustomizingVenue] = useState<VenueWithStats | null>(null);
  const [customFormat, setCustomFormat] = useState<'a4' | 'tent' | 'mini' | 'grid4'>('a4');
  const [customBgColor, setCustomBgColor] = useState<string>('#ffffff');
  const [customAccentColor, setCustomAccentColor] = useState<string>('#7c3aed');
  const [customTextColor, setCustomTextColor] = useState<string>('#18181b');
  const [customBadgeTextColor, setCustomBadgeTextColor] = useState<string>('#ffffff');
  const [customSubtextColor, setCustomSubtextColor] = useState<string>('#52525b');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('neon');

  const handleOpenCustomizer = (
    venue: VenueWithStats,
    format: 'a4' | 'tent' | 'mini' | 'grid4' = 'a4'
  ) => {
    setCustomizingVenue(venue);
    setCustomFormat(format);
  };

  const handleApplyPreset = (preset: (typeof QR_DESIGN_PRESETS)[0]) => {
    setSelectedPresetId(preset.id);
    setCustomBgColor(preset.bg);
    setCustomAccentColor(preset.accent);
    setCustomTextColor(preset.text);
    setCustomBadgeTextColor(preset.badgeText);
    setCustomSubtextColor(preset.subtext);
  };

  const getPdfDownloadUrl = () => {
    if (!customizingVenue) return '#';
    const params = new URLSearchParams({
      format: customFormat,
      bg: customBgColor,
      accent: customAccentColor,
      text: customTextColor,
      badgeText: customBadgeTextColor,
      subtext: customSubtextColor,
    });
    return `/admin/venues/${customizingVenue.id}/pdf?${params.toString()}`;
  };

  // Keep selectedVenueId in sync whenever venues changes
  useEffect(() => {
    if ((!selectedVenueId || !venues.some((v) => v.id === selectedVenueId)) && venues.length > 0) {
      setSelectedVenueId(venues[0].id);
    }
  }, [venues, selectedVenueId]);

  // Toggle Event Status
  const handleToggleEventStatus = (eventId: string, currentStatus: boolean) => {
    startTransition(async () => {
      const newStatus = !currentStatus;
      // Optimistic update
      setEvents((prev) =>
        prev.map((ev) => (ev.id === eventId ? { ...ev, is_active: newStatus } : ev))
      );

      const res = await toggleEventStatusAction({
        eventId,
        isActive: newStatus,
      });

      if (!res.success) {
        // Rollback
        setEvents((prev) =>
          prev.map((ev) => (ev.id === eventId ? { ...ev, is_active: currentStatus } : ev))
        );
        setNotification({ type: 'error', message: res.error || 'Error al cambiar estado' });
      } else {
        setNotification({
          type: 'success',
          message: `Evento ${newStatus ? 'activado' : 'desactivado'} con éxito`,
        });
      }
    });
  };

  // Update Active Tables
  const handleUpdateActiveTables = (eventId: string, newCount: number) => {
    startTransition(async () => {
      setEvents((prev) =>
        prev.map((ev) => (ev.id === eventId ? { ...ev, active_tables_count: newCount } : ev))
      );

      const res = await updateActiveTablesAction({
        eventId,
        activeTablesCount: newCount,
      });

      if (!res.success) {
        setNotification({ type: 'error', message: res.error || 'Error al actualizar mesas' });
      } else {
        setNotification({ type: 'success', message: 'Mesas activas actualizadas' });
      }
    });
  };

  // Submit New Venue
  const handleCreateVenue = async (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createVenueAction({
        name: venueName,
        slug: venueSlug,
        totalTables: Number(venueTables),
      });

      if (!res.success || !res.data) {
        setNotification({ type: 'error', message: res.error || 'Error al crear salón' });
      } else {
        const newVenueId = res.data!.venueId;
        setNotification({
          type: 'success',
          message: `Salón "${venueName}" creado con ${venueTables} mesas y QRs generados`,
        });
        setVenues((prev) => [
          ...prev,
          {
            id: newVenueId,
            name: venueName,
            slug: res.data!.slug,
            totalTables: res.data!.totalTables,
            created_at: new Date().toISOString(),
          },
        ]);
        setSelectedVenueId(newVenueId);
        setVenueName('');
        setVenueSlug('');
        setShowVenueModal(false);
      }
    });
  };

  // Submit New Event
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const targetVenueId = selectedVenueId || venues[0]?.id;
      if (!targetVenueId) {
        setNotification({ type: 'error', message: 'Primero debés seleccionar o crear un salón' });
        return;
      }

      if (!eventStartTime || !eventEndTime) {
        setNotification({ type: 'error', message: 'Completá las fechas de inicio y fin' });
        return;
      }

      const res = await createEventAction({
        venueId: targetVenueId,
        title: eventTitle,
        startTime: new Date(eventStartTime).toISOString(),
        endTime: new Date(eventEndTime).toISOString(),
        activeTablesCount: Number(activeTablesCount),
        isActive: eventIsActive,
        moderationMode: eventModerationMode,
      });

      if (!res.success || !res.data) {
        setNotification({ type: 'error', message: res.error || 'Error al programar fiesta' });
      } else {
        const venue = venues.find((v) => v.id === targetVenueId);
        setNotification({
          type: 'success',
          message: `Fiesta "${eventTitle}" creada exitosamente`,
        });
        setEvents((prev) => [
          {
            ...res.data!,
            venue: {
              id: venue?.id || targetVenueId,
              name: venue?.name || 'Salón',
              slug: venue?.slug || 'salon',
            },
            photosCount: 0,
          },
          ...prev,
        ]);
        setEventTitle('');
        setShowEventModal(false);
      }
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-300 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-brand-400" />
            <span>Panel de Administración Central</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            QR Imágenes Dinámicas SaaS
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Gestión remota de salones, activación de fiestas y exportación de kits de QRs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowVenueModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-sm border border-zinc-700 transition-all"
          >
            <Building2 className="w-4 h-4 text-brand-400" />
            <span>Nuevo Salón</span>
          </button>

          <button
            onClick={() => setShowEventModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-purple-600 hover:from-brand-500 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-brand-900/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Crear Fiesta</span>
          </button>

          <button
            onClick={() => logoutAdminAction()}
            title="Cerrar sesión de administrador"
            className="p-2.5 rounded-xl bg-zinc-900 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 border border-zinc-800 hover:border-red-500/30 transition-all"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`mb-6 p-4 rounded-xl flex items-center justify-between text-sm animate-fade-in ${
            notification.type === 'success'
              ? 'bg-emerald-950/50 border border-emerald-500/40 text-emerald-200'
              : 'bg-red-950/50 border border-red-500/40 text-red-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notification.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-xs opacity-75 hover:opacity-100"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="glass-card rounded-2xl p-5 border-zinc-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Salones Registrados
            </span>
            <Building2 className="w-4 h-4 text-brand-400" />
          </div>
          <p className="text-3xl font-black text-white mt-2">{venues.length}</p>
          <p className="text-xs text-zinc-500 mt-1">Con kit de QRs permanentes</p>
        </div>

        <div className="glass-card rounded-2xl p-5 border-zinc-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Fiestas Activas Hoy
            </span>
            <Power className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-3xl font-black text-white mt-2">
            {events.filter((e) => e.is_active).length}
          </p>
          <p className="text-xs text-zinc-500 mt-1">Recibiendo fotos en tiempo real</p>
        </div>

        <div className="glass-card rounded-2xl p-5 border-zinc-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Total Fiestas Programadas
            </span>
            <CalendarDays className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-3xl font-black text-white mt-2">{events.length}</p>
          <p className="text-xs text-zinc-500 mt-1">Histórico y próximas fechas</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 mb-6 pb-2">
        <button
          onClick={() => setActiveTab('events')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'events'
              ? 'bg-brand-600 text-white shadow-md'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          <span>Fiestas y Eventos ({events.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('venues')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'venues'
              ? 'bg-brand-600 text-white shadow-md'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Salones y PDFs Master ({venues.length})</span>
        </button>
      </div>

      {/* Tab: Events List */}
      {activeTab === 'events' && (
        <div className="space-y-4">
          {events.length === 0 ? (
            <div className="glass-panel rounded-2xl p-8 text-center border-zinc-800">
              <CalendarDays className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-white mb-1">No hay fiestas programadas</h3>
              <p className="text-sm text-zinc-400 mb-4">
                Crea una fiesta vinculada a un salón para habilitar la recepción de fotos.
              </p>
              <button
                onClick={() => setShowEventModal(true)}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-bold"
              >
                Crear Primera Fiesta
              </button>
            </div>
          ) : (
            events.map((event) => {
              const startDate = new Date(event.start_time).toLocaleString('es-AR', {
                dateStyle: 'short',
                timeStyle: 'short',
              });
              const endDate = new Date(event.end_time).toLocaleTimeString('es-AR', {
                timeStyle: 'short',
              });

              return (
                <div
                  key={event.id}
                  className="glass-panel rounded-2xl p-5 border-zinc-800 hover:border-zinc-700 transition-all"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    {/* Left: Info */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span className="px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-semibold text-xs border border-zinc-700">
                          {event.venue?.name || 'Salón'}
                        </span>

                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            event.is_active
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              event.is_active ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'
                            }`}
                          />
                          {event.is_active ? 'ACTIVO' : 'INACTIVO'}
                        </span>
                      </div>

                      <h3 className="text-xl font-bold text-white tracking-tight">{event.title}</h3>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-zinc-500" />
                          {startDate} a {endDate}
                        </span>
                        <span className="flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5 text-brand-400" />
                          Mesas activas: {event.active_tables_count}
                        </span>
                      </div>
                    </div>

                    {/* Right: Controls & Actions */}
                    <div className="flex flex-wrap items-center gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-zinc-800/80">
                      {/* Active Tables Stepper */}
                      <div className="flex items-center gap-1.5 glass-card px-2.5 py-1.5 rounded-xl border-zinc-700">
                        <Sliders className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="text-xs text-zinc-400">Mesas:</span>
                        <input
                          type="number"
                          min={1}
                          max={500}
                          value={event.active_tables_count}
                          onChange={(e) =>
                            handleUpdateActiveTables(event.id, parseInt(e.target.value, 10) || 1)
                          }
                          className="w-14 bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5 text-xs text-white text-center font-bold focus:outline-none focus:border-brand-500"
                        />
                      </div>

                      {/* Manual Activation Switch */}
                      <button
                        onClick={() => handleToggleEventStatus(event.id, event.is_active)}
                        disabled={isPending}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          event.is_active
                            ? 'bg-emerald-600/30 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-600/50'
                            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border border-zinc-700'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span>{event.is_active ? 'Desactivar' : 'Activar'}</span>
                      </button>

                      {/* Moderation Portal Button */}
                      <Link
                        href={`/admin/events/${event.id}/moderate`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold transition-all"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Moderar</span>
                      </Link>

                      {/* Projector Live Wall Link */}
                      <Link
                        href={`/live/${event.id}`}
                        target="_blank"
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/40 text-purple-300 text-xs font-bold transition-all"
                      >
                        <Tv className="w-3.5 h-3.5" />
                        <span>Live Wall</span>
                        <ExternalLink className="w-3 h-3 ml-0.5 opacity-60" />
                      </Link>

                      {/* Digital Album Link */}
                      <Link
                        href={`/gallery/${event.id}`}
                        target="_blank"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold border border-zinc-700 transition-all"
                      >
                        <span>Álbum</span>
                        <ExternalLink className="w-3 h-3 ml-0.5 opacity-60" />
                      </Link>

                      {/* Guest Upload Simulation */}
                      <Link
                        href={`/app/${event.id}?table=1`}
                        target="_blank"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold border border-zinc-700 transition-all"
                      >
                        <span>Simular Mesa 1</span>
                        <ExternalLink className="w-3 h-3 ml-0.5 opacity-60" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab: Venues & Master PDF */}
      {activeTab === 'venues' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {venues.map((venue) => (
            <div
              key={venue.id}
              className="glass-panel rounded-2xl p-5 border-zinc-800 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 text-xs font-mono">
                    /{venue.slug}
                  </span>
                  <span className="text-xs text-brand-400 font-bold">
                    {venue.totalTables || 30} Mesas Físicas
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white mb-1">{venue.name}</h3>
                <p className="text-xs text-zinc-400">
                  Kit de códigos QR permanente generado. Listo para imprimir en PDF Master de alta resolución.
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-zinc-800/80 space-y-2.5">
                <button
                  onClick={() => handleOpenCustomizer(venue, 'a4')}
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-brand-600 via-purple-600 to-brand-500 hover:from-brand-500 hover:to-purple-400 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-brand-900/40 transition-all cursor-pointer group"
                >
                  <Palette className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                  <span>Personalizar y Exportar QRs</span>
                </button>

                <div className="flex items-center justify-between text-[11px] text-zinc-400 px-0.5">
                  <span>Formatos de imprenta:</span>
                  <span className="text-[10px] text-emerald-400 font-semibold">4 formatos</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <button
                    onClick={() => handleOpenCustomizer(venue, 'a4')}
                    className="py-1.5 px-1.5 rounded-lg bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 text-center text-[11px] font-semibold border border-zinc-700 transition-all cursor-pointer"
                  >
                    Estándar A4
                  </button>
                  <button
                    onClick={() => handleOpenCustomizer(venue, 'tent')}
                    className="py-1.5 px-1.5 rounded-lg bg-brand-600/20 hover:bg-brand-600/40 text-brand-300 text-center text-[11px] font-semibold border border-brand-500/40 transition-all cursor-pointer"
                  >
                    Carpa Mesa
                  </button>
                  <button
                    onClick={() => handleOpenCustomizer(venue, 'mini')}
                    className="py-1.5 px-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-center text-[11px] font-semibold border border-amber-500/30 transition-all cursor-pointer"
                  >
                    Mini 10x15
                  </button>
                  <button
                    onClick={() => handleOpenCustomizer(venue, 'grid4')}
                    className="py-1.5 px-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-center text-[11px] font-semibold border border-emerald-500/30 transition-all cursor-pointer"
                  >
                    4 por Hoja
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: New Venue */}
      {showVenueModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel rounded-2xl max-w-md w-full p-6 border-zinc-700 shadow-2xl animate-fade-in">
            <h2 className="text-xl font-bold text-white mb-1">Registrar Nuevo Salón</h2>
            <p className="text-xs text-zinc-400 mb-4">
              Se creará el salón y se generarán automáticamente los QRs permanentes para cada mesa.
            </p>

            <form onSubmit={handleCreateVenue} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Nombre del Salón
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Salón Jardines de Olivos"
                  value={venueName}
                  onChange={(e) => {
                    setVenueName(e.target.value);
                    if (!venueSlug) {
                      setVenueSlug(
                        e.target.value
                          .toLowerCase()
                          .replace(/\s+/g, '-')
                          .replace(/[^a-z0-9-]/g, '')
                      );
                    }
                  }}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Slug Identificador
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. jardines-olivos"
                  value={venueSlug}
                  onChange={(e) => setVenueSlug(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Cantidad Total de Mesas Físicas Base
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={500}
                  value={venueTables}
                  onChange={(e) => setVenueTables(parseInt(e.target.value, 10) || 30)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                />
                <span className="text-[11px] text-zinc-500 mt-1 block">
                  Se generarán {venueTables} páginas con QRs únicos y permanentes en el PDF Master.
                </span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowVenueModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-semibold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-purple-600 hover:from-brand-500 hover:to-purple-500 text-white text-sm font-bold shadow-lg flex items-center justify-center gap-2"
                >
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Generar Kit Salón'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Event */}
      {showEventModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel rounded-2xl max-w-lg w-full p-6 border-zinc-700 shadow-2xl animate-fade-in">
            <h2 className="text-xl font-bold text-white mb-1">Programar Nueva Fiesta</h2>
            <p className="text-xs text-zinc-400 mb-4">
              Configura los detalles de la fiesta para activar la recepción remota de fotos.
            </p>

            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Salón</label>
                <select
                  value={selectedVenueId || venues[0]?.id || ''}
                  onChange={(e) => setSelectedVenueId(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                >
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.totalTables || 30} mesas disponibles)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Título del Evento
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Boda Juan y Ana / Gala Aniversario"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">
                    Inicio de Fiesta
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={eventStartTime}
                    onChange={(e) => setEventStartTime(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">
                    Fin de Fiesta
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={eventEndTime}
                    onChange={(e) => setEventEndTime(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">
                    Mesas Activas Esta Noche
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={activeTablesCount}
                    onChange={(e) => setActiveTablesCount(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">
                    Modo de Moderación
                  </label>
                  <select
                    value={eventModerationMode}
                    onChange={(e) =>
                      setEventModerationMode(e.target.value as 'auto_approve' | 'strict')
                    }
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="auto_approve">Auto-Aprobación (Pase Libre)</option>
                    <option value="strict">Estricto (Aprobación Previa)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer pb-2">
                  <input
                    type="checkbox"
                    checked={eventIsActive}
                    onChange={(e) => setEventIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 bg-zinc-900 border-zinc-700"
                  />
                  <span className="text-xs text-zinc-300 font-semibold">
                    Activar inmediatamente
                  </span>
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEventModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-semibold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-purple-600 hover:from-brand-500 hover:to-purple-500 text-white text-sm font-bold shadow-lg flex items-center justify-center gap-2"
                >
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Programar Fiesta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal: QR Design Customizer & Master PDF Export */}
      {customizingVenue && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="glass-panel rounded-3xl max-w-4xl w-full p-5 sm:p-7 border-zinc-700 shadow-2xl animate-fade-in my-auto max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-500/15 border border-brand-500/30 text-brand-400 flex items-center justify-center shadow-inner">
                  <Palette className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                    <span>Personalizar Diseño de QRs para Imprenta</span>
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Salón: <span className="text-white font-semibold">{customizingVenue.name}</span> • {customizingVenue.totalTables || 30} mesas permanentes
                  </p>
                </div>
              </div>

              <button
                onClick={() => setCustomizingVenue(null)}
                className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: 2 Columns (Controls & Live Preview) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 py-5 overflow-y-auto pr-1">
              {/* Left Column: Controls (7 cols) */}
              <div className="lg:col-span-7 space-y-5">
                {/* 1. Format Selector */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                    1. Formato de Impresión
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => setCustomFormat('a4')}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        customFormat === 'a4'
                          ? 'bg-brand-600/20 border-brand-500 text-white shadow-md shadow-brand-500/10'
                          : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                      }`}
                    >
                      <div className="text-xs font-bold text-white">Estándar A4</div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">1 mesa por hoja</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCustomFormat('tent')}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        customFormat === 'tent'
                          ? 'bg-brand-600/20 border-brand-500 text-white shadow-md shadow-brand-500/10'
                          : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                      }`}
                    >
                      <div className="text-xs font-bold text-white">Carpa Mesa</div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">2 caras plegables</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCustomFormat('mini')}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        customFormat === 'mini'
                          ? 'bg-brand-600/20 border-brand-500 text-white shadow-md shadow-brand-500/10'
                          : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                      }`}
                    >
                      <div className="text-xs font-bold text-white">Mini 10x15</div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">Para acrílicos</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCustomFormat('grid4')}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        customFormat === 'grid4'
                          ? 'bg-emerald-600/20 border-emerald-500 text-white shadow-md shadow-emerald-500/10'
                          : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold text-white">4 por Hoja</div>
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1 py-0.5 rounded font-semibold border border-emerald-500/30">
                          -75%
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">2x2 A4 con cortes</div>
                    </button>
                  </div>
                </div>

                {/* 2. Presets Rápidos */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                      2. Paletas de Fiesta (Presets 1-Click)
                    </label>
                    <span className="text-[10px] text-zinc-500">Hacé clic para aplicar</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {QR_DESIGN_PRESETS.map((preset) => {
                      const isSelected = selectedPresetId === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleApplyPreset(preset)}
                          className={`flex items-center gap-2 p-2 rounded-xl border transition-all text-left cursor-pointer ${
                            isSelected
                              ? 'bg-zinc-800 border-brand-500 text-white ring-1 ring-brand-500/50'
                              : 'bg-zinc-900/70 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                          }`}
                        >
                          <div
                            className="w-4 h-4 rounded-full border border-black/20 flex-shrink-0 shadow-sm"
                            style={{ backgroundColor: preset.accent }}
                          />
                          <span className="text-xs font-medium truncate">{preset.name}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-brand-400 ml-auto flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Color Customizers */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                    3. Ajuste Fino de Colores
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-zinc-900/60 p-3.5 rounded-2xl border border-zinc-800">
                    {/* Fondo */}
                    <div>
                      <span className="block text-[11px] font-semibold text-zinc-300 mb-1">
                        Fondo de Tarjeta
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={customBgColor}
                          onChange={(e) => {
                            setCustomBgColor(e.target.value);
                            setSelectedPresetId('custom');
                          }}
                          className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                        />
                        <input
                          type="text"
                          value={customBgColor}
                          onChange={(e) => {
                            setCustomBgColor(e.target.value);
                            setSelectedPresetId('custom');
                          }}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-white font-mono uppercase focus:outline-none focus:border-brand-500"
                        />
                      </div>
                    </div>

                    {/* Acento (Líneas y Badge) */}
                    <div>
                      <span className="block text-[11px] font-semibold text-zinc-300 mb-1">
                        Líneas y Badge
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={customAccentColor}
                          onChange={(e) => {
                            setCustomAccentColor(e.target.value);
                            setSelectedPresetId('custom');
                          }}
                          className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                        />
                        <input
                          type="text"
                          value={customAccentColor}
                          onChange={(e) => {
                            setCustomAccentColor(e.target.value);
                            setSelectedPresetId('custom');
                          }}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-white font-mono uppercase focus:outline-none focus:border-brand-500"
                        />
                      </div>
                    </div>

                    {/* Texto del Badge */}
                    <div>
                      <span className="block text-[11px] font-semibold text-zinc-300 mb-1">
                        Texto de "MESA #X"
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={customBadgeTextColor}
                          onChange={(e) => {
                            setCustomBadgeTextColor(e.target.value);
                            setSelectedPresetId('custom');
                          }}
                          className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                        />
                        <input
                          type="text"
                          value={customBadgeTextColor}
                          onChange={(e) => {
                            setCustomBadgeTextColor(e.target.value);
                            setSelectedPresetId('custom');
                          }}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-white font-mono uppercase focus:outline-none focus:border-brand-500"
                        />
                      </div>
                    </div>

                    {/* Texto Principal */}
                    <div>
                      <span className="block text-[11px] font-semibold text-zinc-300 mb-1">
                        Texto de Títulos
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={customTextColor}
                          onChange={(e) => {
                            setCustomTextColor(e.target.value);
                            setSelectedPresetId('custom');
                          }}
                          className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                        />
                        <input
                          type="text"
                          value={customTextColor}
                          onChange={(e) => {
                            setCustomTextColor(e.target.value);
                            setSelectedPresetId('custom');
                          }}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-white font-mono uppercase focus:outline-none focus:border-brand-500"
                        />
                      </div>
                    </div>

                    {/* Subtexto e Instrucciones */}
                    <div className="sm:col-span-2">
                      <span className="block text-[11px] font-semibold text-zinc-300 mb-1">
                        Subtexto e Instrucciones
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={customSubtextColor}
                          onChange={(e) => {
                            setCustomSubtextColor(e.target.value);
                            setSelectedPresetId('custom');
                          }}
                          className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                        />
                        <input
                          type="text"
                          value={customSubtextColor}
                          onChange={(e) => {
                            setCustomSubtextColor(e.target.value);
                            setSelectedPresetId('custom');
                          }}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-white font-mono uppercase focus:outline-none focus:border-brand-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Live Interactive Preview (5 cols) */}
              <div className="lg:col-span-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                      Vista Previa en Vivo {customFormat === 'grid4' ? '(Hoja A4 - 4 Mesas)' : '(Mesa #1)'}
                    </span>
                    <span className="text-[10px] text-brand-400 font-semibold bg-brand-500/10 px-2 py-0.5 rounded-full border border-brand-500/20">
                      {customFormat === 'a4'
                        ? 'A4 Vertical'
                        : customFormat === 'tent'
                        ? 'Carpa Plegable'
                        : customFormat === 'mini'
                        ? 'Mini 10x15'
                        : '4 por Hoja (A6)'}
                    </span>
                  </div>

                  {/* Card Simulation */}
                  {customFormat === 'grid4' ? (
                    /* 2x2 Grid Preview for 4 per sheet */
                    <div
                      className="rounded-2xl p-2.5 transition-all duration-300 shadow-xl border relative overflow-hidden select-none bg-zinc-950"
                      style={{ borderColor: customAccentColor }}
                    >
                      <div className="grid grid-cols-2 gap-2 relative">
                        {/* Dashed cut lines indicator */}
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                          <div className="w-full border-t border-dashed border-zinc-500/60" />
                        </div>
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                          <div className="h-full border-l border-dashed border-zinc-500/60" />
                        </div>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-zinc-900/90 px-1.5 py-0.5 rounded text-[8px] text-zinc-400 font-mono border border-zinc-700 pointer-events-none z-20">
                          ✂ CORTE
                        </div>

                        {[1, 2, 3, 4].map((num) => (
                          <div
                            key={num}
                            className="rounded-xl p-2 flex flex-col items-center justify-between text-center relative border"
                            style={{
                              backgroundColor: customBgColor,
                              borderColor: customAccentColor,
                              minHeight: '160px',
                            }}
                          >
                            <div
                              className="text-[8px] font-bold uppercase tracking-tight truncate w-full"
                              style={{ color: customSubtextColor }}
                            >
                              {customizingVenue.name}
                            </div>
                            <div
                              className="px-2 py-0.5 rounded-full text-[9px] font-black tracking-wide my-1"
                              style={{
                                backgroundColor: customAccentColor,
                                color: customBadgeTextColor,
                              }}
                            >
                              MESA #{num}
                            </div>
                            <div
                              className="p-1.5 rounded-lg bg-white shadow-sm border"
                              style={{ borderColor: customAccentColor }}
                            >
                              <div className="w-12 h-12 bg-zinc-900 rounded flex items-center justify-center text-[7px] text-white font-mono">
                                QR #{num}
                              </div>
                            </div>
                            <div
                              className="text-[8px] font-bold mt-1"
                              style={{ color: customTextColor }}
                            >
                              ¡FOTOS EN VIVO!
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* Single Card Simulation (A4, Tent, Mini) */
                    <div
                      className="rounded-2xl p-4 transition-all duration-300 shadow-xl border relative overflow-hidden flex flex-col justify-between text-center select-none"
                      style={{
                        backgroundColor: customBgColor,
                        borderColor: customAccentColor,
                        minHeight: customFormat === 'tent' ? '380px' : customFormat === 'mini' ? '330px' : '360px',
                      }}
                    >
                      {/* Inner subtle frame */}
                      <div
                        className="absolute inset-1.5 rounded-xl pointer-events-none border opacity-40"
                        style={{ borderColor: customAccentColor }}
                      />

                      {/* Top Section */}
                      <div className="relative z-10 pt-1">
                        <div
                          className="text-[9px] font-bold uppercase tracking-widest truncate px-2"
                          style={{ color: customSubtextColor }}
                        >
                          {customizingVenue.name}
                        </div>

                        {/* Badge Mesa - Centered */}
                        <div className="flex justify-center my-2">
                          <div
                            className="px-4 py-1 rounded-full text-xs font-black tracking-wide shadow-md transition-all"
                            style={{
                              backgroundColor: customAccentColor,
                              color: customBadgeTextColor,
                            }}
                          >
                            MESA #1
                          </div>
                        </div>
                      </div>

                      {/* QR Code Simulation (Center) */}
                      <div className="relative z-10 flex flex-col items-center my-1">
                        {/* White Plaque behind QR */}
                        <div
                          className="p-2.5 rounded-xl bg-white shadow-lg border transition-all"
                          style={{ borderColor: customAccentColor }}
                        >
                          <svg
                            className="w-24 h-24 sm:w-28 sm:h-28 text-zinc-950"
                            viewBox="0 0 100 100"
                            fill="currentColor"
                          >
                            {/* Top-left marker */}
                            <rect x="5" y="5" width="28" height="28" rx="4" fill="currentColor" />
                            <rect x="9" y="9" width="20" height="20" rx="2" fill="white" />
                            <rect x="13" y="13" width="12" height="12" rx="1" fill="currentColor" />

                            {/* Top-right marker */}
                            <rect x="67" y="5" width="28" height="28" rx="4" fill="currentColor" />
                            <rect x="71" y="9" width="20" height="20" rx="2" fill="white" />
                            <rect x="75" y="13" width="12" height="12" rx="1" fill="currentColor" />

                            {/* Bottom-left marker */}
                            <rect x="5" y="67" width="28" height="28" rx="4" fill="currentColor" />
                            <rect x="9" y="71" width="20" height="20" rx="2" fill="white" />
                            <rect x="13" y="75" width="12" height="12" rx="1" fill="currentColor" />

                            {/* QR Mock Data Points */}
                            <rect x="38" y="10" width="6" height="6" fill="currentColor" />
                            <rect x="48" y="10" width="6" height="6" fill="currentColor" />
                            <rect x="58" y="10" width="6" height="6" fill="currentColor" />
                            <rect x="38" y="22" width="6" height="6" fill="currentColor" />
                            <rect x="52" y="22" width="6" height="6" fill="currentColor" />
                            <rect x="10" y="40" width="6" height="6" fill="currentColor" />
                            <rect x="22" y="40" width="6" height="6" fill="currentColor" />
                            <rect x="34" y="40" width="6" height="6" fill="currentColor" />
                            <rect x="46" y="40" width="6" height="6" fill="currentColor" />
                            <rect x="64" y="40" width="6" height="6" fill="currentColor" />
                            <rect x="76" y="40" width="6" height="6" fill="currentColor" />
                            <rect x="88" y="40" width="6" height="6" fill="currentColor" />
                            <rect x="40" y="52" width="6" height="6" fill="currentColor" />
                            <rect x="54" y="52" width="6" height="6" fill="currentColor" />
                            <rect x="68" y="52" width="6" height="6" fill="currentColor" />
                            <rect x="40" y="66" width="6" height="6" fill="currentColor" />
                            <rect x="54" y="66" width="6" height="6" fill="currentColor" />
                            <rect x="70" y="66" width="6" height="6" fill="currentColor" />
                            <rect x="84" y="66" width="6" height="6" fill="currentColor" />
                            <rect x="40" y="80" width="6" height="6" fill="currentColor" />
                            <rect x="58" y="80" width="6" height="6" fill="currentColor" />
                            <rect x="72" y="80" width="6" height="6" fill="currentColor" />
                            <rect x="86" y="80" width="6" height="6" fill="currentColor" />
                          </svg>
                        </div>
                      </div>

                      {/* Bottom Instructions */}
                      <div className="relative z-10 space-y-1 pb-1">
                        <div
                          className="text-[11px] font-black tracking-tight"
                          style={{ color: customTextColor }}
                        >
                          ¡COMPARTÍ TUS FOTOS EN PANTALLA!
                        </div>
                        <div
                          className="text-[9px] leading-tight"
                          style={{ color: customSubtextColor }}
                        >
                          1. Escaneá con tu celular • 2. Sacá tu foto • 3. En vivo en la fiesta
                        </div>
                      </div>

                      {/* If Tent, show dotted fold line indicator */}
                      {customFormat === 'tent' && (
                        <div className="absolute inset-x-0 bottom-0 bg-black/10 border-t border-dashed border-zinc-400 py-1 text-[8px] text-zinc-500 font-mono">
                          --- LÍNEA DE PLIEGUE CENTRAL (DOBLAR AQUÍ) ---
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Print Info Callout */}
                <div className="mt-4 p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-[11px] text-zinc-400 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Printer className="w-4 h-4 text-brand-400 flex-shrink-0" />
                    <span>
                      {customFormat === 'grid4'
                        ? `Se generará un PDF de ${Math.ceil((customizingVenue.totalTables || 30) / 4)} hojas A4 (4 mesas por hoja con guías de corte ✂).`
                        : `Se generará un PDF de ${customizingVenue.totalTables || 30} páginas vectoriales.`}
                    </span>
                  </div>
                  <span className="text-zinc-500 font-mono">300 DPI</span>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="pt-4 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setCustomizingVenue(null)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-semibold text-xs border border-zinc-800 transition-all cursor-pointer"
              >
                Cerrar
              </button>

              <a
                href={getPdfDownloadUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 via-purple-600 to-brand-500 hover:from-brand-500 hover:to-purple-400 text-white font-bold text-xs shadow-lg shadow-brand-900/40 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>
                  Descargar PDF Master (
                  {customFormat === 'a4'
                    ? 'Estándar A4'
                    : customFormat === 'tent'
                    ? 'Carpa Mesa'
                    : customFormat === 'mini'
                    ? 'Mini 10x15'
                    : '4 por Hoja A4'}
                  )
                </span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
