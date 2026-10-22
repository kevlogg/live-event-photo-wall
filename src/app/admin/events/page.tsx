import { createAdminClient } from '@/lib/supabase/admin';
import AdminDashboardClient from './AdminDashboardClient';
import type { Venue, Event } from '@/types/database';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminEventsPage() {
  const supabase = createAdminClient();

  // 1. Fetch Venues and physical tables counts
  const { data: venuesData } = await supabase
    .from('venues')
    .select('*, physical_tables(count)')
    .order('created_at', { ascending: false });

  // 2. Fetch Events with Venue info
  const { data: eventsData } = await supabase
    .from('events')
    .select('*, venues(id, name, slug)')
    .order('created_at', { ascending: false });

  // Format venues with table counts
  const venues =
    venuesData?.map((v) => {
      const tablesCount = Array.isArray(v.physical_tables)
        ? (v.physical_tables[0] as unknown as { count: number })?.count || 0
        : 0;
      return {
        id: v.id,
        name: v.name,
        slug: v.slug,
        created_at: v.created_at,
        totalTables: tablesCount,
      };
    }) || [];

  // Format events
  const events =
    eventsData?.map((e) => {
      const venueObj = e.venues as unknown as { id: string; name: string; slug: string };
      return {
        id: e.id,
        venue_id: e.venue_id,
        title: e.title,
        start_time: e.start_time,
        end_time: e.end_time,
        active_tables_count: e.active_tables_count,
        is_active: e.is_active,
        created_at: e.created_at,
        venue: {
          id: venueObj?.id || e.venue_id,
          name: venueObj?.name || 'Salón',
          slug: venueObj?.slug || 'salon',
        },
      };
    }) || [];

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <AdminDashboardClient venues={venues} events={events} />
    </main>
  );
}
