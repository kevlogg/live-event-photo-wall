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
});

export type RegisterPhotoInput = z.infer<typeof registerPhotoSchema>;

export const scanTokenSchema = z.object({
  token: z.string().min(10, 'Token inválido').max(100),
});
