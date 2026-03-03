import { z } from 'zod';

export const goalProfileSchema = z.enum(['INTERNAL', 'ADS_SALES']);

export const screenCountSchema = z.enum([
  'ONE_TO_TWO',
  'THREE_TO_FIVE',
  'SIX_TO_TEN',
  'TEN_PLUS',
]);

const cnpjRegex = /^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/;

export const setupOnboardingSchema = z
  .object({
    companyName: z
      .string({ required_error: 'O nome da empresa é obrigatório.' })
      .min(2, 'O nome da empresa deve ter no mínimo 2 caracteres.')
      .max(120, 'O nome da empresa deve ter no máximo 120 caracteres.'),
    city: z
      .string({ required_error: 'A cidade é obrigatória.' })
      .min(2, 'A cidade deve ter no mínimo 2 caracteres.')
      .max(120, 'A cidade deve ter no máximo 120 caracteres.'),
    state: z
      .string({ required_error: 'O estado é obrigatório.' })
      .regex(/^[A-Z]{2}$/, 'Selecione um estado válido.'),
    screenCount: screenCountSchema,
    goalProfile: goalProfileSchema,
    wantsToSellImmediately: z.boolean().optional(),
    hasCnpj: z.boolean().optional(),
    cnpj: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.goalProfile !== 'ADS_SALES') {
      return;
    }

    if (typeof data.wantsToSellImmediately !== 'boolean') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe se pretende vender anúncios imediatamente.',
        path: ['wantsToSellImmediately'],
      });
    }

    if (typeof data.hasCnpj !== 'boolean') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe se possui CNPJ.',
        path: ['hasCnpj'],
      });
    }

    if (data.hasCnpj && (!data.cnpj || !cnpjRegex.test(data.cnpj))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe um CNPJ válido.',
        path: ['cnpj'],
      });
    }
  });

export type SetupOnboardingFormData = z.infer<typeof setupOnboardingSchema>;
