'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import { PlusSignCircleIcon, RefreshIcon } from '@hugeicons/core-free-icons';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { devicesApi, type Device } from '@/lib/api/devices';
import { getSessionToken, clearSessionToken } from '@/lib/auth/session';
import { CreateDeviceWizard } from '@/components/organisms/telas/create-device-wizard';
import { DeviceCard } from '@/components/organisms/telas/device-card';
import { useWorkspace } from '@/hooks/use-workspace';

type PageView = 'loading' | 'list' | 'empty';
type WizardInitialAction = 'create-screen' | 'add-location';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function TelasPage() {
  const router = useRouter();
  const [view, setView] = React.useState<PageView>('loading');
  const [devices, setDevices] = React.useState<Device[]>([]);
  const [error, setError] = React.useState('');
  const [wizardInitialAction, setWizardInitialAction] = React.useState<WizardInitialAction>('create-screen');
  const [isWizardOpen, setIsWizardOpen] = React.useState(false);
  const { workspace, loading: workspaceLoading } = useWorkspace();

  const loadData = React.useCallback(async () => {
    const token = getSessionToken();

    if (!token) {
      router.replace('/login');
      return;
    }

    try {
      const devicesRes = await devicesApi.list();
      const devs = devicesRes.data ?? [];

      setDevices(devs);
      setView(devs.length > 0 ? 'list' : 'empty');
    } catch (err) {
      if (err instanceof Error && err.message.includes('Sessão inválida')) {
        clearSessionToken();
        router.replace('/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados.');
      setView('empty');
    }
  }, [router]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  React.useEffect(() => {
    const token = getSessionToken();

    if (!token) return;

    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let isDisposed = false;

    const connect = () => {
      if (isDisposed) return;

      eventSource = new EventSource(
        `${API_BASE_URL}/v1/devices/stream?token=${encodeURIComponent(token)}`,
      );

      const handleUpdate = () => {
        void loadData();
      };

      eventSource.addEventListener('device-status', handleUpdate);
      eventSource.onmessage = handleUpdate;
      eventSource.onerror = () => {
        eventSource?.close();
        if (!isDisposed) {
          reconnectTimeout = setTimeout(connect, 5000);
        }
      };
    };

    connect();

    return () => {
      isDisposed = true;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      eventSource?.close();
    };
  }, [loadData]);

  React.useEffect(() => {
    const intervalId = setInterval(() => {
      void loadData();
    }, 15000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadData]);

  const handleDeviceCreated = (device: Device) => {
    setDevices((prev) => [device, ...prev]);
  };

  const handleFinishWizard = () => {
    setIsWizardOpen(false);
    setView(devices.length > 0 ? 'list' : 'empty');
  };

  if (view === 'loading' || workspaceLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <HugeiconsIcon icon={RefreshIcon} size={32} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Cadastrar telas</h1>
        <p className="text-sm text-muted-foreground">Gerencie as telas conectadas à sua rede.</p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {view === 'empty' && (
        <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          Adicione sua primeira tela para começar a exibir conteúdos no seu ambiente.
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          className="group flex aspect-square h-full cursor-pointer flex-col items-center justify-center rounded-xl border-dashed border-border bg-card p-6 shadow-none transition-all hover:bg-accent/50"
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setWizardInitialAction('create-screen');
              setIsWizardOpen(true);
            }
          }}
          onClick={() => {
            setWizardInitialAction('create-screen');
            setIsWizardOpen(true);
          }}
        >
          <div className="flex w-full flex-col items-center gap-[30px] text-center">
            <div className="space-y-[7px] text-foreground">
              <h2 className="text-[24px] font-medium leading-tight">
                Clique aqui e <br /> cadastre uma tela
              </h2>
              <p className="text-[14px] font-light leading-snug">
                Crie uma nova tela e gere <br /> o código de conexão.
              </p>
            </div>

            <div className="flex h-[37px] items-center gap-2 rounded-full bg-primary pl-2 pr-5 text-primary-foreground shadow-sm transition-transform group-hover:scale-105 active:scale-95">
              <HugeiconsIcon icon={PlusSignCircleIcon} size={24} />
              <span className="text-[12px] font-normal">Adicionar tela</span>
            </div>
          </div>
        </Card>

        {devices.map((device) => (
          <DeviceCard
            key={device.id}
            device={device}
            onUpdated={loadData}
            onDeleted={loadData}
            workspace={workspace}
          />
        ))}
      </div>

      <Dialog open={isWizardOpen} onOpenChange={setIsWizardOpen}>
        <DialogContent className="max-h-[90vh] max-w-[680px] overflow-y-auto p-0 [&>button]:hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Criar tela</DialogTitle>
            <DialogDescription>Fluxo de criação e conexão de tela.</DialogDescription>
          </DialogHeader>
          <CreateDeviceWizard
            key={`${wizardInitialAction}-${isWizardOpen ? 'open' : 'closed'}`}
            initialAction={wizardInitialAction}
            onCreated={handleDeviceCreated}
            onCancel={handleFinishWizard}
            workspace={workspace}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
