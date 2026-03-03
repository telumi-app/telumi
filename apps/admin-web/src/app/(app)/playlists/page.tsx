'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  PlusSignCircleIcon,
  RefreshIcon,
  PlayListIcon,
} from '@hugeicons/core-free-icons';

import { Button } from '@/components/ui/button';
import { playlistsApi, type Playlist } from '@/lib/api/playlists';
import { getSessionToken, clearSessionToken } from '@/lib/auth/session';
import { PlaylistCard } from '@/components/organisms/playlists/playlist-card';

type PageView = 'loading' | 'list' | 'empty';

export default function PlaylistsPage() {
  const router = useRouter();
  const [view, setView] = React.useState<PageView>('loading');
  const [playlists, setPlaylists] = React.useState<Playlist[]>([]);
  const [error, setError] = React.useState('');
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);

  const loadData = React.useCallback(async () => {
    const token = getSessionToken();

    if (!token) {
      router.replace('/login');
      return;
    }

    try {
      const res = await playlistsApi.list();
      const items = res.data ?? [];

      setPlaylists(items);
      setView(items.length > 0 ? 'list' : 'empty');
    } catch (err) {
      if (err instanceof Error && err.message.includes('Sessão inválida')) {
        clearSessionToken();
        router.replace('/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Erro ao carregar playlists.');
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
          <h1 className="text-3xl font-semibold tracking-tight">Playlists</h1>
          <p className="text-sm text-muted-foreground">
            Organize seus conteúdos em playlists para exibição nas telas.
          </p>
        </div>

        <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
          <HugeiconsIcon icon={PlusSignCircleIcon} size={18} />
          Criar playlist
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
            <HugeiconsIcon icon={PlayListIcon} size={28} className="text-muted-foreground" />
          </div>
          <h2 className="text-lg font-medium">Nenhuma playlist criada</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Crie playlists para organizar seus conteúdos e programar a exibição nas telas.
          </p>
          <Button onClick={() => setIsCreateOpen(true)} className="mt-6 gap-2">
            <HugeiconsIcon icon={PlusSignCircleIcon} size={18} />
            Criar primeira playlist
          </Button>
        </div>
      )}

      {/* Grid de playlists */}
      {view === 'list' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {playlists.map((playlist) => (
            <PlaylistCard
              key={playlist.id}
              playlist={playlist}
              onDeleted={loadData}
              onUpdated={loadData}
            />
          ))}
        </div>
      )}
    </div>
  );
}
