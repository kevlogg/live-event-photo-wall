import Link from 'next/link';
import {
  Sparkles,
  Camera,
  Tv,
  QrCode,
  Trophy,
  Flame,
  FolderDown,
  ArrowRight,
  Smartphone,
  MessageCircle,
} from 'lucide-react';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white relative overflow-hidden flex flex-col justify-between">
      {/* Background Neon Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[400px] bg-gradient-to-b from-brand-600/20 via-purple-600/10 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Navigation Header */}
      <header className="relative z-10 max-w-7xl mx-auto w-full px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-amber-400 p-0.5 shadow-lg shadow-brand-500/20">
            <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
              <Camera className="w-5 h-5 text-amber-300" />
            </div>
          </div>
          <span className="font-extrabold text-xl tracking-tight text-white">
            Anima tu <span className="text-brand-400">fiesta</span>
          </span>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pt-10 pb-6 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-300 text-xs font-semibold uppercase tracking-wider mb-6 animate-fade-in shadow-inner">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>La experiencia interactiva que enciende tu fiesta</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-tight">
          Tus invitados son los protagonistas,{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 via-purple-300 to-amber-300">
            la pantalla gigante es el show
          </span>
        </h1>

        <p className="mt-6 text-base sm:text-lg text-zinc-300 max-w-2xl mx-auto leading-relaxed">
          Tus invitados escanean el código QR de su mesa y comparten fotos o dedicatorias en vivo en la pantalla gigante.
          <span className="block mt-2 text-zinc-400 text-sm sm:text-base font-normal">
            Proyección en tiempo real, ranking de la mesa más fiestera y sin descargar ninguna aplicación.
          </span>
        </p>

        {/* Action Button - WhatsApp */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <a
            href="https://wa.me/5492235851419?text=Hola%20Kevin!%20Quiero%20solicitar%20el%20servicio%20de%20Anima%20tu%20fiesta%20para%20un%20evento"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl bg-gradient-to-r from-brand-600 via-purple-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white text-base font-bold shadow-xl shadow-brand-500/25 transition-all transform hover:-translate-y-0.5 group"
          >
            <MessageCircle className="w-5 h-5 text-emerald-300" />
            <span>Solicitar servicio</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </a>
        </div>
      </section>

      {/* 3 Step Experience Cards (Marketing focus) */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-10">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            ¿Cómo funciona en tu evento?
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Una dinámica simple, intuitiva y 100% participativa para grandes y chicos.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Escaneo fácil */}
          <div className="glass-panel rounded-3xl p-7 border-zinc-800 hover:border-brand-500/40 transition-all duration-300 flex flex-col justify-between group hover:shadow-xl hover:shadow-brand-500/10">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-brand-500/15 border border-brand-500/30 text-brand-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <QrCode className="w-7 h-7" />
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-brand-500/10 text-brand-300 text-[11px] font-bold uppercase tracking-wider mb-2">
                Paso 1
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Escaneá desde tu mesa</h3>
              <p className="text-sm text-zinc-300 leading-relaxed mb-4">
                Tus invitados solo apuntan la cámara de su celular al código QR del centro de mesa. Sin registros, sin contraseñas y sin descargar ninguna app.
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs text-brand-300 font-semibold pt-4 border-t border-zinc-800/80">
              <Smartphone className="w-4 h-4 text-brand-400" />
              <span>Funciona con cualquier celular</span>
            </div>
          </div>

          {/* Card 2: Proyección en vivo */}
          <div className="glass-panel rounded-3xl p-7 border-zinc-800 hover:border-amber-500/40 transition-all duration-300 flex flex-col justify-between group hover:shadow-xl hover:shadow-amber-500/10">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Tv className="w-7 h-7" />
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-500/10 text-amber-300 text-[11px] font-bold uppercase tracking-wider mb-2">
                Paso 2
              </div>
              <h3 className="text-xl font-bold text-white mb-2">En vivo en la pantalla gigante</h3>
              <p className="text-sm text-zinc-300 leading-relaxed mb-4">
                Cada foto y mensaje aparece en milisegundos en los proyectores o pantallas LED del salón con animaciones en vivo y efecto foto destacada.
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs text-amber-300 font-semibold pt-4 border-t border-zinc-800/80">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Transmisión instantánea en directo</span>
            </div>
          </div>

          {/* Card 3: Gamificación y Ranking */}
          <div className="glass-panel rounded-3xl p-7 border-zinc-800 hover:border-purple-500/40 transition-all duration-300 flex flex-col justify-between group hover:shadow-xl hover:shadow-purple-500/10">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Trophy className="w-7 h-7" />
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-purple-500/10 text-purple-300 text-[11px] font-bold uppercase tracking-wider mb-2">
                Paso 3
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Ranking de Mesas Más Fiesteras</h3>
              <p className="text-sm text-zinc-300 leading-relaxed mb-4">
                La pantalla premia la participación con un podio en vivo. Se desata una competencia divertida para ver qué mesa vive la noche con más energía.
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs text-purple-300 font-semibold pt-4 border-t border-zinc-800/80">
              <Flame className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span>Podio interactivo en tiempo real</span>
            </div>
          </div>
        </div>

        {/* Bonus Value Banner: Álbum Digital Completo */}
        <div className="mt-8 glass-panel rounded-3xl p-6 sm:p-8 border-zinc-800/90 bg-gradient-to-r from-zinc-900/90 via-purple-950/20 to-zinc-900/90 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-brand-500/20 text-brand-300 flex items-center justify-center flex-shrink-0">
              <FolderDown className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base sm:text-lg font-bold text-white">
                Álbum Digital Completo post-evento
              </h4>
              <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
                Al terminar la fiesta, los anfitriones se descargan todas las fotos tomadas por sus invitados en máxima calidad en un solo archivo .ZIP.
              </p>
            </div>
          </div>
          <div className="flex-shrink-0">
            <span className="px-4 py-2 rounded-xl bg-zinc-800/90 border border-zinc-700 text-xs font-bold text-zinc-200">
              Recuerdos para siempre
            </span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-zinc-900 py-6 text-center text-xs text-zinc-500">
        <a
          href="https://kevdev.net.ar"
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-400 hover:text-white transition-colors"
        >
          sistema desarrollado por <span className="text-zinc-200 font-semibold underline underline-offset-4 hover:text-brand-400 transition-colors">kevdev</span>
        </a>
      </footer>
    </main>
  );
}
