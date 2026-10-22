'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  createEventSchema,
  toggleEventStatusSchema,
  updateActiveTablesSchema,
  type CreateEventInput,
  type ToggleEventStatusInput,
  type UpdateActiveTablesInput,
} from '@/schemas';
import type { ActionResult } from './venues';
import type { Event } from '@/types/database';

export async function createEventAction(
  rawInput: CreateEventInput
): Promise<ActionResult<Event>> {
  const parsed = createEventSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors.map((e) => e.message).join(', '),
    };
  }

  const { venueId, title, startTime, endTime, activeTablesCount, isActive } = parsed.data;
  const supabase = createAdminClient();

  try {
    // Verify venue exists and get maximum tables available
    const { count: maxTables, error: countError } = await supabase
      .from('physical_tables')
      .select('*', { count: 'exact', head: true })
      .eq('venue_id', venueId);

    if (countError) {
      return { success: false, error: 'No se pudo verificar la cantidad de mesas del salón' };
    }

    if (maxTables !== null && activeTablesCount > maxTables) {
      return {
        success: false,
        error: `El salón solo tiene ${maxTables} mesas físicas registradas`,
      };
    }

    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert({
        venue_id: venueId,
        title,
        start_time: startTime,
        end_time: endTime,
        active_tables_count: activeTablesCount,
        is_active: isActive,
      })
      .select('*')
      .single();

    if (eventError || !event) {
      return { success: false, error: eventError?.message || 'Error al programar la fiesta' };
    }

    revalidatePath('/admin/events');

    return {
      success: true,
      data: event,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno al crear evento';
    return { success: false, error: message };
  }
}

export async function toggleEventStatusAction(
  rawInput: ToggleEventStatusInput
): Promise<ActionResult<{ id: string; isActive: boolean }>> {
  const parsed = toggleEventStatusSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors.map((e) => e.message).join(', '),
    };
  }

  const { eventId, isActive } = parsed.data;
  const supabase = createAdminClient();

  try {
    const { error } = await supabase
      .from('events')
      .update({ is_active: isActive })
      .eq('id', eventId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/events');

    return {
      success: true,
      data: { id: eventId, isActive },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al alternar estado';
    return { success: false, error: message };
  }
}

export async function updateActiveTablesAction(
  rawInput: UpdateActiveTablesInput
): Promise<ActionResult<{ id: string; activeTablesCount: number }>> {
  const parsed = updateActiveTablesSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors.map((e) => e.message).join(', '),
    };
  }

  const { eventId, activeTablesCount } = parsed.data;
  const supabase = createAdminClient();

  try {
    const { error } = await supabase
      .from('events')
      .update({ active_tables_count: activeTablesCount })
      .eq('id', eventId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/events');

    return {
      success: true,
      data: { id: eventId, activeTablesCount },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al actualizar mesas activas';
    return { success: false, error: message };
  }
}
