'use client';

import React, { useState, useEffect, useTransition, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { moderatePhotoAction } from '@/server/actions/photos';
import { toggleTableBlockAction, updateModerationModeAction } from '@/server/actions/events';
import type { Photo, Event, PhotoStatus, ModerationMode } from '@/types/database';
import {
  ShieldCheck,
  Check,
  X,
  AlertTriangle,
  Tv,
  Ban,
  Clock,
  ExternalLink,
  ChevronLeft,
  Sparkles,
  EyeOff,
  RefreshCw,
  Trophy,
  Flame,
} from 'lucide-react';

interface ModerationClientProps {
  event: Event;
  venueName: string;
  initialPhotos: Photo[];
  initialBlockedTables: number[];
  supabaseStorageUrl: string;
}

export default function ModerationClient({
  event,
  venueName,
  initialPhotos,
  initialBlockedTables,
  supabaseStorageUrl,
}: ModerationClientProps) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [blockedTables, setBlockedTables] = useState<number[]>(initialBlockedTables);
  const [currentMode, setCurrentMode] = useState<ModerationMode>(
    event.moderation_mode || 'auto_approve'
  );
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'ranking'>('pending');
  const [isPending, startTransition] = useTransition();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Helper to build image URL
  const getPhotoUrl = (storagePath: string) => {
    if (storagePath.startsWith('http')) return storagePath;
    return `${supabaseStorageUrl}/storage/v1/object/public/event-photos/${storagePath}`;
  };

  // Realtime subscription for incoming photos and status updates
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`moderation-${event.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'photos',
          filter: `event_id=eq.${event.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newPhoto = payload.new as Photo;
            setPhotos((prev) => [newPhoto, ...prev.filter((p) => p.id !== newPhoto.id)]);
            setToastMessage(`Nueva foto recibida de Mesa #${newPhoto.table_number}`);
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Photo;
            setPhotos((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id: string };
            setPhotos((prev) => prev.filter((p) => p.id !== deleted.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [event.id]);

  // Handle Photo Moderation (Approve / Reject)
  const handleModerate = (photoId: string, status: 'approved' | 'rejected') => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === photoId ? { ...p, status } : p))
    );

    startTransition(async () => {
      const res = await moderatePhotoAction({ photoId, status });
      if (!res.success) {
        setToastMessage(`Error: ${res.error}`);
      } else {
        setToastMessage(
          status === 'approved' ? 'Foto aprobada para pantalla' : 'Foto ocultada del proyector'
        );
      }
    });
  };

  // Handle Toggle Table Block / Mute
  const handleToggleBlockTable = (tableNumber: number) => {
    const isCurrentlyBlocked = blockedTables.includes(tableNumber);
    const newBlocked = isCurrentlyBlocked
      ? blockedTables.filter((t) => t !== tableNumber)
      : [...blockedTables, tableNumber];

    setBlockedTables(newBlocked);

    startTransition(async () => {
      const res = await toggleTableBlockAction({
        eventId: event.id,
        tableNumber,
        block: !isCurrentlyBlocked,
        reason: !isCurrentlyBlocked ? 'Silenciada por moderador' : undefined,
      });

      if (!res.success) {
        setToastMessage(`Error: ${res.error}`);
        setBlockedTables(blockedTables);
      } else {
        setToastMessage(
          !isCurrentlyBlocked
            ? `Mesa #${tableNumber} silenciada. Ya no podrá subir fotos.`
            : `Mesa #${tableNumber} reactivada.`
        );
      }
    });
  };

  // Handle Toggle Event Moderation Mode
  const handleToggleMode = (mode: ModerationMode) => {
    setCurrentMode(mode);
    startTransition(async () => {
      const res = await updateModerationModeAction({
        eventId: event.id,
        moderationMode: mode,
      });

      if (!res.success) {
        setToastMessage(`Error: ${res.error}`);
      } else {
        setToastMessage(
          mode === 'auto_approve'
            ? 'Modo Pase Libre: Las fotos se proyectan automáticamente.'
            : 'Modo Estricto: Todas las fotos requieren aprobación manual.'
        );
      }
    });
  };

  const pendingPhotos = photos.filter((p) => p.status === 'pending');
  const approvedPhotos = photos.filter((p) => p.status === 'approved');
  const rejectedPhotos = photos.filter((p) => p.status === 'rejected');

  const displayedPhotos =
    activeTab === 'pending'
      ? pendingPhotos
      : activeTab === 'approved'
      ? approvedPhotos
      : rejectedPhotos;

  // Calculate table leaderboard
  const leaderboard = useMemo(() => {
    const counts: Record<number, number> = {};
    photos.forEach((p) => {
      if (p.status === 'approved') {
        counts[p.table_number] = (counts[p.table_number] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([table, count]) => ({ table: Number(table), count }))
      .sort((a, b) => b.count - a.count);
  }, [photos]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 min-h-screen flex flex-col justify-between">
      <div>
        {/* Navigation Bar */}
        <div className="flex items-center justify-between mb-4">
          <Link
            href="/admin/events"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Volver al Panel</span>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href={`/live/${event.id}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold border border-zinc-700 transition-all"
            >
              <Tv className="w-3.5 h-3.5 text-amber-400" />
              <span>Ver Live Wall</span>
              <ExternalLink className="w-3 h-3 text-zinc-400" />
            </Link>
          </div>
        </div>

        {/* Header Panel */}
        <header className="glass-panel rounded-2xl p-4 sm:p-5 mb-6 border-zinc-800">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-zinc-400">{venueName}</span>
                <span className="text-zinc-600">•</span>
                <span className="text-xs text-brand-300 font-bold">{event.title}</span>
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight">
                Centro de Moderación
              </h1>
            </div>

            {/* Mode Toggle Switch */}
            <div className="flex items-center gap-2">
              <div className="bg-zinc-900 border border-zinc-700/80 p-1.5 rounded-xl flex items-center gap-1">
                <button
                  onClick={() => handleToggleMode('auto_approve')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    currentMode === 'auto_approve'
                      ? 'bg-brand-600 text-white shadow'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Pase Libre (Auto)
                </button>
                <button
                  onClick={() => handleToggleMode('strict')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    currentMode === 'strict'
                      ? 'bg-amber-600 text-white shadow'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Estricto (Revisión)
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Toast */}
        {toastMessage && (
          <div className="mb-4 p-3 rounded-xl bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 flex items-center justify-between animate-fade-in">
            <span>{toastMessage}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="text-zinc-400 hover:text-white ml-2 font-bold"
            >
              ×
            </button>
          </div>
        )}

        {/* Tab Controls (4 tabs including Ranking) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
          <button
            onClick={() => setActiveTab('pending')}
            className={`py-3 px-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 border transition-all ${
              activeTab === 'pending'
                ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-lg'
                : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Pendientes</span>
            </div>
            <span className="text-base font-extrabold">{pendingPhotos.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('approved')}
            className={`py-3 px-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 border transition-all ${
              activeTab === 'approved'
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-lg'
                : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Tv className="w-3.5 h-3.5" />
              <span>En Pantalla</span>
            </div>
            <span className="text-base font-extrabold">{approvedPhotos.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('rejected')}
            className={`py-3 px-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 border transition-all ${
              activeTab === 'rejected'
                ? 'bg-red-500/20 border-red-500 text-red-300 shadow-lg'
                : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <EyeOff className="w-3.5 h-3.5" />
              <span>Ocultadas</span>
            </div>
            <span className="text-base font-extrabold">{rejectedPhotos.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('ranking')}
            className={`py-3 px-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 border transition-all ${
              activeTab === 'ranking'
                ? 'bg-purple-500/20 border-purple-500 text-purple-300 shadow-lg'
                : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>Ranking Mesas</span>
            </div>
            <span className="text-base font-extrabold">{leaderboard.length} mesas</span>
          </button>
        </div>

        {/* Content Section: Photos vs Leaderboard */}
        {activeTab === 'ranking' ? (
          /* Ranking / Gamification View */
          <div className="glass-panel rounded-2xl p-6 border-zinc-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                <span>Mesas Más Fiesteras del Evento</span>
              </h3>
              <span className="text-xs text-zinc-400">
                {approvedPhotos.length} fotos proyectadas en total
              </span>
            </div>

            {leaderboard.length === 0 ? (
              <p className="text-center text-zinc-400 text-sm py-8">
                Aún no hay fotos aprobadas para armar el podio.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {leaderboard.map((entry, idx) => {
                  const isBlocked = blockedTables.includes(entry.table);
                  const isLeader = idx === 0;

                  return (
                    <div
                      key={entry.table}
                      className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                        isLeader
                          ? 'bg-amber-500/10 border-amber-500/40'
                          : 'bg-zinc-900/60 border-zinc-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${
                            isLeader
                              ? 'bg-amber-500 text-black'
                              : 'bg-zinc-800 text-zinc-300'
                          }`}
                        >
                          #{idx + 1}
                        </span>
                        <div>
                          <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                            Mesa #{entry.table}
                            {isLeader && <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
                          </h4>
                          <span className="text-xs text-zinc-400 font-medium">
                            {entry.count} fotos proyectadas
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleBlockTable(entry.table)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            isBlocked
                              ? 'bg-red-600 text-white border-red-500'
                              : 'bg-zinc-800 text-zinc-400 hover:text-red-400 border-zinc-700'
                          }`}
                        >
                          {isBlocked ? 'Desbloquear' : 'Silenciar Mesa'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : displayedPhotos.length === 0 ? (
          <div className="glass-panel rounded-2xl p-8 text-center border-zinc-800">
            <ShieldCheck className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
            <h3 className="text-base font-bold text-white mb-1">
              No hay fotos en esta sección
            </h3>
            <p className="text-xs text-zinc-400">
              {activeTab === 'pending'
                ? 'Las fotos enviadas que requieran revisión aparecerán aquí en tiempo real.'
                : activeTab === 'approved'
                ? 'Las fotos proyectadas en vivo en el salón aparecerán aquí.'
                : 'Las fotos descartadas aparecerán aquí.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {displayedPhotos.map((photo) => {
              const isTableBlocked = blockedTables.includes(photo.table_number);
              return (
                <div
                  key={photo.id}
                  className="glass-panel rounded-2xl overflow-hidden border-zinc-800 flex flex-col justify-between"
                >
                  <div className="relative aspect-[4/3] bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getPhotoUrl(photo.storage_path)}
                      alt={`Foto de ${photo.uploader_name}`}
                      className="w-full h-full object-cover"
                    />

                    {/* Table Badge */}
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                      <span className="px-2.5 py-1 rounded-full bg-black/80 backdrop-blur-sm text-white text-[11px] font-bold border border-zinc-700">
                        Mesa #{photo.table_number}
                      </span>
                      {isTableBlocked && (
                        <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold">
                          Silenciada
                        </span>
                      )}
                    </div>

                    {/* Time */}
                    <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-black/70 text-zinc-400 text-[10px]">
                      {new Date(photo.created_at).toLocaleTimeString('es-AR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>

                  <div className="p-3.5 flex-1 flex flex-col justify-between">
                    <div>
                      <p className="text-sm font-bold text-white">{photo.uploader_name}</p>
                      {photo.caption && (
                        <p className="text-xs text-amber-200 italic mt-0.5">&quot;{photo.caption}&quot;</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="mt-3 flex items-center gap-2 pt-2 border-t border-zinc-800">
                      {photo.status !== 'approved' && (
                        <button
                          onClick={() => handleModerate(photo.id, 'approved')}
                          className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Aprobar</span>
                        </button>
                      )}

                      {photo.status !== 'rejected' && (
                        <button
                          onClick={() => handleModerate(photo.id, 'rejected')}
                          className="flex-1 py-2 rounded-xl bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Ocultar</span>
                        </button>
                      )}

                      {/* Block Table Button */}
                      <button
                        onClick={() => handleToggleBlockTable(photo.table_number)}
                        title={isTableBlocked ? 'Desbloquear mesa' : 'Silenciar mesa'}
                        className={`p-2 rounded-xl border transition-all ${
                          isTableBlocked
                            ? 'bg-red-600 text-white border-red-500'
                            : 'bg-zinc-800 text-zinc-400 hover:text-red-400 border-zinc-700'
                        }`}
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-8 text-center text-xs text-zinc-500">
        Moderación en vivo para {venueName} • Actualizado en tiempo real
      </footer>
    </div>
  );
}
