import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { sanitizeToken } from '@/lib/tokens';

interface PageProps {
  params: Promise<{
    token: string;
  }>;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ScanEvaluatorPage({ params }: PageProps) {
  const { token } = await params;
  const cleanToken = sanitizeToken(token);

  if (!cleanToken) {
    redirect('/event-expired?reason=token-malformed');
  }

  const supabase = createAdminClient();

  // 1. Resolve Physical Table & Venue from Permanent Token
  const { data: physicalTable, error: tableError } = await supabase
    .from('physical_tables')
    .select('id, venue_id, table_number, venues(id, name, slug)')
    .eq('token_hash', cleanToken)
    .single();

  if (tableError || !physicalTable) {
    redirect('/event-expired?reason=qr-not-found');
  }

  const nowIso = new Date().toISOString();

  // 2. Query for currently active event in this venue within the time window
  const { data: activeEvents, error: eventError } = await supabase
    .from('events')
    .select('id, title, start_time, end_time, active_tables_count, is_active')
    .eq('venue_id', physicalTable.venue_id)
    .eq('is_active', true)
    .lte('start_time', nowIso)
    .gte('end_time', nowIso)
    .order('start_time', { ascending: false })
    .limit(1);

  if (eventError || !activeEvents || activeEvents.length === 0) {
    // No active event running right now in this venue
    redirect(
      `/event-expired?venue=${physicalTable.venue_id}&table=${physicalTable.table_number}&reason=inactive`
    );
  }

  const currentEvent = activeEvents[0];

  // 3. Check if table_number is within the event's active tables count
  if (physicalTable.table_number > currentEvent.active_tables_count) {
    redirect(
      `/event-expired?venue=${physicalTable.venue_id}&table=${physicalTable.table_number}&reason=table-disabled`
    );
  }

  // 4. Success: Redirect guest to lightweight Web App
  redirect(`/app/${currentEvent.id}?table=${physicalTable.table_number}`);
}
