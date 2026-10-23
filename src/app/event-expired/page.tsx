import Link from 'next/navigation';
import { Camera, Sparkles, Tv, ShieldCheck, CheckCircle2, ArrowRight, PartyPopper } from 'lucide-react';

interface PageProps {
  searchParams: Promise<{
    reason?: string;
    venue?: string;
    table?: string;
  }>;
}

export default async function EventExpiredPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const reason = params.reason;
  const table = params.table;

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-purple-950/20 to-zinc-950 flex flex-col justify-between p-4 sm:p-6 md:p-12">
      {/* Top Banner Notice */}
      <div className="max-w-2xl mx-auto w-full pt-4">
        <div className="glass-panel rounded-2xl p-4 sm:p-6 border-brand-500/30 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 w-24 h-24 bg-brand-500/10 rounded-full blur-2xl" />
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold mb-3">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            {reason === 'table-disabled'
              ? `Mesa #${table || ''} inactiva para este evento`
              : 'Mesa lista / Sin evento activo'}
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {reason === 'table-disabled'
              ? 'Esta mesa no está habilitada esta noche'
              : 'No hay fiesta activa en este momento'}
          </h1>
          <p className="mt-2 text-sm sm:text-base text-zinc-400">
            Los códigos QR de este salón son permanentes. En cuanto comience el próximo evento
            programado, al volver a escanearlo podrás compartir tus fotos directamente en la pantalla gigante.
          </p>
        </div>
      </div>

      {/* Main SaaS Pitch Section */}
      <div className="max-w-4xl mx-auto w-full my-8 sm:my-12">
        <div className="text-center mb-8 sm:mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-300 text-xs font-semibold uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5 text-brand-400" /> QR Imágenes Dinámicas
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            ¿Querés esta experiencia mágica en <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-amber-300">tu fiesta o boda</span>?
          </h2>
          <p className="mt-4 text-base sm:text-lg text-zinc-300 max-w-2xl mx-auto">
            Tus invitados escanean el QR de su mesa, sacan fotos y aparecen al instante en los proyectores y pantallas del salón. Sin descargar ninguna app.
          </p>
        </div>

        {/* Value Prop Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          <div className="glass-card rounded-2xl p-6 border-zinc-800 hover:border-brand-500/40 transition-all">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center mb-4">
              <Camera className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Cero Descargas</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              La Web App carga en menos de 1 segundo en cualquier celular iPhone o Android. Compresión automática de fotos ultrarrápida.
            </p>
          </div>

          <div className="glass-card rounded-2xl p-6 border-zinc-800 hover:border-brand-500/40 transition-all">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-4">
              <Tv className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Live Wall en Pantalla</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Conexión en tiempo real con Supabase Realtime. Transiciones cinematográficas y proyección automática para DJ y salón.
            </p>
          </div>

          <div className="glass-card rounded-2xl p-6 border-zinc-800 hover:border-brand-500/40 transition-all">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Kit Permanente</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              QRs fijos por mesa que el salón imprime una sola vez en el PDF Master y activa en cada fecha con un solo clic.
            </p>
          </div>
        </div>

        {/* Feature Checklist */}
        <div className="mt-8 glass-panel rounded-2xl p-6 border-zinc-800/80">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-zinc-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-brand-400 flex-shrink-0" />
              <span>Galería completa descargable en alta resolución post-evento</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-brand-400 flex-shrink-0" />
              <span>Identificación automática del número de mesa y autor</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-brand-400 flex-shrink-0" />
              <span>Panel de moderación en vivo para el organizador</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-brand-400 flex-shrink-0" />
              <span>Soporte 100% remoto y configuración en 2 minutos</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-10 text-center">
          <a
            href="https://wa.me/?text=Hola!%20Quiero%20contratar%20el%20Live%20Photo%20Wall%20para%20mi%20evento"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-brand-600 to-purple-600 hover:from-brand-500 hover:to-purple-500 text-white font-bold text-lg shadow-xl shadow-brand-900/40 transform hover:-translate-y-0.5 transition-all"
          >
            <PartyPopper className="w-5 h-5 text-amber-300" />
            <span>Contratar servicio para mi fiesta</span>
            <ArrowRight className="w-5 h-5" />
          </a>
          <p className="mt-3 text-xs text-zinc-500">
            Disponible para salones de fiestas, bodas, aniversarios y eventos corporativos.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center text-xs text-zinc-600 py-4 border-t border-zinc-900">
        © {new Date().getFullYear()} QR Imágenes Dinámicas SaaS — Gestión Remota Multitenant.
      </footer>
    </main>
  );
}
