'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { authApi } from '@/lib/api/auth';
import { clearSessionToken, getSessionToken } from '@/lib/auth/session';

export default function Home() {
  const router = useRouter();
  const [message, setMessage] = useState('Carregando sua sessão...');

  useEffect(() => {
    const bootstrap = async () => {
      const token = getSessionToken();

      if (!token) {
        router.replace('/login');
        return;
      }

      try {
        const response = await authApi.me(token);
        const user = response.data;

        if (!user) {
          router.replace('/login');
          return;
        }

        if (!user.workspace.onboardingCompleted) {
          router.replace(user.workspace.onboardingNextRoute);
          return;
        }

        router.replace('/dashboard');
        setMessage(`Bem-vindo, ${user.name ?? user.email}.`);
      } catch {
        clearSessionToken();
        router.replace('/login');
      }
    };

    void bootstrap();
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">Telumi</h1>
        <p className="mt-2 text-lg text-muted-foreground">{message}</p>
      </div>
    </main>
  );
}
