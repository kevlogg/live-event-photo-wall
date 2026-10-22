# Live Event Photo Wall SaaS

Plataforma SaaS de fotos en vivo para salones y eventos con gestión 100% remota, arquitectura Multitenant por Salones/Venues y exportación de PDFs Master por Salón.

---

## 🛠️ Stack Tecnológico
- **Framework:** Next.js 15 (App Router, Server Actions, Route Handlers).
- **Lenguaje:** TypeScript estricto con validaciones Zod.
- **Estilos:** Tailwind CSS con tokens de diseño semánticos y modo oscuro de alta gama.
- **Base de Datos & Storage:** Supabase (PostgreSQL, Row Level Security, Supabase Realtime y Storage bucket `event-photos`).
- **Compresión en Cliente:** `browser-image-compression` (Web Workers a 1920px max para proyectores, reduciendo el 90% del ancho de banda móvil).
- **Generación de PDFs:** `pdfkit` + `qrcode` para kits de mesas permanentes en alta resolución.

---

## 📁 Topología del Proyecto

```text
C:\development\live-event-photo-wall\
├── src\
│   ├── app\
│   │   ├── (marketing)\
│   │   ├── admin\
│   │   │   ├── events\
│   │   │   │   ├── AdminDashboardClient.tsx  # Dashboard con métricas, switches y modales
│   │   │   │   └── page.tsx                  # Server Component
│   │   │   └── venues\[id]\pdf\
│   │   │       └── route.ts                  # Route Handler: PDF Master (Mesa 1 a Mesa N)
│   │   ├── app\[event_id]\
│   │   │   ├── GuestUploadClient.tsx         # Web App móvil ultraliviana para invitados
│   │   │   └── page.tsx                      # Evaluador de evento activo en cliente
│   │   ├── event-expired\
│   │   │   └── page.tsx                      # Landing promocional de marketing
│   │   ├── live\[event_id]\
│   │   │   ├── LiveWallClient.tsx            # Live Wall para el proyector con Supabase Realtime
│   │   │   └── page.tsx                      # Server Component con fotos iniciales
│   │   ├── q\[token]\
│   │   │   └── page.tsx                      # Evaluador inteligente del escaneo QR
│   │   ├── globals.css                       # Variables semánticas y glassmorphism
│   │   ├── layout.tsx                        # Layout raíz
│   │   └── page.tsx                          # Presentación general de la plataforma
│   ├── lib\
│   │   ├── supabase\
│   │   │   ├── admin.ts                      # Cliente con Service Role Key
│   │   │   ├── client.ts                     # Cliente Browser para Storage y Realtime
│   │   │   └── server.ts                     # Cliente SSR con gestión de cookies
│   │   └── tokens.ts                         # Generador de hashes y tokens permanentes
│   ├── schemas\
│   │   └── index.ts                          # Esquemas Zod para Server Actions y formularios
│   ├── server\actions\
│   │   ├── events.ts                         # Server Actions para eventos y switches
│   │   ├── photos.ts                         # Server Actions para registrar fotos
│   │   └── venues.ts                         # Server Actions para crear salones y kits de mesas
│   └── types\
│       └── database.ts                       # Tipos de TypeScript del modelo de datos
├── supabase\migrations\
│   └── 20261022_initial_schema.sql           # Migración SQL completa con RLS y Realtime
├── .env.example
├── package.json
└── tsconfig.json
```

---

## 🚀 Puesta en Marcha

### 1. Variables de Entorno
Copia `.env.example` a `.env.local` y configura tus credenciales de Supabase:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 2. Migración de Base de Datos
Ejecuta el archivo [20261022_initial_schema.sql](file:///C:/development/live-event-photo-wall/supabase/migrations/20261022_initial_schema.sql) en el **SQL Editor** de tu consola de Supabase. Esto creará:
- Tablas `venues`, `physical_tables`, `events` y `photos`.
- Bucket de Storage `event-photos`.
- Políticas RLS y publicación en `supabase_realtime`.

### 3. Ejecución Local
```bash
npm run dev
```
Accede a `http://localhost:3000/admin/events` para comenzar a administrar salones y fiestas.
