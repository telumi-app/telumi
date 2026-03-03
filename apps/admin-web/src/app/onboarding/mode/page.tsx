'use client';

import { Button } from '@telumi/ui';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useState } from 'react';

import { authApi } from '@/lib/api/auth';
import { type GoalProfile, onboardingApi } from '@/lib/api/onboarding';
import { clearSessionToken, getSessionToken } from '@/lib/auth/session';

export default function OnboardingModePage() {
  const router = useRouter();
  const [selectedMode, setSelectedMode] = useState<GoalProfile>('INTERNAL');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const loadSession = async () => {
      const token = getSessionToken();

      if (!token) {
        router.replace('/login');
        return;
      }

      try {
        const response = await authApi.me(token);
        const workspace = response.data?.workspace;

        if (!workspace) {
          router.replace('/login');
          return;
        }

        if (workspace.onboardingCompleted) {
          router.replace('/dashboard');
          return;
        }

        if (workspace.onboardingNextRoute !== '/onboarding/mode') {
          router.replace(workspace.onboardingNextRoute);
          return;
        }

        setSelectedMode(workspace.goalProfile);
      } catch {
        clearSessionToken();
        router.replace('/login');
      }
    };

    void loadSession();
  }, [router]);

  const completeOnboarding = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await onboardingApi.updateMode(selectedMode);
      router.push(response.data?.onboardingNextRoute ?? '/onboarding/setup');
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Não foi possível concluir o onboarding.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground">Qual é o seu objetivo?</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Esse passo define o fluxo inicial do produto.
      </p>

      <div className="mt-6 space-y-3">
        <button
          type="button"
          onClick={() => setSelectedMode('INTERNAL')}
          className={`w-full rounded-xl border p-4 text-left transition-colors ${
            selectedMode === 'INTERNAL' ? 'border-foreground bg-accent' : 'border-border'
          }`}
        >
          <p className="text-sm font-semibold text-foreground">Uso interno</p>
          <p className="mt-1 text-sm text-muted-foreground">Gerenciar sua própria rede de telas em um ambiente privado.</p>
        </button>

        <button
          type="button"
          onClick={() => setSelectedMode('ADS_SALES')}
          className={`w-full rounded-xl border p-4 text-left transition-colors ${
            selectedMode === 'ADS_SALES' ? 'border-foreground bg-accent' : 'border-border'
          }`}
        >
          <p className="text-sm font-semibold text-foreground">Vendas para anunciantes</p>
          <p className="mt-1 text-sm text-muted-foreground">Vender espaços de mídia com recursos de cobrança e validação da conta.</p>
        </button>
      </div>

      {error && <p className="mt-4 text-sm font-medium text-destructive">{error}</p>}

      <Button
        type="button"
        onClick={completeOnboarding}
        disabled={isSubmitting}
        className="mt-6 w-full h-[46px] rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"
      >
        {isSubmitting ? 'Concluindo...' : 'Criar meu ambiente'}
      </Button>
    </div>
  );
}
