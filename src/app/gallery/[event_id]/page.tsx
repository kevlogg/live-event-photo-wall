import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import GalleryClient from './GalleryClient';
import type { Event, Photo } from '@/types/database';

interface PageProps {
  params: Promise<{
    event_id: string;
  }>;
}

export const dynamic = 'force-dynamic';

export default async function EventGalleryPage({ params }: PageProps) {
  const { event_id: eventId } = await params;
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

  // 2. Fetch all approved photos for album
  const { data: photos } = await supabase
    .from('photos')
    .select('*')
    .eq('event_id', eventId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  const venueName = (event.venues as unknown as { name?: string })?.name || 'Salón Principal';
  const supabaseStorageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <GalleryClient
        event={event as Event}
        venueName={venueName}
        photos={(photos as Photo[]) || []}
        supabaseStorageUrl={supabaseStorageUrl}
      />
    </main>
  );
}
