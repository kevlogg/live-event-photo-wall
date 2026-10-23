'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import JSZip from 'jszip';
import type { Photo, Event } from '@/types/database';
import {
  Download,
  Sparkles,
  ChevronLeft,
  X,
  Share2,
  Calendar,
  Layers,
  FolderDown,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

interface GalleryClientProps {
  event: Event;
  venueName: string;
  photos: Photo[];
  supabaseStorageUrl: string;
}

export default function GalleryClient({
  event,
  venueName,
  photos,
  supabaseStorageUrl,
}: GalleryClientProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [selectedFilterTable, setSelectedFilterTable] = useState<number | null>(null);
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const [zipProgress, setZipProgress] = useState<{
    current: number;
    total: number;
    percent: number;
    status: string;
  } | null>(null);
  const abortZipRef = useRef<boolean>(false);

  const getPhotoUrl = (storagePath: string) => {
    if (storagePath.startsWith('http')) return storagePath;
    return `${supabaseStorageUrl}/storage/v1/object/public/event-photos/${storagePath}`;
  };

  const tablesWithPhotos = Array.from(new Set(photos.map((p) => p.table_number))).sort(
    (a, b) => a - b
  );

  const filteredPhotos = selectedFilterTable
    ? photos.filter((p) => p.table_number === selectedFilterTable)
    : photos;

  const handleDownload = async (url: string, filename: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, '_blank');
    }
  };

  const handleDownloadZip = async () => {
    if (filteredPhotos.length === 0 || isZipping) return;

    setIsZipping(true);
    abortZipRef.current = false;
    const total = filteredPhotos.length;
    setZipProgress({
      current: 0,
      total,
      percent: 0,
      status: `Iniciando descarga de ${total} fotos...`,
    });

    try {
      const zip = new JSZip();
      const folderName = `${event.title.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'Album'}`;
      const imgFolder = zip.folder(folderName) || zip;

      const concurrency = 3;
      let completed = 0;

      for (let i = 0; i < filteredPhotos.length; i += concurrency) {
        if (abortZipRef.current) {
          throw new Error('Descarga cancelada por el usuario');
        }

        const chunk = filteredPhotos.slice(i, i + concurrency);
        await Promise.all(
          chunk.map(async (photo) => {
            const photoUrl = getPhotoUrl(photo.storage_path);
            try {
              const res = await fetch(photoUrl);
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              const blob = await res.blob();

              const safeName = photo.uploader_name.replace(/[^a-zA-Z0-9_\-]/g, '_') || 'Invitado';
              const cleanFileName = `Mesa_${photo.table_number}_${safeName}_${photo.id.slice(0, 6)}.jpg`;
              imgFolder.file(cleanFileName, blob);
            } catch (err) {
              console.warn(`Error al descargar foto ${photo.id}:`, err);
            } finally {
              completed++;
              setZipProgress({
                current: completed,
                total,
                percent: Math.round((completed / total) * 80),
                status: `Descargando imagen ${completed} de ${total}...`,
              });
            }
          })
        );
      }

      setZipProgress({
        current: total,
        total,
        percent: 85,
        status: 'Comprimiendo archivo ZIP...',
      });

      const zipBlob = await zip.generateAsync(
        {
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 },
        },
        (metadata) => {
          setZipProgress({
            current: total,
            total,
            percent: 85 + Math.round(metadata.percent * 0.15),
            status: `Comprimiendo archivo ZIP (${Math.round(metadata.percent)}%)...`,
          });
        }
      );

      const safeTitle = event.title.replace(/[^a-zA-Z0-9_\-]/g, '_');
      const filename = `Album-${safeTitle}.zip`;
      const blobUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      setZipProgress({
        current: total,
        total,
        percent: 100,
        status: '¡Descarga completada con éxito!',
      });
      setTimeout(() => {
        setIsZipping(false);
        setZipProgress(null);
      }, 2500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al generar el ZIP';
      alert(msg);
      setIsZipping(false);
      setZipProgress(null);
    }
  };

  const handleShare = () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({
        title: `Álbum Digital: ${event.title}`,
        text: `Mirá todas las fotos de ${event.title} tomadas en vivo desde las mesas`,
        url: window.location.href,
      }).catch(() => {});
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      alert('¡Enlace del álbum copiado al portapapeles!');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 min-h-screen flex flex-col justify-between">
      <div>
        {/* Header Banner */}
        <header className="glass-panel rounded-3xl p-6 sm:p-8 text-center relative overflow-hidden border-zinc-800 mb-8">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-brand-500 via-purple-400 to-amber-400" />

          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-300 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Álbum Digital Oficial</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            {event.title}
          </h1>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-xs sm:text-sm text-zinc-400">
            <span>{venueName}</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-zinc-500" />
              {new Date(event.start_time).toLocaleDateString('es-AR', {
                dateStyle: 'long',
              })}
            </span>
            <span>•</span>
            <span className="font-semibold text-white">{photos.length} recuerdos capturados</span>
          </div>

          {/* Action Buttons: Share & Download ZIP */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold border border-zinc-700 transition-all shadow"
            >
              <Share2 className="w-3.5 h-3.5 text-brand-400" />
              <span>Compartir Álbum</span>
            </button>

            <button
              onClick={handleDownloadZip}
              disabled={isZipping || filteredPhotos.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-purple-600 hover:from-brand-500 hover:to-purple-500 text-white text-xs font-bold transition-all shadow-lg hover:shadow-brand-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isZipping ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <FolderDown className="w-4 h-4 text-white" />
              )}
              <span>
                {isZipping
                  ? 'Generando Archivo ZIP...'
                  : selectedFilterTable
                  ? `Descargar Mesa #${selectedFilterTable} (${filteredPhotos.length} fotos .ZIP)`
                  : `Descargar Todo el Álbum (${filteredPhotos.length} fotos .ZIP)`}
              </span>
            </button>
          </div>

          {/* ZIP Progress Indicator */}
          {zipProgress && (
            <div className="mt-6 max-w-md mx-auto p-4 rounded-2xl bg-zinc-900/90 border border-brand-500/30 text-left">
              <div className="flex items-center justify-between text-xs font-medium mb-2">
                <span className="text-zinc-300 flex items-center gap-1.5">
                  {zipProgress.percent === 100 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Loader2 className="w-4 h-4 animate-spin text-brand-400" />
                  )}
                  {zipProgress.status}
                </span>
                <span className="text-brand-300 font-bold">{zipProgress.percent}%</span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-brand-500 to-purple-500 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${zipProgress.percent}%` }}
                />
              </div>
              {isZipping && zipProgress.percent < 100 && (
                <button
                  onClick={() => {
                    abortZipRef.current = true;
                    setIsZipping(false);
                    setZipProgress(null);
                  }}
                  className="mt-2 text-[11px] text-zinc-500 hover:text-red-400 transition-colors"
                >
                  Cancelar descarga
                </button>
              )}
            </div>
          )}
        </header>

        {/* Table Filters */}
        {tablesWithPhotos.length > 1 && (
          <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            <button
              onClick={() => setSelectedFilterTable(null)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedFilterTable === null
                  ? 'bg-brand-600 text-white'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
              }`}
            >
              Todas las fotos ({photos.length})
            </button>
            {tablesWithPhotos.map((num) => (
              <button
                key={num}
                onClick={() => setSelectedFilterTable(num)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedFilterTable === num
                    ? 'bg-brand-600 text-white'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                }`}
              >
                Mesa #{num}
              </button>
            ))}
          </div>
        )}

        {/* Gallery Grid */}
        {filteredPhotos.length === 0 ? (
          <div className="glass-panel rounded-2xl p-12 text-center border-zinc-800">
            <p className="text-zinc-400 text-sm">No hay fotos aprobadas para mostrar en este álbum.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
            {filteredPhotos.map((photo) => {
              const url = getPhotoUrl(photo.storage_path);
              return (
                <div
                  key={photo.id}
                  onClick={() => setSelectedPhoto(photo)}
                  className="group relative aspect-square rounded-2xl overflow-hidden glass-card border-zinc-800/80 cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:border-brand-500/50"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Foto de ${photo.uploader_name}`}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                    <span className="text-xs font-bold text-white truncate drop-shadow">
                      {photo.uploader_name}
                    </span>
                    <span className="text-[10px] text-zinc-300">Mesa #{photo.table_number}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fullscreen Photo Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-4xl w-full max-h-[92vh] glass-panel rounded-3xl p-4 sm:p-6 border-zinc-700 flex flex-col items-center">
            {/* Modal Header */}
            <div className="w-full flex items-center justify-between mb-3 px-2">
              <span className="px-3 py-1 rounded-full bg-brand-600/30 text-brand-300 border border-brand-500/40 text-xs font-bold">
                Mesa #{selectedPhoto.table_number}
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    handleDownload(
                      getPhotoUrl(selectedPhoto.storage_path),
                      `Foto-${event.title}-Mesa${selectedPhoto.table_number}-${selectedPhoto.uploader_name}.jpg`
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold border border-zinc-700 transition-all"
                >
                  <Download className="w-3.5 h-3.5 text-brand-400" />
                  <span>Descargar</span>
                </button>

                <button
                  onClick={() => setSelectedPhoto(null)}
                  className="p-1.5 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Image */}
            <div className="relative w-full max-h-[68vh] rounded-2xl overflow-hidden bg-black flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getPhotoUrl(selectedPhoto.storage_path)}
                alt={`Foto de ${selectedPhoto.uploader_name}`}
                className="max-h-[68vh] w-auto object-contain rounded-xl"
              />
            </div>

            {/* Modal Caption & Details */}
            <div className="mt-3 text-center">
              {selectedPhoto.caption && (
                <p className="text-sm sm:text-base text-amber-200 font-medium italic mb-1">
                  &quot;{selectedPhoto.caption}&quot;
                </p>
              )}
              <h3 className="text-base sm:text-lg font-bold text-white">
                {selectedPhoto.uploader_name}
              </h3>
              <p className="text-xs text-zinc-400">
                Capturado a las{' '}
                {new Date(selectedPhoto.created_at).toLocaleTimeString('es-AR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                desde la Mesa #{selectedPhoto.table_number}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-12 text-center text-xs text-zinc-500 py-4 border-t border-zinc-900">
        Álbum digital generado por QR Imágenes Dinámicas • {event.title}
      </footer>
    </div>
  );
}
