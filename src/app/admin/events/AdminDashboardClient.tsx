'use client';

import React, { useState, useTransition } from 'react';
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
} from 'lucide-react';

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
        setNotification({
          type: 'success',
          message: `Salón "${venueName}" creado con ${venueTables} mesas y QRs generados`,
        });
        setVenues((prev) => [
          ...prev,
          {
            id: res.data!.venueId,
            name: venueName,
            slug: res.data!.slug,
            totalTables: res.data!.totalTables,
            created_at: new Date().toISOString(),
          },
        ]);
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
      if (!eventStartTime || !eventEndTime) {
        setNotification({ type: 'error', message: 'Completá las fechas de inicio y fin' });
        return;
      }

      const res = await createEventAction({
        venueId: selectedVenueId,
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
        const venue = venues.find((v) => v.id === selectedVenueId);
        setNotification({
          type: 'success',
          message: `Fiesta "${eventTitle}" creada exitosamente`,
        });
        setEvents((prev) => [
          {
            ...res.data!,
            venue: {
              id: venue?.id || selectedVenueId,
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
            Live Event Photo Wall SaaS
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Gestión remota de salones, activación de fiestas y exportación de kits de QRs.
          </p>
        </div>

        <div className="flex items-center gap-3">
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

              <div className="mt-5 pt-4 border-t border-zinc-800/80 space-y-2">
                <span className="text-[11px] font-semibold text-zinc-400 block mb-1">
                  Exportar Kit de Imprenta:
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  <a
                    href={`/admin/venues/${venue.id}/pdf?format=a4`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-1.5 px-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-center text-xs font-semibold border border-zinc-700 transition-all"
                  >
                    Estándar A4
                  </a>
                  <a
                    href={`/admin/venues/${venue.id}/pdf?format=tent`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-1.5 px-2 rounded-lg bg-brand-600/30 hover:bg-brand-600/50 text-brand-300 text-center text-xs font-semibold border border-brand-500/40 transition-all"
                  >
                    Carpa Mesa
                  </a>
                  <a
                    href={`/admin/venues/${venue.id}/pdf?format=mini`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-1.5 px-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-center text-xs font-semibold border border-amber-500/30 transition-all"
                  >
                    Mini 10x15
                  </a>
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
                  value={selectedVenueId}
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
    </div>
  );
}
