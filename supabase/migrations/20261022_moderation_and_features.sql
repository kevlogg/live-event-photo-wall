-- ==============================================================================
-- MIGRATION: MODERATION SUITE, CAPTIONS, KILL-SWITCH & BLOCKED TABLES
-- ==============================================================================

-- 1. Add moderation_mode to events
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS moderation_mode TEXT NOT NULL DEFAULT 'auto_approve' 
CHECK (moderation_mode IN ('auto_approve', 'strict'));

-- 2. Add caption to photos for guest wishes/messages
ALTER TABLE public.photos 
ADD COLUMN IF NOT EXISTS caption TEXT;

-- 3. Create table for blocked tables (spam or abusive table ban)
CREATE TABLE IF NOT EXISTS public.blocked_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    table_number INTEGER NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_event_blocked_table UNIQUE (event_id, table_number)
);

CREATE INDEX IF NOT EXISTS idx_blocked_tables_lookup ON public.blocked_tables (event_id, table_number);

-- 4. Enable RLS on blocked_tables
ALTER TABLE public.blocked_tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view blocked tables"
    ON public.blocked_tables FOR SELECT
    USING (true);

CREATE POLICY "Admins can manage blocked tables"
    ON public.blocked_tables FOR ALL
    USING (auth.role() = 'service_role' OR auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- 5. Update Guest Upload RLS Policy to check that table is NOT blocked
DROP POLICY IF EXISTS "Guests can upload photos to active events" ON public.photos;

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
