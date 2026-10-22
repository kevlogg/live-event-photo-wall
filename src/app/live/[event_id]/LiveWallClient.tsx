'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Photo } from '@/types/database';
import {
  Maximize2,
  Minimize2,
  Sparkles,
  Camera,
  Tv,
  Power,
  ShieldAlert,
} from 'lucide-react';

interface LiveWallClientProps {
  eventId: string;
  eventTitle: string;
  venueName: string;
  initialPhotos: Photo[];
  supabaseStorageUrl: string;
}

export default function LiveWallClient({
  eventId,
  eventTitle,
  venueName,
  initialPhotos,
  supabaseStorageUrl,
}: LiveWallClientProps) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [spotlightPhoto, setSpotlightPhoto] = useState<Photo | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [spotlightTimer, setSpotlightTimer] = useState<number>(0);
  const [isBlackoutActive, setIsBlackoutActive] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Helper to construct public image URL
  const getPhotoUrl = useCallback(
    (storagePath: string) => {
      if (storagePath.startsWith('http')) return storagePath;
      return `${supabaseStorageUrl}/storage/v1/object/public/event-photos/${storagePath}`;
    },
    [supabaseStorageUrl]
  );

  // Keyboard shortcut listener for Emergency Kill-Switch (Spacebar or 'B')
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        setIsBlackoutActive((prev) => !prev);
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Supabase Realtime Subscription
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`live-wall-events-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'photos',
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          const newPhoto = payload.new as Photo;
          if (newPhoto.status === 'approved') {
            setPhotos((prev) => {
              if (prev.some((p) => p.id === newPhoto.id)) return prev;
              return [newPhoto, ...prev];
            });

            // Trigger Spotlight for 8.5 seconds
            setSpotlightPhoto(newPhoto);
            setSpotlightTimer(Date.now());
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'photos',
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          const updated = payload.new as Photo;
          setPhotos((prev) => {
            if (updated.status === 'approved') {
              const exists = prev.some((p) => p.id === updated.id);
              if (exists) {
                return prev.map((p) => (p.id === updated.id ? updated : p));
              }
              return [updated, ...prev];
            } else {
              // Photo was rejected by moderator -> remove from wall immediately
              if (spotlightPhoto?.id === updated.id) {
                setSpotlightPhoto(null);
              }
              return prev.filter((p) => p.id !== updated.id);
            }
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'photos',
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          const deleted = payload.old as { id: string };
          if (spotlightPhoto?.id === deleted.id) {
            setSpotlightPhoto(null);
          }
          setPhotos((prev) => prev.filter((p) => p.id !== deleted.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, spotlightPhoto]);

  // Spotlight Auto-dismiss
  useEffect(() => {
    if (!spotlightPhoto) return;

    const timer = setTimeout(() => {
      setSpotlightPhoto(null);
    }, 8500);

    return () => clearTimeout(timer);
  }, [spotlightPhoto, spotlightTimer]);

  // Fullscreen toggle handler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-screen h-screen bg-black text-white overflow-hidden select-none flex flex-col justify-between font-sans"
    >
      {/* Emergency Blackout Screen (Kill-Switch Active) */}
      {isBlackoutActive ? (
        <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center p-8 animate-fade-in text-center">
          <div className="w-20 h-20 rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6 shadow-2xl">
            <Sparkles className="w-10 h-10 text-amber-400" />
          </div>
          <h2 className="text-4xl sm:text-6xl font-black text-white tracking-tight">
            {eventTitle}
          </h2>
          <p className="mt-4 text-xl text-zinc-500 font-light tracking-widest uppercase">
            {venueName}
          </p>

          <button
            onClick={() => setIsBlackoutActive(false)}
            className="mt-12 px-6 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-500 hover:text-zinc-300 transition-all"
          >
            Presiona Espacio o haz clic para reanudar proyección
          </button>
        </div>
      ) : null}

      {/* Top Floating Projector Header */}
      <header className="z-30 px-6 py-4 flex items-center justify-between bg-gradient-to-b from-black/95 via-black/60 to-transparent">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-600 to-amber-500 p-0.5 shadow-lg shadow-brand-500/20">
            <div className="w-full h-full bg-black/80 rounded-[10px] flex items-center justify-center">
              <Camera className="w-5 h-5 text-amber-300" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white drop-shadow-md">
                {eventTitle}
              </h1>
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-600/20 border border-red-500/50 text-red-400 font-extrabold text-xs uppercase tracking-wider animate-pulse">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                Live Wall
              </span>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400 font-medium">
              {venueName} • Escaneá el QR de tu mesa para aparecer en pantalla
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Photos Counter */}
          <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-xl glass-card border-zinc-800 text-xs font-semibold text-zinc-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{photos.length} fotos proyectadas</span>
          </div>

          {/* Kill Switch Quick Button */}
          <button
            onClick={() => setIsBlackoutActive((prev) => !prev)}
            className="p-2.5 rounded-xl glass-card hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 transition-all border-zinc-800"
            title="Pánico / Pausa (Barra Espaciadora)"
          >
            <Power className="w-5 h-5" />
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl glass-card hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all border-zinc-800"
            title="Pantalla Completa (F)"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Main Wall Content */}
      <main className="flex-1 relative z-10 px-6 py-2 overflow-hidden flex items-center justify-center">
        {photos.length === 0 ? (
          /* Empty State Waiting for first photo */
          <div className="text-center max-w-lg glass-panel p-8 rounded-3xl border-zinc-800/80 animate-pulse-slow">
            <div className="w-20 h-20 rounded-2xl bg-brand-500/10 border border-brand-500/30 text-brand-400 flex items-center justify-center mx-auto mb-4">
              <Tv className="w-10 h-10" />
            </div>
            <h2 className="text-3xl font-extrabold text-white mb-2">
              Esperando las primeras fotos...
            </h2>
            <p className="text-zinc-400 text-base leading-relaxed">
              Los invitados pueden escanear el código QR que se encuentra en el centro de su mesa
              para compartir sus fotos en vivo en esta pantalla.
            </p>
          </div>
        ) : (
          /* Dynamic Multi-Tile Photo Wall Layout */
          <div className="w-full h-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 auto-rows-fr overflow-hidden">
            {photos.slice(0, 24).map((photo, index) => {
              const isFirst = index === 0;
              return (
                <div
                  key={photo.id}
                  className={`relative rounded-2xl overflow-hidden glass-card border-zinc-800/80 group transition-all duration-700 ${
                    isFirst ? 'col-span-2 row-span-2 ring-2 ring-brand-500/50 glow-purple' : ''
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getPhotoUrl(photo.storage_path)}
                    alt={`Foto de ${photo.uploader_name}`}
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                    loading="lazy"
                  />
                  {/* Overlay Gradient with Metadata & Caption */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent flex flex-col justify-end p-3 opacity-95 transition-opacity">
                    {photo.caption && (
                      <p className="text-xs text-white/95 font-medium italic line-clamp-2 drop-shadow mb-1">
                        &quot;{photo.caption}&quot;
                      </p>
                    )}
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white truncate max-w-[120px] drop-shadow">
                        {photo.uploader_name}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-brand-600/80 text-white font-semibold text-[10px] backdrop-blur-sm shadow">
                        Mesa #{photo.table_number}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Spotlight Modal when a new photo arrives */}
      {spotlightPhoto && (
        <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 animate-fade-in">
          <div className="relative max-w-4xl w-full max-h-[90vh] glass-panel rounded-3xl p-4 sm:p-6 border-2 border-brand-500/60 shadow-2xl glow-purple flex flex-col items-center">
            {/* Header Badge */}
            <div className="w-full flex items-center justify-between mb-3 px-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-xs uppercase tracking-wider animate-bounce-subtle">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>¡Nueva Foto en Vivo!</span>
              </div>
              <div className="px-3 py-1 rounded-full bg-brand-600 text-white font-bold text-xs">
                Mesa #{spotlightPhoto.table_number}
              </div>
            </div>

            {/* Photo Container */}
            <div className="relative w-full max-h-[64vh] rounded-2xl overflow-hidden bg-zinc-950 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getPhotoUrl(spotlightPhoto.storage_path)}
                alt={`Nueva foto de ${spotlightPhoto.uploader_name}`}
                className="max-h-[64vh] w-auto object-contain rounded-xl shadow-2xl"
              />
            </div>

            {/* Caption & Author */}
            <div className="mt-3 text-center">
              {spotlightPhoto.caption && (
                <p className="text-base sm:text-lg text-amber-200 font-medium italic mb-1">
                  &quot;{spotlightPhoto.caption}&quot;
                </p>
              )}
              <h3 className="text-xl sm:text-2xl font-extrabold text-white">
                {spotlightPhoto.uploader_name}
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400">
                Compartido desde la Mesa #{spotlightPhoto.table_number}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Ticker Bar */}
      <footer className="z-30 px-6 py-3 bg-gradient-to-t from-black/95 via-black/80 to-transparent flex items-center justify-between text-xs text-zinc-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-brand-400 animate-ping" />
          <span className="font-medium text-zinc-300">
            Transmitiendo en vivo • Los recuerdos de esta noche en alta calidad
          </span>
        </div>
        <div className="text-[11px] text-zinc-500 hidden sm:block">
          Presiona [Barra Espaciadora] para Modo Pausa de Emergencia
        </div>
      </footer>
    </div>
  );
}
