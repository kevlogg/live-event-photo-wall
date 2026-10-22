import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import LiveWallClient from './LiveWallClient';
import type { Photo } from '@/types/database';

interface PageProps {
  params: Promise<{
    event_id: string;
  }>;
}

export const dynamic = 'force-dynamic';

export default async function LiveWallPage({ params }: PageProps) {
  const { event_id: eventId } = await params;
  const supabase = createAdminClient();

  // 1. Fetch Event & Venue info
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, title, is_active, venues(name)')
    .eq('id', eventId)
    .single();

  if (eventError || !event) {
    notFound();
  }

  // 2. Fetch Initial Approved Photos
  const { data: photos } = await supabase
    .from('photos')
    .select('*')
    .eq('event_id', eventId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(50);

  const venueName = (event.venues as unknown as { name?: string })?.name || 'Salón Principal';
  const supabaseStorageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

  return (
    <LiveWallClient
      eventId={event.id}
      eventTitle={event.title}
      venueName={venueName}
      initialPhotos={(photos as Photo[]) || []}
      supabaseStorageUrl={supabaseStorageUrl}
    />
  );
}
