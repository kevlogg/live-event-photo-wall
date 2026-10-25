import { createAdminClient } from '@/lib/supabase/admin';
import AdminDashboardClient from './AdminDashboardClient';
import type { Venue, Event, ModerationMode } from '@/types/database';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminEventsPage() {
  let venues: { id: string; name: string; slug: string; created_at: string; totalTables: number }[] = [];
  let events: {
    id: string;
    venue_id: string;
    title: string;
    start_time: string;
    end_time: string;
    active_tables_count: number;
    is_active: boolean;
    moderation_mode: ModerationMode;
    created_at: string;
    venue: { id: string; name: string; slug: string };
  }[] = [];
  let configError: string | null = null;

  try {
    const supabase = createAdminClient();

    // 1. Fetch Venues and physical tables counts
    const { data: venuesData, error: venuesError } = await supabase
      .from('venues')
      .select('*, physical_tables(count)')
      .order('created_at', { ascending: false });

    if (venuesError) {
      console.error('Error fetching venues:', venuesError);
    }

    // 2. Fetch Events with Venue info
    const { data: eventsData, error: eventsError } = await supabase
      .from('events')
      .select('*, venues(id, name, slug)')
      .order('created_at', { ascending: false });

    if (eventsError) {
      console.error('Error fetching events:', eventsError);
    }

    // Format venues with table counts
    venues =
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
    events =
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
          moderation_mode: (e.moderation_mode as ModerationMode) || 'auto_approve',
          created_at: e.created_at,
          venue: {
            id: venueObj?.id || e.venue_id,
            name: venueObj?.name || 'Salón',
            slug: venueObj?.slug || 'salon',
          },
        };
      }) || [];
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al conectar con la base de datos';
    console.error('AdminEventsPage initialization error:', msg);
    configError = msg;
  }

  if (configError) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-zinc-900 border border-amber-500/30 rounded-3xl p-8 shadow-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-semibold mb-4 border border-amber-500/20">
            <span>Configuración Requerida</span>
          </div>
          <h1 className="text-xl font-bold mb-2 text-white">Variables de Supabase Faltantes</h1>
          <p className="text-sm text-zinc-400 mb-6">
            La aplicación necesita las variables de entorno de Supabase para consultar y guardar eventos.
          </p>
          <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-xs font-mono space-y-2 mb-6">
            <div className="text-zinc-500">Variables a configurar en Vercel:</div>
            <div className="text-amber-300">NEXT_PUBLIC_SUPABASE_URL</div>
            <div className="text-amber-300">NEXT_PUBLIC_SUPABASE_ANON_KEY</div>
            <div className="text-amber-300">SUPABASE_SERVICE_ROLE_KEY</div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <AdminDashboardClient venues={venues} events={events} />
    </main>
  );
}
