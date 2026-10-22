'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  createEventSchema,
  toggleEventStatusSchema,
  updateActiveTablesSchema,
  updateModerationModeSchema,
  toggleTableBlockSchema,
  type CreateEventInput,
  type ToggleEventStatusInput,
  type UpdateActiveTablesInput,
  type UpdateModerationModeInput,
  type ToggleTableBlockInput,
} from '@/schemas';
import type { ActionResult } from './venues';
import type { Event, ModerationMode } from '@/types/database';

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

  const { venueId, title, startTime, endTime, activeTablesCount, isActive, moderationMode } =
    parsed.data;
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
        moderation_mode: moderationMode,
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

export async function updateModerationModeAction(
  rawInput: UpdateModerationModeInput
): Promise<ActionResult<{ id: string; moderationMode: ModerationMode }>> {
  const parsed = updateModerationModeSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors.map((e) => e.message).join(', '),
    };
  }

  const { eventId, moderationMode } = parsed.data;
  const supabase = createAdminClient();

  try {
    const { error } = await supabase
      .from('events')
      .update({ moderation_mode: moderationMode })
      .eq('id', eventId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/events');
    revalidatePath(`/admin/events/${eventId}/moderate`);

    return {
      success: true,
      data: { id: eventId, moderationMode },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al cambiar modo de moderación';
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

export async function toggleTableBlockAction(
  rawInput: ToggleTableBlockInput
): Promise<ActionResult<{ eventId: string; tableNumber: number; isBlocked: boolean }>> {
  const parsed = toggleTableBlockSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors.map((e) => e.message).join(', '),
    };
  }

  const { eventId, tableNumber, block, reason } = parsed.data;
  const supabase = createAdminClient();

  try {
    if (block) {
      // 1. Insert into blocked_tables
      await supabase.from('blocked_tables').upsert({
        event_id: eventId,
        table_number: tableNumber,
        reason: reason || 'Bloqueado por el moderador',
      });

      // 2. Hide all existing photos from this table
      await supabase
        .from('photos')
        .update({ status: 'rejected' })
        .eq('event_id', eventId)
        .eq('table_number', tableNumber);
    } else {
      // Unblock table
      await supabase
        .from('blocked_tables')
        .delete()
        .eq('event_id', eventId)
        .eq('table_number', tableNumber);
    }

    revalidatePath(`/admin/events/${eventId}/moderate`);

    return {
      success: true,
      data: { eventId, tableNumber, isBlocked: block },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al modificar bloqueo de mesa';
    return { success: false, error: message };
  }
}
