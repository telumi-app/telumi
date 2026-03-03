import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'O e-mail é obrigatório.' })
    .min(1, 'O e-mail é obrigatório.')
    .email('Informe um e-mail válido.'),
  password: z
    .string({ required_error: 'A senha é obrigatória.' })
    .min(1, 'A senha é obrigatória.')
    .min(8, 'A senha deve ter pelo menos 8 caracteres.'),
});

export const registerSchema = z
  .object({
    name: z
      .string({ required_error: 'O nome é obrigatório.' })
      .min(1, 'O nome é obrigatório.'),
    email: z
      .string({ required_error: 'O e-mail é obrigatório.' })
      .min(1, 'O e-mail é obrigatório.')
      .email('Informe um e-mail válido.'),
    password: z
      .string({ required_error: 'A senha é obrigatória.' })
      .min(1, 'A senha é obrigatória.')
      .min(8, 'A senha deve ter pelo menos 8 caracteres.'),
    confirmPassword: z
      .string({ required_error: 'Confirme sua senha.' })
      .min(1, 'Confirme sua senha.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não conferem.',
    path: ['confirmPassword'],
  });

export const forgotPasswordSchema = z.object({
  email: z
    .string({ required_error: 'O e-mail é obrigatório.' })
    .min(1, 'O e-mail é obrigatório.')
    .email('Informe um e-mail válido.'),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
