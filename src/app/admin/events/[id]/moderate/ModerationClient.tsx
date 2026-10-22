'use client';

import React, { useState, useEffect, useTransition } from 'react';
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
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
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
    // Optimistic UI update
    setPhotos((prev) =>
      prev.map((p) => (p.id === photoId ? { ...p, status } : p))
    );

    startTransition(async () => {
      const res = await moderatePhotoAction({ photoId, status });
      if (!res.success) {
        setToastMessage(`Error: ${res.error}`);
      } else {
        setToastMessage(status === 'approved' ? 'Foto aprobada para proyector' : 'Foto ocultada');
      }
    });
  };

  // Handle Blocking a Table
  const handleToggleBlockTable = (tableNumber: number) => {
    const isCurrentlyBlocked = blockedTables.includes(tableNumber);
    const actionBlock = !isCurrentlyBlocked;

    if (
      actionBlock &&
      !window.confirm(
        `¿Confirmas silenciar la Mesa #${tableNumber}? Se ocultarán todas sus fotos y no podrán subir más.`
      )
    ) {
      return;
    }

    setBlockedTables((prev) =>
      actionBlock ? [...prev, tableNumber] : prev.filter((t) => t !== tableNumber)
    );

    if (actionBlock) {
      setPhotos((prev) =>
        prev.map((p) => (p.table_number === tableNumber ? { ...p, status: 'rejected' } : p))
      );
    }

    startTransition(async () => {
      const res = await toggleTableBlockAction({
        eventId: event.id,
        tableNumber,
        block: actionBlock,
        reason: 'Bloqueado por moderador',
      });
      if (res.success) {
        setToastMessage(
          actionBlock
            ? `Mesa #${tableNumber} bloqueada y fotos ocultadas`
            : `Mesa #${tableNumber} desbloqueada`
        );
      }
    });
  };

  // Toggle Moderation Mode
  const handleToggleMode = (newMode: ModerationMode) => {
    setCurrentMode(newMode);
    startTransition(async () => {
      const res = await updateModerationModeAction({
        eventId: event.id,
        moderationMode: newMode,
      });
      if (res.success) {
        setToastMessage(
          newMode === 'strict'
            ? 'Modo Estricto activado: Cada foto requerirá aprobación manual'
            : 'Modo Auto-Aprobación activado: Las fotos van directo a pantalla'
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

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 min-h-screen flex flex-col justify-between">
      <div>
        {/* Navigation & Header */}
        <header className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <Link
              href="/admin/events"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Volver al Dashboard</span>
            </Link>

            <Link
              href={`/live/${event.id}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/20 border border-purple-500/40 text-purple-300 text-xs font-bold hover:bg-purple-600/30 transition-all"
            >
              <Tv className="w-3.5 h-3.5" />
              <span>Ver Proyector</span>
              <ExternalLink className="w-3 h-3 ml-0.5 opacity-60" />
            </Link>
          </div>

          <div className="glass-panel rounded-2xl p-4 sm:p-5 border-zinc-800">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  {venueName}
                </span>
                <h1 className="text-2xl font-black text-white tracking-tight">{event.title}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs text-zinc-300 font-medium">
                    Panel de Moderación en Vivo
                  </span>
                </div>
              </div>

              {/* Mode Toggle Switch */}
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
                  Estricto (Aprobación)
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
              className="text-zinc-400 hover:text-white ml-2"
            >
              ×
            </button>
          </div>
        )}

        {/* Tab Controls */}
        <div className="grid grid-cols-3 gap-2 mb-6">
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
        </div>

        {/* Photos Grid */}
        {displayedPhotos.length === 0 ? (
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
                    <div className="absolute top-2 left-2 flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-white font-bold text-xs">
                        Mesa #{photo.table_number}
                      </span>
                      {isTableBlocked && (
                        <span className="px-2 py-0.5 rounded-md bg-red-600/90 text-white font-bold text-[10px] uppercase">
                          Mesa Bloqueada
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Metadata and Caption */}
                  <div className="p-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-white truncate max-w-[140px]">
                        {photo.uploader_name}
                      </span>
                      <span className="text-[11px] text-zinc-500">
                        {new Date(photo.created_at).toLocaleTimeString('es-AR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    {photo.caption && (
                      <p className="text-xs text-brand-300 italic line-clamp-2 bg-brand-950/30 p-1.5 rounded-lg border border-brand-500/20 mb-2">
                        &quot;{photo.caption}&quot;
                      </p>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/80">
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
