'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from '@telumi/ui';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { AuthCardShell } from '@/components/organisms/auth/auth-card-shell';
import { authApi } from '@/lib/api/auth';
import {
  type ForgotPasswordFormData,
  forgotPasswordSchema,
} from '@/lib/validation/auth';

const SUCCESS_MESSAGE =
  'Se existir uma conta com este e-mail, enviaremos as instruções para redefinir sua senha.';

export function ForgotPasswordForm() {
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const form = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
    mode: 'onChange',
  });

  const { watch } = form;
  const email = watch('email');
  const isFilled = email.length > 0;

  async function onSubmit(values: ForgotPasswordFormData) {
    setFeedbackMessage(null);
    try {
      const response = await authApi.forgotPassword({ email: values.email! });
      setFeedbackMessage(response.message ?? SUCCESS_MESSAGE);
      form.reset();
    } catch {
      setFeedbackMessage(SUCCESS_MESSAGE);
      form.reset();
    }
  }

  return (
    <AuthCardShell>
      <div className="flex flex-col inter w-full items-stretch bg-background">
        <header className="stack gap-1.5 xl:gap-2.5">
          <h1 className="font-waldenburg-ht text-2xl text-foreground font-semibold text-center mb-2">Esqueceu a senha</h1>
          <p className="text-sm text-muted-foreground text-center mb-7">
            Digite seu e-mail e enviaremos um link para redefinir sua senha.
          </p>
        </header>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="stack">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between mt-2.5 mb-1.5">
                    <FormLabel className="text-sm font-medium cursor-pointer text-foreground transition-all duration-150 ease-in-out">
                      E-mail
                    </FormLabel>
                    <FormMessage className="text-[11px] font-medium text-destructive mt-0 leading-none" />
                  </div>
                  <FormControl>
                    <Input
                      placeholder="voce@exemplo.com"
                      autoComplete="email"
                      className="flex w-full border border-input bg-transparent shadow-none transition-colors h-[46px] rounded-xl px-[16px] text-base md:text-sm focus-visible:ring-[0.5px] focus-visible:ring-offset-0 focus-visible:border-foreground [&:-webkit-autofill]:bg-transparent [&:-webkit-autofill]:shadow-[0_0_0_30px_white_inset] [&:-webkit-autofill]:text-fill-color-[black]"
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className={`w-full mt-6 h-[46px] rounded-xl font-medium transition-all duration-200 shadow-none ${
                isFilled
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              }`}
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? 'Enviando...' : 'Enviar link de redefinição'}
            </Button>
          </form>
        </Form>

        {feedbackMessage && (
          <p className="mt-4 text-sm text-foreground text-center" role="status" aria-live="polite">
            {feedbackMessage}
          </p>
        )}

        <footer className="flex text-sm text-foreground gap-1 items-center justify-center mt-4">
          <Link
            href="/login"
            className="font-medium underline underline-offset-2 decoration-[1.5px] decoration-muted-foreground/50 hover:decoration-foreground transition-colors"
          >
            Voltar para o login
          </Link>
        </footer>
      </div>
    </AuthCardShell>
  );
}
