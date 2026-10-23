import Link from 'next/link';
import {
  Sparkles,
  Camera,
  Tv,
  FileDown,
  Building2,
  CalendarDays,
  ShieldCheck,
  ArrowRight,
  QrCode,
  Layers,
} from 'lucide-react';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white relative overflow-hidden flex flex-col justify-between">
      {/* Background Neon Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[400px] bg-gradient-to-b from-brand-600/20 via-purple-600/10 to-transparent blur-3xl pointer-events-none" />

      {/* Navigation Header */}
      <header className="relative z-10 max-w-7xl mx-auto w-full px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-amber-400 p-0.5 shadow-lg shadow-brand-500/20">
            <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
              <Camera className="w-5 h-5 text-amber-300" />
            </div>
          </div>
          <span className="font-extrabold text-xl tracking-tight text-white">
            QR Imágenes <span className="text-brand-400">Dinámicas</span>
          </span>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 py-12 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-300 text-xs font-semibold uppercase tracking-wider mb-6 animate-fade-in">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>SaaS Multitenant para Salones de Fiestas y Eventos</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-tight">
          La experiencia de fotos en vivo{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 via-purple-300 to-amber-300">
            100% remota y en tiempo real
          </span>
        </h1>

        <p className="mt-6 text-base sm:text-xl text-zinc-300 max-w-2xl mx-auto leading-relaxed">
          Tus invitados escanean el código QR permanente de su mesa, suben fotos desde su celular sin instalar ninguna app y aparecen proyectadas al instante en las pantallas gigantes del salón.
        </p>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/event-expired"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white text-sm font-semibold border border-zinc-800 transition-all shadow"
          >
            <span>Ver Experiencia de Invitados</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Flow Cards */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Salón y PDF Master */}
          <div className="glass-panel rounded-2xl p-6 border-zinc-800 hover:border-brand-500/40 transition-all">
            <div className="w-12 h-12 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center mb-4">
              <Building2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">1. Salón y PDF Master</h3>
            <p className="text-sm text-zinc-400 leading-relaxed mb-4">
              Creá el salón, elegí la cantidad de mesas y descargá el PDF Master de alta resolución con las páginas de QRs permanentes listas para imprimir.
            </p>
            <div className="inline-flex items-center gap-1.5 text-xs text-brand-300 font-semibold">
              <FileDown className="w-3.5 h-3.5" />
              <span>Exportación instantánea en PDF</span>
            </div>
          </div>

          {/* Card 2: Activación Remota */}
          <div className="glass-panel rounded-2xl p-6 border-zinc-800 hover:border-amber-500/40 transition-all">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-4">
              <CalendarDays className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">2. Gestión Remota de Fiestas</h3>
            <p className="text-sm text-zinc-400 leading-relaxed mb-4">
              Configurá ventana horaria, cantidad de mesas activas y alterná el switch de activación. El evaluador inteligente redirige o muestra la landing promocional.
            </p>
            <div className="inline-flex items-center gap-1.5 text-xs text-amber-300 font-semibold">
              <Layers className="w-3.5 h-3.5" />
              <span>Control de mesas en tiempo real</span>
            </div>
          </div>

          {/* Card 3: Live Wall Proyector */}
          <div className="glass-panel rounded-2xl p-6 border-zinc-800 hover:border-purple-500/40 transition-all">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center mb-4">
              <Tv className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">3. Proyección en Pantalla</h3>
            <p className="text-sm text-zinc-400 leading-relaxed mb-4">
              El salón abre la vista Live Wall en el proyector. Cada foto se comprime en el celular del invitado y aparece al instante con animaciones y spotlight.
            </p>
            <div className="inline-flex items-center gap-1.5 text-xs text-purple-300 font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Supabase Realtime en vivo</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-zinc-900 py-6 text-center text-xs text-zinc-500">
        © {new Date().getFullYear()} QR Imágenes Dinámicas SaaS — Diseñado con Next.js App Router, TypeScript, Tailwind CSS y Supabase.
      </footer>
    </main>
  );
}
