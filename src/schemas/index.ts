import { z } from 'zod';

export const createVenueSchema = z.object({
  name: z.string().min(2, 'El nombre del salón debe tener al menos 2 caracteres').max(100),
  slug: z
    .string()
    .min(2, 'El slug debe tener al menos 2 caracteres')
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'El slug solo puede contener letras minúsculas, números y guiones'),
  totalTables: z
    .number()
    .int('La cantidad de mesas debe ser un número entero')
    .min(1, 'Debe haber al menos 1 mesa')
    .max(500, 'Máximo 500 mesas por salón'),
});

export type CreateVenueInput = z.infer<typeof createVenueSchema>;

export const createEventSchema = z
  .object({
    venueId: z.string().uuid('ID de salón inválido'),
    title: z.string().min(3, 'El título del evento debe tener al menos 3 caracteres').max(150),
    startTime: z.string().datetime({ message: 'Fecha y hora de inicio inválida' }),
    endTime: z.string().datetime({ message: 'Fecha y hora de fin inválida' }),
    activeTablesCount: z
      .number()
      .int()
      .min(1, 'Debe haber al menos 1 mesa activa')
      .max(500, 'Excede el límite máximo de mesas'),
    isActive: z.boolean().default(false),
    moderationMode: z.enum(['auto_approve', 'strict']).default('auto_approve'),
  })
  .refine(
    (data) => new Date(data.endTime) > new Date(data.startTime),
    {
      message: 'La hora de finalización debe ser posterior a la de inicio',
      path: ['endTime'],
    }
  );

export type CreateEventInput = z.infer<typeof createEventSchema>;

export const toggleEventStatusSchema = z.object({
  eventId: z.string().uuid('ID de evento inválido'),
  isActive: z.boolean(),
});

export type ToggleEventStatusInput = z.infer<typeof toggleEventStatusSchema>;

export const updateModerationModeSchema = z.object({
  eventId: z.string().uuid('ID de evento inválido'),
  moderationMode: z.enum(['auto_approve', 'strict']),
});

export type UpdateModerationModeInput = z.infer<typeof updateModerationModeSchema>;

export const updateActiveTablesSchema = z.object({
  eventId: z.string().uuid('ID de evento inválido'),
  activeTablesCount: z.number().int().min(1).max(500),
});

export type UpdateActiveTablesInput = z.infer<typeof updateActiveTablesSchema>;

export const registerPhotoSchema = z.object({
  eventId: z.string().uuid('ID de evento inválido'),
  tableNumber: z.number().int().min(1),
  storagePath: z.string().min(5, 'Ruta de almacenamiento inválida'),
  uploaderName: z.string().min(1, 'El nombre no puede estar vacío').max(50),
  caption: z.string().max(200, 'El mensaje no puede superar 200 caracteres').optional(),
});

export type RegisterPhotoInput = z.infer<typeof registerPhotoSchema>;

export const moderatePhotoSchema = z.object({
  photoId: z.string().uuid('ID de foto inválido'),
  status: z.enum(['approved', 'rejected']),
});

export type ModeratePhotoInput = z.infer<typeof moderatePhotoSchema>;

export const toggleTableBlockSchema = z.object({
  eventId: z.string().uuid('ID de evento inválido'),
  tableNumber: z.number().int().min(1),
  block: z.boolean(),
  reason: z.string().max(100).optional(),
});

export type ToggleTableBlockInput = z.infer<typeof toggleTableBlockSchema>;

export const scanTokenSchema = z.object({
  token: z.string().min(10, 'Token inválido').max(100),
});
