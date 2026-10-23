-- ==============================================================================
-- QR IMÁGENES DINÁMICAS: SCHEMA MIGRATION & RLS POLICIES
-- Multi-tenant by Venues with Permanent Physical Table QRs & Realtime Photo Wall
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Clean Existing Schema (if any)
DROP TABLE IF EXISTS public.photos CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.physical_tables CASCADE;
DROP TABLE IF EXISTS public.venues CASCADE;

-- 3. Table: VENUES (Salones)
CREATE TABLE public.venues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for fast lookup by slug
CREATE INDEX idx_venues_slug ON public.venues (slug);

-- 4. Table: PHYSICAL_TABLES (QRs permanentes del salón)
CREATE TABLE public.physical_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    table_number INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_venue_table_number UNIQUE (venue_id, table_number),
    CONSTRAINT chk_positive_table_number CHECK (table_number > 0)
);

-- Index for QR scan token evaluation
CREATE INDEX idx_physical_tables_token_hash ON public.physical_tables (token_hash);
CREATE INDEX idx_physical_tables_venue ON public.physical_tables (venue_id);

-- 5. Table: EVENTS (Fiestas / Eventos programados)
CREATE TABLE public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    active_tables_count INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_event_time_window CHECK (end_time > start_time),
    CONSTRAINT chk_active_tables_positive CHECK (active_tables_count >= 0)
);

-- Indexes for active event evaluation during QR scan
CREATE INDEX idx_events_lookup ON public.events (venue_id, is_active, start_time, end_time);
CREATE INDEX idx_events_venue ON public.events (venue_id);

-- 6. Table: PHOTOS (Galería del evento en tiempo real)
CREATE TABLE public.photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    table_number INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    uploader_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'approved',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for Realtime Wall & Gallery queries
CREATE INDEX idx_photos_event_status_created ON public.photos (event_id, status, created_at DESC);

-- Enable Postgres Realtime for photos table
ALTER TABLE public.photos REPLICA IDENTITY FULL;

BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE public.photos;
COMMIT;

-- ==============================================================================
-- 7. SUPABASE STORAGE BUCKET CONFIGURATION
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'event-photos',
    'event-photos',
    true,
    15728640, -- 15MB max (compressed before upload on client)
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 15728640,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

-- ==============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.physical_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

-- Venues: Public can read, authenticated or service role can manage
CREATE POLICY "Public can view venues"
    ON public.venues FOR SELECT
    USING (true);

CREATE POLICY "Admins can manage venues"
    ON public.venues FOR ALL
    USING (auth.role() = 'service_role' OR auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- Physical Tables: Public can read for token resolution
CREATE POLICY "Public can view physical tables"
    ON public.physical_tables FOR SELECT
    USING (true);

CREATE POLICY "Admins can manage physical tables"
    ON public.physical_tables FOR ALL
    USING (auth.role() = 'service_role' OR auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- Events: Public can view active events
CREATE POLICY "Public can view events"
    ON public.events FOR SELECT
    USING (true);

CREATE POLICY "Admins can manage events"
    ON public.events FOR ALL
    USING (auth.role() = 'service_role' OR auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- Photos: Public can view approved photos
CREATE POLICY "Public can view approved photos"
    ON public.photos FOR SELECT
    USING (status = 'approved');

-- Photos: Public can insert if event is currently active and table within active_tables_count
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
    );

CREATE POLICY "Admins can manage photos"
    ON public.photos FOR ALL
    USING (auth.role() = 'service_role' OR auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- Storage Policies for 'event-photos' bucket
CREATE POLICY "Public can view event photos in storage"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'event-photos');

CREATE POLICY "Public can upload compressed event photos"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'event-photos'
    );

CREATE POLICY "Admins can delete/update storage photos"
    ON storage.objects FOR ALL
    USING (bucket_id = 'event-photos' AND (auth.role() = 'service_role' OR auth.role() = 'authenticated'))
    WITH CHECK (bucket_id = 'event-photos' AND (auth.role() = 'service_role' OR auth.role() = 'authenticated'));
