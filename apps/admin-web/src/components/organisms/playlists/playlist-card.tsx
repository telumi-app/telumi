'use client';

import * as React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Delete02Icon,
  Edit02Icon,
  MoreHorizontalIcon,
  PlayListIcon,
  Clock01Icon,
} from '@hugeicons/core-free-icons';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { playlistsApi, type Playlist } from '@/lib/api/playlists';

function formatDuration(ms: number): string {
  if (ms === 0) return '0s';
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min > 0 && sec > 0) return `${min}min ${sec}s`;
  if (min > 0) return `${min}min`;
  return `${sec}s`;
}

type PlaylistCardProps = {
  playlist: Playlist;
  onDeleted?: () => void;
  onUpdated?: () => void;
};

export function PlaylistCard({ playlist, onDeleted, onUpdated }: PlaylistCardProps) {
  const [isRenameOpen, setIsRenameOpen] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [newName, setNewName] = React.useState(playlist.name);
  const [isRenaming, setIsRenaming] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleRename = async () => {
    if (!newName.trim() || newName.trim() === playlist.name) {
      setIsRenameOpen(false);
      return;
    }

    setIsRenaming(true);
    setError('');

    try {
      await playlistsApi.update(playlist.id, { name: newName.trim() });
      setIsRenameOpen(false);
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao renomear.');
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError('');

    try {
      await playlistsApi.remove(playlist.id);
      setIsDeleteOpen(false);
      onDeleted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Card className="group relative overflow-hidden rounded-xl border bg-card p-4 shadow-none transition-all hover:shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <HugeiconsIcon icon={PlayListIcon} size={20} className="text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium leading-tight">{playlist.name}</p>
              {playlist.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {playlist.description}
                </p>
              )}
              <div className="flex items-center gap-3 pt-1">
                <Badge variant="secondary" className="text-[10px]">
                  {playlist.itemCount} {playlist.itemCount === 1 ? 'item' : 'itens'}
                </Badge>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <HugeiconsIcon icon={Clock01Icon} size={12} />
                  {formatDuration(playlist.totalDurationMs)}
                </span>
              </div>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <HugeiconsIcon icon={MoreHorizontalIcon} size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onClick={() => {
                  setNewName(playlist.name);
                  setIsRenameOpen(true);
                }}
              >
                <HugeiconsIcon icon={Edit02Icon} size={14} className="mr-2" />
                Renomear
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setIsDeleteOpen(true)}
              >
                <HugeiconsIcon icon={Delete02Icon} size={14} className="mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Card>

      {/* Dialog: Renomear */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Renomear playlist</DialogTitle>
            <DialogDescription>Altere o nome da playlist.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="playlist-name">Nome</Label>
              <Input
                id="playlist-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleRename();
                }}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleRename()} disabled={isRenaming}>
              {isRenaming ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Excluir */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir playlist</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir &quot;{playlist.name}&quot;? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={isDeleting}>
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
