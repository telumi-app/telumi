import { z } from 'zod';

export const createLocationSchema = z
  .object({
    name: z
      .string()
      .min(3, 'O nome deve ter no mínimo 3 caracteres.')
      .max(40, 'O nome deve ter no máximo 40 caracteres.'),
    address: z.string().max(200).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(2).optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    placeId: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    const hasLatitude = value.latitude !== undefined;
    const hasLongitude = value.longitude !== undefined;

    if (hasLatitude !== hasLongitude) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Latitude e longitude devem ser informadas juntas.',
        path: ['latitude'],
      });
    }
  });

export type CreateLocationFormData = z.infer<typeof createLocationSchema>;
