'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import { PlusSignCircleIcon, RefreshIcon } from '@hugeicons/core-free-icons';

import { Card } from '@/components/ui/card';
import { campaignsApi, type Campaign } from '@/lib/api/campaigns';
import { getSessionToken, clearSessionToken } from '@/lib/auth/session';
import { CampaignCard } from '@/components/organisms/campanhas/campaign-card';

type PageView = 'loading' | 'list' | 'empty';

export default function CampanhasPage() {
  const router = useRouter();
  const [view, setView] = React.useState<PageView>('loading');
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);
  const [error, setError] = React.useState('');

  const loadData = React.useCallback(async () => {
    const token = getSessionToken();

    if (!token) {
      router.replace('/login');
      return;
    }

    try {
      const res = await campaignsApi.list();
      const items = res.data ?? [];
      setCampaigns(items);
      setView(items.length > 0 ? 'list' : 'empty');
    } catch (err) {
      if (err instanceof Error && err.message.includes('Sessão inválida')) {
        clearSessionToken();
        router.replace('/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Erro ao carregar campanhas.');
      setView('empty');
    }
  }, [router]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  if (view === 'loading') {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <HugeiconsIcon icon={RefreshIcon} size={32} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleOpenCreate = () => router.push('/campanhas/criar');

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      {/* Header */}
      <div className="space-y-1 border-b border-border/50 pb-6">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/45">
          Conteúdo
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-[1.75rem]">
          Campanhas
        </h1>
        <p className="text-[13px] text-muted-foreground/65">
          Crie e gerencie campanhas para exibição de conteúdo nas suas telas.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      {/* Grid: CTA card + campaign cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* CTA — mesmo estilo da página de Telas */}
        <Card
          role="button"
          tabIndex={0}
          className="group flex cursor-pointer flex-col items-center justify-center rounded-xl border-dashed border-border bg-card p-6 shadow-none transition-all hover:bg-accent/50"
          style={{ minHeight: '160px' }}
          onClick={handleOpenCreate}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleOpenCreate();
            }
          }}
        >
          <div className="flex flex-col items-center gap-[28px] text-center">
            <div className="space-y-[6px] text-foreground">
              <h2 className="text-[22px] font-medium leading-tight">
                Criar uma<br />nova campanha
              </h2>
              <p className="text-[13px] font-light leading-snug text-muted-foreground">
                Programe conteúdo para<br />as suas telas.
              </p>
            </div>
            <div className="flex h-[37px] items-center gap-2 rounded-full bg-primary pl-2 pr-5 text-primary-foreground shadow-sm transition-transform group-hover:scale-105 active:scale-95">
              <HugeiconsIcon icon={PlusSignCircleIcon} size={24} />
              <span className="text-[12px] font-normal">Criar campanha</span>
            </div>
          </div>
        </Card>

        {campaigns.map((campaign) => (
          <CampaignCard
            key={campaign.id}
            campaign={campaign}
            onDeleted={loadData}
            onUpdated={loadData}
          />
        ))}
      </div>
    </div>
  );
}
