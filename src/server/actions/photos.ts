'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { registerPhotoSchema, type RegisterPhotoInput } from '@/schemas';
import type { ActionResult } from './venues';
import type { Photo } from '@/types/database';

export async function registerPhotoAction(
  rawInput: RegisterPhotoInput
): Promise<ActionResult<Photo>> {
  const parsed = registerPhotoSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors.map((e) => e.message).join(', '),
    };
  }

  const { eventId, tableNumber, storagePath, uploaderName } = parsed.data;
  const supabase = createAdminClient();

  try {
    // 1. Verify Event Validity
    const nowIso = new Date().toISOString();
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, is_active, start_time, end_time, active_tables_count')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return { success: false, error: 'Evento no encontrado' };
    }

    if (!event.is_active) {
      return { success: false, error: 'El evento no se encuentra activo en este momento' };
    }

    if (nowIso < event.start_time || nowIso > event.end_time) {
      return { success: false, error: 'La fiesta está fuera de la ventana horaria autorizada' };
    }

    if (tableNumber > event.active_tables_count) {
      return { success: false, error: `La mesa #${tableNumber} no está habilitada para esta fiesta` };
    }

    // 2. Insert Photo Record
    const { data: photo, error: insertError } = await supabase
      .from('photos')
      .insert({
        event_id: eventId,
        table_number: tableNumber,
        storage_path: storagePath,
        uploader_name: uploaderName,
        status: 'approved',
      })
      .select('*')
      .single();

    if (insertError || !photo) {
      return { success: false, error: insertError?.message || 'Error al registrar la foto' };
    }

    return {
      success: true,
      data: photo,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno al procesar foto';
    return { success: false, error: message };
  }
}
