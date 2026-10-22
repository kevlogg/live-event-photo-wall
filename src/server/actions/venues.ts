'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createVenueSchema, type CreateVenueInput } from '@/schemas';
import { generateTableToken } from '@/lib/tokens';

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function createVenueAction(
  rawInput: CreateVenueInput
): Promise<ActionResult<{ venueId: string; slug: string; totalTables: number }>> {
  const parsed = createVenueSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors.map((e) => e.message).join(', '),
    };
  }

  const { name, slug, totalTables } = parsed.data;
  const supabase = createAdminClient();

  try {
    // 1. Insert Venue
    const { data: venue, error: venueError } = await supabase
      .from('venues')
      .insert({ name, slug })
      .select('id, slug')
      .single();

    if (venueError || !venue) {
      if (venueError?.code === '23505') {
        return { success: false, error: 'Ya existe un salón con ese slug identificador' };
      }
      return { success: false, error: venueError?.message || 'Error al crear el salón' };
    }

    // 2. Generate Batch Physical Tables with Tokens
    const tablesPayload = Array.from({ length: totalTables }, (_, idx) => {
      const tableNumber = idx + 1;
      return {
        venue_id: venue.id,
        table_number: tableNumber,
        token_hash: generateTableToken(venue.slug, tableNumber),
      };
    });

    const { error: tablesError } = await supabase
      .from('physical_tables')
      .insert(tablesPayload);

    if (tablesError) {
      // Rollback venue if table generation fails
      await supabase.from('venues').delete().eq('id', venue.id);
      return { success: false, error: `Error al generar mesas: ${tablesError.message}` };
    }

    revalidatePath('/admin/events');

    return {
      success: true,
      data: {
        venueId: venue.id,
        slug: venue.slug,
        totalTables,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno del servidor';
    return { success: false, error: message };
  }
}
