import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Live Event Photo Wall | Experiencia Interactiva Multitenant',
  description: 'Plataforma SaaS de fotos en vivo para eventos y salones con proyección en tiempo real y QR permanente por mesa.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className="antialiased selection:bg-brand-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
