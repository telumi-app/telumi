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
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { PasswordField } from '@/components/molecules/password-field';
import { AuthCardShell } from '@/components/organisms/auth/auth-card-shell';
import { authApi } from '@/lib/api/auth';
import { setSessionToken } from '@/lib/auth/session';
import { type RegisterFormData, registerSchema } from '@/lib/validation/auth';

export function RegisterForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
    mode: 'onChange',
  });

  const { watch, formState } = form;
  const name = watch('name');
  const email = watch('email');
  const password = watch('password');
  const confirmPassword = watch('confirmPassword');
  const isFilled = name.length > 0 && email.length > 0 && password.length > 0 && confirmPassword.length > 0;

  async function onSubmit(values: RegisterFormData) {
    setServerError(null);
    try {
      const response = await authApi.register({
        name: values.name!,
        email: values.email!,
        password: values.password!,
        confirmPassword: values.confirmPassword!,
      });
      if (response.success) {
        if (response.data?.accessToken) {
          setSessionToken(response.data.accessToken);
        }

        router.push(response.data?.onboardingNextRoute ?? '/onboarding/workspace');
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Não foi possível criar sua conta. Tente novamente.';
      setServerError(message);
    }
  }

  return (
    <AuthCardShell>
      <div className="flex flex-col inter w-full items-stretch bg-background">
        <header className="stack gap-1.5 xl:gap-2.5">
          <h1 className="font-waldenburg-ht text-2xl text-foreground font-semibold text-center mb-7">Criar sua conta</h1>
        </header>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="stack">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between mt-2.5 mb-1.5">
                    <FormLabel className="text-sm font-medium cursor-pointer text-foreground transition-all duration-150 ease-in-out">
                      Nome completo
                    </FormLabel>
                    <FormMessage className="text-[11px] font-medium text-destructive mt-0 leading-none" />
                  </div>
                  <FormControl>
                    <Input
                      placeholder="Seu nome"
                      autoComplete="name"
                      className="flex w-full border border-input bg-transparent shadow-none transition-colors h-[46px] rounded-xl px-[16px] text-base md:text-sm focus-visible:ring-[0.5px] focus-visible:ring-offset-0 focus-visible:border-foreground [&:-webkit-autofill]:bg-transparent [&:-webkit-autofill]:shadow-[0_0_0_30px_white_inset] [&:-webkit-autofill]:text-fill-color-[black]"
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

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

            <PasswordField
              control={form.control}
              name="password"
              label="Senha"
              placeholder=""
              autoComplete="new-password"
            />

            <PasswordField
              control={form.control}
              name="confirmPassword"
              label="Confirmar senha"
              placeholder=""
              autoComplete="new-password"
            />

            {serverError && (
              <p className="text-sm font-medium text-destructive mt-2" role="alert" aria-live="polite">
                {serverError}
              </p>
            )}

            <Button
              type="submit"
              className={`w-full mt-6 h-[46px] rounded-xl font-medium transition-all duration-200 shadow-none ${
                isFilled
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              }`}
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? 'Criando conta...' : 'Criar conta'}
            </Button>
          </form>
        </Form>

        <footer className="flex text-sm text-foreground gap-1 items-center justify-center mt-4">
          Já tem uma conta?
          <Link
            href="/login"
            className="font-medium underline underline-offset-2 decoration-[1.5px] decoration-muted-foreground/50 hover:decoration-foreground transition-colors"
          >
            Entrar
          </Link>
        </footer>
      </div>
    </AuthCardShell>
  );
}
