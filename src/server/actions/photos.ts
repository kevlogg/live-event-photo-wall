'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  registerPhotoSchema,
  moderatePhotoSchema,
  type RegisterPhotoInput,
  type ModeratePhotoInput,
} from '@/schemas';
import type { ActionResult } from './venues';
import type { Photo, PhotoStatus } from '@/types/database';
import { evaluatePhotoSafety } from '@/lib/safety';

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

  const { eventId, tableNumber, storagePath, uploaderName, caption } = parsed.data;
  const supabase = createAdminClient();

  try {
    // 1. Verify Event Validity
    const nowIso = new Date().toISOString();
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, is_active, start_time, end_time, active_tables_count, moderation_mode')
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

    // 2. Check if table is blocked
    const { data: blocked } = await supabase
      .from('blocked_tables')
      .select('id')
      .eq('event_id', eventId)
      .eq('table_number', tableNumber)
      .maybeSingle();

    if (blocked) {
      return {
        success: false,
        error: `La mesa #${tableNumber} fue silenciada por el moderador del salón`,
      };
    }

    // 3. Safety Evaluation (AI & NLP Filter)
    const { data: publicUrlData } = supabase.storage
      .from('event-photos')
      .getPublicUrl(storagePath);

    const safetyResult = await evaluatePhotoSafety({
      uploaderName,
      caption,
      storagePath,
      publicImageUrl: publicUrlData?.publicUrl,
    });

    // If event is strict, or if AI/safety flagged suspicious content -> hold in pending
    let initialStatus: PhotoStatus = 'approved';
    if (event.moderation_mode === 'strict' || !safetyResult.isSafe) {
      initialStatus = 'pending';
    }

    // 4. Insert Photo Record
    const { data: photo, error: insertError } = await supabase
      .from('photos')
      .insert({
        event_id: eventId,
        table_number: tableNumber,
        storage_path: storagePath,
        uploader_name: uploaderName,
        caption: caption || null,
        status: initialStatus,
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

export async function moderatePhotoAction(
  rawInput: ModeratePhotoInput
): Promise<ActionResult<{ photoId: string; status: PhotoStatus }>> {
  const parsed = moderatePhotoSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors.map((e) => e.message).join(', '),
    };
  }

  const { photoId, status } = parsed.data;
  const supabase = createAdminClient();

  try {
    const { data: photo, error } = await supabase
      .from('photos')
      .update({ status })
      .eq('id', photoId)
      .select('id, event_id, status')
      .single();

    if (error || !photo) {
      return { success: false, error: error?.message || 'Error al moderar la foto' };
    }

    revalidatePath(`/admin/events/${photo.event_id}/moderate`);

    return {
      success: true,
      data: { photoId: photo.id, status: photo.status },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno en la moderación';
    return { success: false, error: message };
  }
}
