'use client';

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
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
  Trophy,
  LayoutGrid,
  Film,
  Flame,
  ChevronRight,
  ChevronLeft,
  X,
  Award,
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

  // Future features: View modes and Leaderboard
  const [viewMode, setViewMode] = useState<'mosaic' | 'slideshow'>('mosaic');
  const [slideshowIndex, setSlideshowIndex] = useState<number>(0);
  const [showLeaderboard, setShowLeaderboard] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Helper to construct public image URL
  const getPhotoUrl = useCallback(
    (storagePath: string) => {
      if (storagePath.startsWith('http')) return storagePath;
      return `${supabaseStorageUrl}/storage/v1/object/public/event-photos/${storagePath}`;
    },
    [supabaseStorageUrl]
  );

  // Calculate table ranking (Gamification)
  const leaderboard = useMemo(() => {
    const counts: Record<number, number> = {};
    photos.forEach((p) => {
      counts[p.table_number] = (counts[p.table_number] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([table, count]) => ({ table: Number(table), count }))
      .sort((a, b) => b.count - a.count);
  }, [photos]);

  // Slideshow auto-rotation timer (every 6.5s)
  useEffect(() => {
    if (viewMode !== 'slideshow' || photos.length === 0 || spotlightPhoto) return;

    const interval = setInterval(() => {
      setSlideshowIndex((prev) => (prev + 1) % photos.length);
    }, 6500);

    return () => clearInterval(interval);
  }, [viewMode, photos.length, spotlightPhoto]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        setIsBlackoutActive((prev) => !prev);
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'm' || e.key === 'M') {
        setViewMode((prev) => (prev === 'mosaic' ? 'slideshow' : 'mosaic'));
      } else if (e.key === 'r' || e.key === 'R') {
        setShowLeaderboard((prev) => !prev);
      } else if (e.key === 'ArrowRight' && viewMode === 'slideshow' && photos.length > 0) {
        setSlideshowIndex((prev) => (prev + 1) % photos.length);
      } else if (e.key === 'ArrowLeft' && viewMode === 'slideshow' && photos.length > 0) {
        setSlideshowIndex((prev) => (prev - 1 + photos.length) % photos.length);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, photos.length]);

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
          if (updated.status === 'approved') {
            setPhotos((prev) => {
              if (prev.some((p) => p.id === updated.id)) {
                return prev.map((p) => (p.id === updated.id ? updated : p));
              }
              return [updated, ...prev];
            });
          } else {
            // Photo was rejected/moderated out -> remove immediately
            setPhotos((prev) => prev.filter((p) => p.id !== updated.id));
            if (spotlightPhoto?.id === updated.id) {
              setSpotlightPhoto(null);
            }
          }
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
          setPhotos((prev) => prev.filter((p) => p.id !== deleted.id));
          if (spotlightPhoto?.id === deleted.id) {
            setSpotlightPhoto(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, spotlightPhoto]);

  // Spotlight Auto-Dismiss Timer (8.5 seconds per photo)
  useEffect(() => {
    if (!spotlightPhoto) return;

    const timer = setTimeout(() => {
      setSpotlightPhoto(null);
    }, 8500);

    return () => clearTimeout(timer);
  }, [spotlightPhoto, spotlightTimer]);

  // Fullscreen Handler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const currentSlideshowPhoto = photos.length > 0 ? photos[slideshowIndex % photos.length] : null;

  return (
    <div
      ref={containerRef}
      className="relative w-screen h-screen bg-[#07070a] text-white flex flex-col justify-between overflow-hidden select-none font-sans"
    >
      {/* Background Ambience */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-brand-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[130px] pointer-events-none" />

      {/* EMERGENCY BLACKOUT OVERLAY */}
      {isBlackoutActive ? (
        <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center p-8 text-center animate-fade-in">
          <div className="w-24 h-24 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-amber-500 mb-6 shadow-2xl">
            <ShieldAlert className="w-12 h-12" />
          </div>
          <h2 className="text-4xl sm:text-6xl font-black tracking-tight text-white mb-4">
            PROYECCIÓN EN PAUSA
          </h2>
          <p className="text-zinc-400 text-lg max-w-md">
            El sistema se encuentra temporalmente suspendido por el moderador del salón.
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

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Photos Counter */}
          <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-xl glass-card border-zinc-800 text-xs font-semibold text-zinc-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{photos.length} fotos</span>
          </div>

          {/* Toggle View Mode Button (Mosaic / Slideshow) */}
          <button
            onClick={() => setViewMode((prev) => (prev === 'mosaic' ? 'slideshow' : 'mosaic'))}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              viewMode === 'slideshow'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow'
                : 'glass-card hover:bg-zinc-800 text-zinc-300 border-zinc-800'
            }`}
            title="Cambiar Modo de Vista: Mosaico vs Slideshow [M]"
          >
            {viewMode === 'mosaic' ? (
              <>
                <Film className="w-4 h-4 text-purple-400" />
                <span className="hidden sm:inline">Slideshow</span>
              </>
            ) : (
              <>
                <LayoutGrid className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Mosaico</span>
              </>
            )}
          </button>

          {/* Leaderboard Button */}
          <button
            onClick={() => setShowLeaderboard((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              showLeaderboard
                ? 'bg-brand-600 text-white border-brand-500 shadow-lg shadow-brand-500/30'
                : 'glass-card hover:bg-zinc-800 text-zinc-300 border-zinc-800'
            }`}
            title="Ranking de Mesas [R]"
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Ranking</span>
          </button>

          {/* Kill Switch Quick Button */}
          <button
            onClick={() => setIsBlackoutActive((prev) => !prev)}
            className="p-2.5 rounded-xl glass-card hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 transition-all border-zinc-800"
            title="Pánico / Pausa (Barra Espaciadora)"
          >
            <Power className="w-4 h-4" />
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl glass-card hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all border-zinc-800"
            title="Pantalla Completa (F)"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
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
        ) : viewMode === 'mosaic' ? (
          /* 1. Dynamic Multi-Tile Photo Wall Layout */
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
        ) : (
          /* 2. Elegant Cinema Slideshow (Ken Burns Mode) */
          currentSlideshowPhoto && (
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-3xl border border-zinc-800/80 bg-black/60 shadow-2xl">
              {/* Slideshow Image with Ken Burns animation */}
              <div className="absolute inset-0 overflow-hidden flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={currentSlideshowPhoto.id}
                  src={getPhotoUrl(currentSlideshowPhoto.storage_path)}
                  alt={`Foto de ${currentSlideshowPhoto.uploader_name}`}
                  className="w-full h-full object-contain animate-kenburns transition-all duration-1000"
                />
              </div>

              {/* Bottom Cinema Overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-end justify-between z-20">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-600 text-white text-xs font-bold mb-3 shadow">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Mesa #{currentSlideshowPhoto.table_number}</span>
                  </div>
                  {currentSlideshowPhoto.caption && (
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-amber-200 italic mb-2 drop-shadow max-w-3xl">
                      &quot;{currentSlideshowPhoto.caption}&quot;
                    </h3>
                  )}
                  <p className="text-lg sm:text-xl font-bold text-white drop-shadow">
                    {currentSlideshowPhoto.uploader_name}
                  </p>
                </div>

                {/* Slideshow pagination indicator */}
                <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-zinc-400">
                  <button
                    onClick={() =>
                      setSlideshowIndex((prev) => (prev - 1 + photos.length) % photos.length)
                    }
                    className="p-2 rounded-xl bg-black/50 hover:bg-black/80 text-white border border-zinc-700 transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span>
                    {(slideshowIndex % photos.length) + 1} / {photos.length}
                  </span>
                  <button
                    onClick={() => setSlideshowIndex((prev) => (prev + 1) % photos.length)}
                    className="p-2 rounded-xl bg-black/50 hover:bg-black/80 text-white border border-zinc-700 transition-all"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )
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

      {/* LEADERBOARD OVERLAY / PODIO DE MESAS MÁS FIESTERAS */}
      {showLeaderboard && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 animate-fade-in">
          <div className="relative max-w-2xl w-full glass-panel rounded-3xl p-6 sm:p-8 border border-amber-500/40 shadow-2xl glow-gold">
            <button
              onClick={() => setShowLeaderboard(false)}
              className="absolute top-5 right-5 p-2 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-xs uppercase tracking-wider mb-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>Gamificación del Evento</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                Ranking de Mesas Más Fiesteras 🏆
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                ¿Qué mesa está viviendo la noche con más intensidad?
              </p>
            </div>

            {leaderboard.length === 0 ? (
              <p className="text-center text-zinc-400 text-sm py-8">
                Aún no hay fotos registradas para calcular el podio.
              </p>
            ) : (
              <div className="space-y-3">
                {leaderboard.slice(0, 5).map((entry, idx) => {
                  const isGold = idx === 0;
                  const isSilver = idx === 1;
                  const isBronze = idx === 2;

                  return (
                    <div
                      key={entry.table}
                      className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                        isGold
                          ? 'bg-gradient-to-r from-amber-500/20 via-amber-600/10 to-transparent border-amber-500/50 shadow-lg shadow-amber-500/10'
                          : isSilver
                          ? 'bg-zinc-800/60 border-zinc-600/40'
                          : isBronze
                          ? 'bg-amber-900/20 border-amber-800/40'
                          : 'bg-zinc-900/60 border-zinc-800'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <span
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm ${
                            isGold
                              ? 'bg-amber-500 text-black shadow'
                              : isSilver
                              ? 'bg-zinc-300 text-black'
                              : isBronze
                              ? 'bg-amber-700 text-white'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          #{idx + 1}
                        </span>
                        <div>
                          <h4 className="font-bold text-base sm:text-lg text-white flex items-center gap-2">
                            Mesa #{entry.table}
                            {isGold && (
                              <span className="text-xs text-amber-400 font-semibold flex items-center gap-1">
                                <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> Líder
                              </span>
                            )}
                          </h4>
                          <span className="text-xs text-zinc-400">
                            {entry.count} {entry.count === 1 ? 'recuerdo subido' : 'recuerdos subidos'}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xl sm:text-2xl font-black text-amber-300">
                          {entry.count}
                        </span>
                        <span className="text-xs text-zinc-400 block font-medium">fotos</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Ticker Bar with Live Leaderboard Teaser */}
      <footer className="z-30 px-6 py-3 bg-gradient-to-t from-black/95 via-black/80 to-transparent flex items-center justify-between text-xs text-zinc-400">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-brand-400 animate-ping" />
          <span className="font-medium text-zinc-300 truncate max-w-sm sm:max-w-md">
            {leaderboard.length > 0 ? (
              <span className="inline-flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span>
                  Mesa más fiestera:{' '}
                  <strong className="text-amber-300 font-bold">
                    Mesa #{leaderboard[0].table} ({leaderboard[0].count} fotos)
                  </strong>
                </span>
              </span>
            ) : (
              'Transmitiendo en vivo • Los recuerdos de esta noche'
            )}
          </span>
        </div>

        <div className="text-[11px] text-zinc-500 hidden sm:flex items-center gap-3">
          <span>[M] Modo Vista</span>
          <span>•</span>
          <span>[R] Ranking</span>
          <span>•</span>
          <span>[Espacio] Pausa</span>
          <span>•</span>
          <span>[F] Pantalla Completa</span>
        </div>
      </footer>
    </div>
  );
}
