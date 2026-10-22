import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import GuestUploadClient from './GuestUploadClient';

interface PageProps {
  params: Promise<{
    event_id: string;
  }>;
  searchParams: Promise<{
    table?: string;
  }>;
}

export const dynamic = 'force-dynamic';

export default async function GuestUploadPage({ params, searchParams }: PageProps) {
  const { event_id: eventId } = await params;
  const { table } = await searchParams;

  const tableNumber = parseInt(table || '1', 10);
  if (isNaN(tableNumber) || tableNumber <= 0) {
    redirect('/event-expired?reason=invalid-table');
  }

  const supabase = createAdminClient();

  // Fetch Event along with Venue details
  const { data: event, error } = await supabase
    .from('events')
    .select('id, title, is_active, start_time, end_time, active_tables_count, venues(id, name, slug)')
    .eq('id', eventId)
    .single();

  if (error || !event) {
    redirect('/event-expired?reason=event-not-found');
  }

  // Check if event is active and within window
  const nowIso = new Date().toISOString();
  if (
    !event.is_active ||
    nowIso < event.start_time ||
    nowIso > event.end_time ||
    tableNumber > event.active_tables_count
  ) {
    redirect(
      `/event-expired?venue=${(event.venues as unknown as { id: string })?.id || ''}&table=${tableNumber}&reason=event-inactive-or-table-disabled`
    );
  }

  const venueName = (event.venues as unknown as { name?: string })?.name || 'Salón Principal';

  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center">
      <GuestUploadClient
        eventId={event.id}
        eventTitle={event.title}
        venueName={venueName}
        tableNumber={tableNumber}
      />
    </main>
  );
}
