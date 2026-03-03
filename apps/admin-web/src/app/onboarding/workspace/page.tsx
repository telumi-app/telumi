'use client';

import { Button, Input } from '@telumi/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { authApi } from '@/lib/api/auth';
import { clearSessionToken, getSessionToken } from '@/lib/auth/session';
import { onboardingApi } from '@/lib/api/onboarding';

function toSlug(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

export default function OnboardingWorkspacePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
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

        if (workspace.onboardingNextRoute !== '/onboarding/workspace') {
          router.replace(workspace.onboardingNextRoute);
          return;
        }

        setName(workspace.name);
        setSlug(workspace.slug);
      } catch {
        clearSessionToken();
        router.replace('/login');
      }
    };

    void load();
  }, [router]);

  const canSubmit = useMemo(() => name.trim().length >= 3 && slug.trim().length >= 3, [name, slug]);

  const handleNameChange = (value: string) => {
    setName(value);
    setSlug(toSlug(value));
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await onboardingApi.updateWorkspace({
        name: name.trim(),
        slug: slug.trim(),
      });
      router.push(response.data?.onboardingNextRoute ?? '/onboarding/mode');
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Não foi possível salvar seu workspace.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground">Configure seu workspace</h1>
      <p className="mt-1 text-sm text-muted-foreground">Defina o nome e o identificador público da sua conta.</p>

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="workspace-name">
            Nome do workspace
          </label>
          <Input
            id="workspace-name"
            value={name}
            onChange={(event) => handleNameChange(event.target.value)}
            placeholder="Ex.: Rede Indoor Sul"
            className="h-[46px] rounded-xl"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="workspace-slug">
            Slug
          </label>
          <Input
            id="workspace-slug"
            value={slug}
            onChange={(event) => setSlug(toSlug(event.target.value))}
            placeholder="rede-indoor-sul"
            className="h-[46px] rounded-xl"
          />
          <p className="text-xs text-muted-foreground">URL pública: /a/{slug || 'seu-slug'}</p>
        </div>

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}

        <Button
          type="submit"
          disabled={!canSubmit || isSubmitting}
          className="w-full h-[46px] rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"
        >
          {isSubmitting ? 'Salvando...' : 'Continuar'}
        </Button>
      </form>
    </div>
  );
}
