import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import ModerationClient from './ModerationClient';
import type { Event, Photo } from '@/types/database';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ModerationPortalPage({ params }: PageProps) {
  const { id: eventId } = await params;
  const supabase = createAdminClient();

  // 1. Fetch Event with Venue
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('*, venues(name)')
    .eq('id', eventId)
    .single();

  if (eventError || !event) {
    notFound();
  }

  // 2. Fetch Photos for this event
  const { data: photos } = await supabase
    .from('photos')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  // 3. Fetch Blocked Tables
  const { data: blockedTablesData } = await supabase
    .from('blocked_tables')
    .select('table_number')
    .eq('event_id', eventId);

  const blockedNumbers = blockedTablesData?.map((b) => b.table_number) || [];
  const venueName = (event.venues as unknown as { name?: string })?.name || 'Salón Principal';
  const supabaseStorageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <ModerationClient
        event={event as Event}
        venueName={venueName}
        initialPhotos={(photos as Photo[]) || []}
        initialBlockedTables={blockedNumbers}
        supabaseStorageUrl={supabaseStorageUrl}
      />
    </main>
  );
}
