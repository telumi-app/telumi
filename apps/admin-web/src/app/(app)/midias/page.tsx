'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  PlusSignCircleIcon,
  RefreshIcon,
  ImageIcon,
} from '@hugeicons/core-free-icons';

import { Button } from '@/components/ui/button';
import { mediaApi, type Media } from '@/lib/api/media';
import { getSessionToken, clearSessionToken } from '@/lib/auth/session';
import { MediaCard } from '@/components/organisms/midias/media-card';
import { UploadDialog } from '@/components/organisms/midias/upload-dialog';

type PageView = 'loading' | 'list' | 'empty';

export default function MidiasPage() {
  const router = useRouter();
  const [view, setView] = React.useState<PageView>('loading');
  const [media, setMedia] = React.useState<Media[]>([]);
  const [error, setError] = React.useState('');
  const [isUploadOpen, setIsUploadOpen] = React.useState(false);

  const loadData = React.useCallback(async () => {
    const token = getSessionToken();

    if (!token) {
      router.replace('/login');
      return;
    }

    try {
      const res = await mediaApi.list();
      const items = res.data ?? [];

      setMedia(items);
      setView(items.length > 0 ? 'list' : 'empty');
    } catch (err) {
      if (err instanceof Error && err.message.includes('Sessão inválida')) {
        clearSessionToken();
        router.replace('/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Erro ao carregar conteúdos.');
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
          <h1 className="text-3xl font-semibold tracking-tight">Conteúdos</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie imagens e vídeos para exibição nas suas telas.
          </p>
        </div>

        <Button onClick={() => setIsUploadOpen(true)} className="gap-2">
          <HugeiconsIcon icon={PlusSignCircleIcon} size={18} />
          Enviar conteúdo
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
            <HugeiconsIcon icon={ImageIcon} size={28} className="text-muted-foreground" />
          </div>
          <h2 className="text-lg font-medium">Nenhum conteúdo enviado</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Envie imagens e vídeos para começar a montar suas playlists e exibir nas telas.
          </p>
          <Button onClick={() => setIsUploadOpen(true)} className="mt-6 gap-2">
            <HugeiconsIcon icon={PlusSignCircleIcon} size={18} />
            Enviar primeiro conteúdo
          </Button>
        </div>
      )}

      {/* Grid de mídias */}
      {view === 'list' && (
        <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {media.map((item) => (
            <MediaCard
              key={item.id}
              media={item}
              onDeleted={loadData}
              onRenamed={loadData}
            />
          ))}
        </div>
      )}

      {/* Upload Dialog */}
      <UploadDialog
        open={isUploadOpen}
        onOpenChange={setIsUploadOpen}
        onUploaded={loadData}
      />
    </div>
  );
}
