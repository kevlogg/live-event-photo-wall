'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Key } from 'lucide-react';

export default function AdminEventsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Admin events error:', error);
  }, [error]);

  const isSupabaseMissing =
    error.message?.includes('Supabase') ||
    error.message?.includes('environment variables');

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            {isSupabaseMissing ? <Key className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">
              {isSupabaseMissing ? 'Faltan credenciales de Supabase' : 'Error en el panel de eventos'}
            </h2>
            <p className="text-xs text-zinc-400">Panel Administrativo</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 text-xs text-zinc-300 mb-6 font-mono break-words">
          {error.message || 'Error del servidor al intentar inicializar Supabase.'}
        </div>

        {isSupabaseMissing && (
          <div className="mb-6 space-y-2 text-xs text-zinc-400">
            <p className="font-semibold text-zinc-300">Variables requeridas en Vercel / .env.local:</p>
            <ul className="list-disc list-inside space-y-1 text-zinc-400 font-mono text-[11px] bg-zinc-950 p-3 rounded-lg border border-zinc-800">
              <li>NEXT_PUBLIC_SUPABASE_URL</li>
              <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
              <li>SUPABASE_SERVICE_ROLE_KEY</li>
            </ul>
          </div>
        )}

        <button
          onClick={() => reset()}
          className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm transition-all shadow-lg shadow-brand-500/20 cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Reintentar conexión</span>
        </button>
      </div>
    </div>
  );
}
