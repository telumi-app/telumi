import { z } from 'zod';

const deviceOrientationSchema = z.enum(['HORIZONTAL', 'VERTICAL']);
const deviceOperationalStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);

export const createDeviceSchema = z.object({
  name: z
    .string()
    .min(3, 'O nome deve ter no mínimo 3 caracteres.')
    .max(40, 'O nome deve ter no máximo 40 caracteres.'),
  locationId: z.string().min(1, 'Selecione um local.'),
  orientation: deviceOrientationSchema,
  resolution: z
    .string()
    .min(1, 'Selecione uma resolução.')
    .max(30, 'A resolução deve ter no máximo 30 caracteres.'),
  operationalStatus: deviceOperationalStatusSchema,
  isPublic: z.boolean(),
  isPartnerTv: z.boolean().optional().default(false),
  partnerName: z.string().max(80, 'O nome do parceiro deve ter no máximo 80 caracteres.').optional(),
  partnerRevenueSharePct: z
    .number()
    .min(0, 'O percentual de repasse deve ser >= 0.')
    .max(100, 'O percentual de repasse deve ser <= 100.')
    .optional(),
});

export type CreateDeviceFormData = z.infer<typeof createDeviceSchema>;
export type DeviceOrientation = z.infer<typeof deviceOrientationSchema>;
export type DeviceOperationalStatus = z.infer<typeof deviceOperationalStatusSchema>;
