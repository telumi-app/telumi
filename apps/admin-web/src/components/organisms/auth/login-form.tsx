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
import { type LoginFormData, loginSchema } from '@/lib/validation/auth';

export function LoginForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
    mode: 'onChange',
  });

  const { watch, formState } = form;
  const email = watch('email');
  const password = watch('password');
  const isFilled = email.length > 0 && password.length > 0;

  async function onSubmit(values: LoginFormData) {
    setServerError(null);
    try {
      const response = await authApi.login(values);

      if (response.data?.accessToken) {
        setSessionToken(response.data.accessToken);
      }

      if (response.data?.onboardingCompleted) {
        router.push('/dashboard');
        return;
      }

      router.push(response.data?.onboardingNextRoute ?? '/onboarding/workspace');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'E-mail ou senha inválidos.';
      setServerError(message);
    }
  }

  return (
    <AuthCardShell>
      <div className="flex flex-col inter w-full items-stretch bg-background">
        <header className="stack gap-1.5 xl:gap-2.5">
          <h1 className="font-waldenburg-ht text-2xl text-foreground font-semibold text-center mb-7">Bem-vindo de volta</h1>
        </header>

        <div className="stack gap-2">
          <div className="relative w-full">
            <Button
              type="button"
              className="whitespace-nowrap font-medium transition-colors duration-75 focus-ring bg-background border border-input hover:bg-accent active:bg-accent shadow-none px-3 relative flex items-center justify-center gap-2.5 w-full text-sm h-[46px] rounded-xl text-foreground"
            >
              <div className="z-20 absolute top-1/2 -translate-y-1/2 left-[14px]">
                <svg width="20" height="20" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <g clipPath="url(#clip0_95_488)">
                    <path d="M24.2663 12.7764C24.2663 11.9607 24.2001 11.1406 24.059 10.3381H12.7402V14.9591H19.222C18.953 16.4494 18.0888 17.7678 16.8233 18.6056V21.6039H20.6903C22.9611 19.5139 24.2663 16.4274 24.2663 12.7764Z" fill="#4285F4"></path>
                    <path d="M12.7401 24.5008C15.9766 24.5008 18.7059 23.4382 20.6945 21.6039L16.8276 18.6055C15.7517 19.3375 14.3627 19.752 12.7445 19.752C9.61388 19.752 6.95946 17.6399 6.00705 14.8003H2.0166V17.8912C4.05371 21.9434 8.2029 24.5008 12.7401 24.5008Z" fill="#34A853"></path>
                    <path d="M6.00277 14.8003C5.50011 13.3099 5.50011 11.6961 6.00277 10.2057V7.11481H2.01674C0.314734 10.5056 0.314734 14.5004 2.01674 17.8912L6.00277 14.8003Z" fill="#FBBC04"></path>
                    <path d="M12.7401 5.24966C14.4509 5.2232 16.1044 5.86697 17.3434 7.04867L20.7695 3.62262C18.6001 1.5855 15.7208 0.465534 12.7401 0.500809C8.2029 0.500809 4.05371 3.05822 2.0166 7.11481L6.00264 10.2058C6.95064 7.36173 9.60947 5.24966 12.7401 5.24966Z" fill="#EA4335"></path>
                  </g>
                  <defs><clipPath id="clip0_95_488"><rect width="24" height="24" fill="white" transform="translate(0.5 0.5)"></rect></clipPath></defs>
                </svg>
              </div>
              Entrar com o Google
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4 my-8">
          <div className="border-b border-border flex-grow" />
          <span className="text-[10px] text-muted-foreground font-waldenburg tracking-widest uppercase">ou</span>
          <div className="border-b border-border flex-grow" />
        </div>

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
                      type="email"
                      placeholder="seu@email.com"
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
              autoComplete="current-password"
              belowInput={
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-muted-foreground hover:underline hover:text-foreground transition-colors"
                >
                  Esqueceu sua senha?
                </Link>
              }
            />

            {serverError && (
              <p className="text-sm font-medium text-destructive mt-2" role="alert" aria-live="polite">
                {serverError}
              </p>
            )}

            <Button
              type="submit"
              className={`w-full mt-4 h-[46px] rounded-xl font-medium transition-all duration-200 shadow-none ${
                isFilled
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              }`}
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </Form>

        <footer className="flex text-sm text-foreground gap-1 items-center justify-center mt-4">
          Não tem uma conta?
          <Link
            href="/register"
            className="font-medium underline underline-offset-2 decoration-[1.5px] decoration-muted-foreground/50 hover:decoration-foreground transition-colors"
          >
            Inscreva-se
          </Link>
        </footer>
      </div>
    </AuthCardShell>
  );
}
