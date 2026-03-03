'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  PlusSignCircleIcon,
  RefreshIcon,
  CalendarSyncIcon,
} from '@hugeicons/core-free-icons';

import { Button } from '@/components/ui/button';
import { schedulesApi, type Schedule } from '@/lib/api/schedules';
import { getSessionToken, clearSessionToken } from '@/lib/auth/session';
import { ScheduleCard } from '@/components/organisms/programacao/schedule-card';

type PageView = 'loading' | 'list' | 'empty';

export default function ProgramacaoPage() {
  const router = useRouter();
  const [view, setView] = React.useState<PageView>('loading');
  const [schedules, setSchedules] = React.useState<Schedule[]>([]);
  const [error, setError] = React.useState('');

  const loadData = React.useCallback(async () => {
    const token = getSessionToken();

    if (!token) {
      router.replace('/login');
      return;
    }

    try {
      const res = await schedulesApi.list();
      const items = res.data ?? [];

      setSchedules(items);
      setView(items.length > 0 ? 'list' : 'empty');
    } catch (err) {
      if (err instanceof Error && err.message.includes('Sessão inválida')) {
        clearSessionToken();
        router.replace('/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Erro ao carregar programação.');
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

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Programação</h1>
          <p className="text-sm text-muted-foreground">
            Programe a exibição de campanhas e playlists nas suas telas.
          </p>
        </div>

        <Button onClick={() => router.push('/programacao/criar')} className="gap-2">
          <HugeiconsIcon icon={PlusSignCircleIcon} size={18} />
          Nova programação
        </Button>
      </div>

      {/* Erros */}
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Estado vazio */}
      {view === 'empty' && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <HugeiconsIcon icon={CalendarSyncIcon} size={28} className="text-muted-foreground" />
          </div>
          <h2 className="text-lg font-medium">Nenhuma programação criada</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Programe a exibição de campanhas e playlists, definindo dias, horários e telas de destino.
          </p>
          <Button onClick={() => router.push('/programacao/criar')} className="mt-6 gap-2">
            <HugeiconsIcon icon={PlusSignCircleIcon} size={18} />
            Criar primeira programação
          </Button>
        </div>
      )}

      {/* Lista de programações */}
      {view === 'list' && (
        <div className="space-y-4">
          {schedules.map((schedule) => (
            <ScheduleCard
              key={schedule.id}
              schedule={schedule}
              onDeleted={loadData}
              onUpdated={loadData}
            />
          ))}
        </div>
      )}
    </div>
  );
}
