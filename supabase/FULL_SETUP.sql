-- ==============================================================================
-- QR IMÁGENES DINÁMICAS: FULL DATABASE SETUP & STORAGE CONFIGURATION
-- Copiar y pegar en: https://supabase.com/dashboard/project/tvlileisaabiguxvdvik/sql/new
-- ==============================================================================

-- 1. Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Limpieza de tablas previas (si existieran)
DROP TABLE IF EXISTS public.blocked_tables CASCADE;
DROP TABLE IF EXISTS public.photos CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.physical_tables CASCADE;
DROP TABLE IF EXISTS public.venues CASCADE;

-- 3. Tabla: VENUES (Salones de fiestas)
CREATE TABLE public.venues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX idx_venues_slug ON public.venues (slug);

-- 4. Tabla: PHYSICAL_TABLES (Mesas físicas y QRs permanentes)
CREATE TABLE public.physical_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    table_number INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_venue_table_number UNIQUE (venue_id, table_number),
    CONSTRAINT chk_positive_table_number CHECK (table_number > 0)
);

CREATE INDEX idx_physical_tables_token_hash ON public.physical_tables (token_hash);
CREATE INDEX idx_physical_tables_venue ON public.physical_tables (venue_id);

-- 5. Tabla: EVENTS (Eventos y fiestas)
CREATE TABLE public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    active_tables_count INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT false,
    moderation_mode TEXT NOT NULL DEFAULT 'auto_approve' CHECK (moderation_mode IN ('auto_approve', 'strict')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_event_time_window CHECK (end_time > start_time),
    CONSTRAINT chk_active_tables_positive CHECK (active_tables_count >= 0)
);

CREATE INDEX idx_events_lookup ON public.events (venue_id, is_active, start_time, end_time);
CREATE INDEX idx_events_venue ON public.events (venue_id);

-- 6. Tabla: BLOCKED_TABLES (Mesas bloqueadas por spam o mal comportamiento)
CREATE TABLE public.blocked_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    table_number INTEGER NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_event_blocked_table UNIQUE (event_id, table_number)
);

CREATE INDEX idx_blocked_tables_lookup ON public.blocked_tables (event_id, table_number);

-- 7. Tabla: PHOTOS (Fotos en vivo)
CREATE TABLE public.photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    table_number INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    uploader_name TEXT NOT NULL,
    caption TEXT,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'approved',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX idx_photos_event_status_created ON public.photos (event_id, status, created_at DESC);

-- Habilitar Realtime para fotos
ALTER TABLE public.photos REPLICA IDENTITY FULL;

BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE public.photos;
COMMIT;

-- 8. Storage: Bucket 'event-photos'
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'event-photos',
    'event-photos',
    true,
    15728640, -- 15MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 15728640,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

-- 9. Políticas de Seguridad (Row Level Security)
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.physical_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

-- Políticas Venues
CREATE POLICY "Public can view venues" ON public.venues FOR SELECT USING (true);
CREATE POLICY "Admins can manage venues" ON public.venues FOR ALL USING (true) WITH CHECK (true);

-- Políticas Physical Tables
CREATE POLICY "Public can view physical tables" ON public.physical_tables FOR SELECT USING (true);
CREATE POLICY "Admins can manage physical tables" ON public.physical_tables FOR ALL USING (true) WITH CHECK (true);

-- Políticas Events
CREATE POLICY "Public can view events" ON public.events FOR SELECT USING (true);
CREATE POLICY "Admins can manage events" ON public.events FOR ALL USING (true) WITH CHECK (true);

-- Políticas Blocked Tables
CREATE POLICY "Public can view blocked tables" ON public.blocked_tables FOR SELECT USING (true);
CREATE POLICY "Admins can manage blocked tables" ON public.blocked_tables FOR ALL USING (true) WITH CHECK (true);

-- Políticas Photos
CREATE POLICY "Public can view approved photos" ON public.photos FOR SELECT USING (status = 'approved');
CREATE POLICY "Admins can manage photos" ON public.photos FOR ALL USING (true) WITH CHECK (true);

-- Invitados pueden subir fotos si el evento está activo y la mesa no está bloqueada
CREATE POLICY "Guests can upload photos to active events"
    ON public.photos FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.events e
            WHERE e.id = event_id
              AND e.is_active = true
              AND timezone('utc'::text, now()) >= e.start_time
              AND timezone('utc'::text, now()) <= e.end_time
              AND table_number <= e.active_tables_count
        )
        AND NOT EXISTS (
            SELECT 1 FROM public.blocked_tables b
            WHERE b.event_id = event_id
              AND b.table_number = table_number
        )
    );

-- Políticas Storage
DROP POLICY IF EXISTS "Public can view event photos in storage" ON storage.objects;
DROP POLICY IF EXISTS "Public can upload compressed event photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete/update storage photos" ON storage.objects;

CREATE POLICY "Public can view event photos in storage" ON storage.objects FOR SELECT USING (bucket_id = 'event-photos');
CREATE POLICY "Public can upload compressed event photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'event-photos');
CREATE POLICY "Admins can delete/update storage photos" ON storage.objects FOR ALL USING (bucket_id = 'event-photos') WITH CHECK (bucket_id = 'event-photos');
