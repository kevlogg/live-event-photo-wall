'use client';

import React, { useState, useEffect, useRef } from 'react';
import imageCompression from 'browser-image-compression';
import { createClient } from '@/lib/supabase/client';
import { registerPhotoAction } from '@/server/actions/photos';
import {
  Camera,
  UploadCloud,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  Loader2,
  RefreshCw,
  User,
  Image as ImageIcon,
} from 'lucide-react';

interface GuestUploadClientProps {
  eventId: string;
  eventTitle: string;
  venueName: string;
  tableNumber: number;
}

export default function GuestUploadClient({
  eventId,
  eventTitle,
  venueName,
  tableNumber,
}: GuestUploadClientProps) {
  const [uploaderName, setUploaderName] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [compressionProgress, setCompressionProgress] = useState<number>(0);
  const [stepStatus, setStepStatus] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number>(0);
  const [recentUploads, setRecentUploads] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Restore remembered guest name
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedName = localStorage.getItem('guest_uploader_name');
      if (savedName) {
        setUploaderName(savedName);
      }
    }
  }, []);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setUploaderName(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('guest_uploader_name', val);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Por favor selecciona un archivo de imagen válido');
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleReset = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setStepStatus('');
    setCompressionProgress(0);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setErrorMessage('Selecciona o saca una foto primero');
      return;
    }

    const trimmedName = uploaderName.trim() || 'Invitado';

    try {
      setIsProcessing(true);
      setErrorMessage(null);
      setStepStatus('Optimizando foto para el proyector...');

      // 1. Client-Side Image Compression with Web Worker
      const compressionOptions = {
        maxSizeMB: 1.2,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        onProgress: (progress: number) => {
          setCompressionProgress(progress);
        },
      };

      const compressedFile = await imageCompression(selectedFile, compressionOptions);

      setStepStatus('Subiendo a la pantalla en vivo...');
      const supabase = createClient();

      // 2. Direct Supabase Storage Upload
      const fileExt = compressedFile.type.split('/')[1] || 'jpg';
      const fileName = `${eventId}/${Date.now()}-table${tableNumber}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('event-photos')
        .upload(fileName, compressedFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: compressedFile.type,
        });

      if (uploadError || !uploadData) {
        throw new Error(uploadError?.message || 'Error al subir la imagen al servidor');
      }

      // 3. Register Photo in PostgreSQL via Server Action with event validation
      setStepStatus('Mostrando en la pantalla gigante...');
      const registerRes = await registerPhotoAction({
        eventId,
        tableNumber,
        storagePath: uploadData.path,
        uploaderName: trimmedName,
      });

      if (!registerRes.success) {
        throw new Error(registerRes.error || 'Error al registrar foto en la base de datos');
      }

      // 4. Success State
      const { data: publicUrlData } = supabase.storage
        .from('event-photos')
        .getPublicUrl(uploadData.path);

      setRecentUploads((prev) => [publicUrlData.publicUrl, ...prev]);
      setSuccessCount((prev) => prev + 1);
      handleReset();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado durante la subida';
      setErrorMessage(msg);
    } finally {
      setIsProcessing(false);
      setStepStatus('');
    }
  };

  return (
    <div className="max-w-md mx-auto w-full min-h-screen flex flex-col justify-between p-4 sm:p-5">
      {/* Top Header Card */}
      <div>
        <header className="glass-panel rounded-2xl p-4 sm:p-5 text-center relative overflow-hidden border-zinc-800">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-500 via-purple-400 to-amber-400" />
          
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider truncate max-w-[180px]">
              {venueName}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-brand-500/20 border border-brand-500/40 text-brand-300 font-bold text-xs tracking-tight">
              Mesa #{tableNumber}
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug">
            {eventTitle}
          </h1>

          <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-amber-300/90 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>Tus fotos se proyectan en vivo en el salón</span>
          </div>
        </header>

        {/* Guest Input Form & Photo Capture */}
        <div className="mt-4 space-y-4">
          {/* Uploader Name Field */}
          <div className="glass-card rounded-xl p-3 border-zinc-800">
            <label className="block text-xs font-semibold text-zinc-400 mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-brand-400" />
              <span>Tu Nombre o Apodo (aparecerá en pantalla)</span>
            </label>
            <input
              type="text"
              value={uploaderName}
              onChange={handleNameChange}
              placeholder="Ej. Sofi, Martín, Tío Jorge..."
              maxLength={30}
              className="w-full bg-zinc-900/90 border border-zinc-700/80 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
            />
          </div>

          {/* Error Notice */}
          {errorMessage && (
            <div className="rounded-xl bg-red-950/50 border border-red-500/40 p-3 flex items-start gap-2.5 text-red-200 text-xs">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Photo Preview or Capture Area */}
          {!previewUrl ? (
            <div className="glass-panel rounded-2xl p-6 text-center border-dashed border-2 border-zinc-700 hover:border-brand-500/50 transition-all">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
                id="camera-input"
              />

              <div className="w-16 h-16 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-400 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-brand-500/10">
                <Camera className="w-8 h-8" />
              </div>

              <h2 className="text-base font-bold text-white mb-1">
                Sacar foto o elegir de la galería
              </h2>
              <p className="text-xs text-zinc-400 mb-5 max-w-xs mx-auto">
                Capturá un momento divertido de la mesa y miralo aparecer en la pantalla gigante.
              </p>

              <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
                <label
                  htmlFor="camera-input"
                  className="cursor-pointer inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-brand-600 to-purple-600 hover:from-brand-500 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-brand-900/30 transition-all active:scale-95"
                >
                  <Camera className="w-4 h-4" />
                  <span>Abrir Cámara</span>
                </label>

                <label
                  htmlFor="camera-input"
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.removeAttribute('capture');
                    }
                  }}
                  className="cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 font-medium text-sm transition-all"
                >
                  <ImageIcon className="w-4 h-4 text-zinc-400" />
                  <span>Galería</span>
                </label>
              </div>
            </div>
          ) : (
            <div className="glass-panel rounded-2xl p-4 border-zinc-700 overflow-hidden">
              <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3] flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Vista previa de foto"
                  className="w-full h-full object-contain"
                />
                <button
                  onClick={handleReset}
                  disabled={isProcessing}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-zinc-900/80 text-zinc-300 hover:text-white backdrop-blur-md"
                  aria-label="Cancelar foto"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {/* Progress and status */}
              {isProcessing && (
                <div className="mt-3 space-y-1.5">
                  <div className="flex justify-between text-xs text-zinc-300 font-medium">
                    <span>{stepStatus}</span>
                    <span>{compressionProgress > 0 ? `${compressionProgress}%` : ''}</span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-brand-500 to-purple-400 transition-all duration-200"
                      style={{ width: `${Math.max(compressionProgress, 25)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Upload CTA */}
              <div className="mt-4 flex gap-2">
                <button
                  onClick={handleReset}
                  disabled={isProcessing}
                  className="flex-1 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-semibold transition-all disabled:opacity-50"
                >
                  Sacar otra
                </button>
                <button
                  onClick={handleUpload}
                  disabled={isProcessing}
                  className="flex-[2] py-3 rounded-xl bg-gradient-to-r from-brand-600 via-purple-600 to-amber-500 hover:opacity-95 text-white text-sm font-bold shadow-lg shadow-brand-900/40 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Proyectando...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      <span>¡Enviar a la Pantalla!</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Success Badge */}
          {successCount > 0 && (
            <div className="glass-panel rounded-xl p-3 border-emerald-500/40 bg-emerald-950/20 text-center animate-fade-in">
              <div className="inline-flex items-center gap-1.5 text-emerald-300 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>
                  ¡Foto enviada con éxito! Aparecerá en el Live Wall en instantes.
                </span>
              </div>
            </div>
          )}

          {/* Recent Uploads from this session */}
          {recentUploads.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-zinc-400 mb-2">
                Tus fotos enviadas ({recentUploads.length})
              </p>
              <div className="grid grid-cols-4 gap-2">
                {recentUploads.map((url, idx) => (
                  <div
                    key={idx}
                    className="aspect-square rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Foto enviada #${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <footer className="mt-6 text-center text-[11px] text-zinc-500 pb-2">
        Mesa #{tableNumber} • Transmisión en vivo al salón
      </footer>
    </div>
  );
}
