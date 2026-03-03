'use client';

import * as React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Delete02Icon,
  Edit02Icon,
  ImageIcon,
  MoreHorizontalIcon,
  PlayIcon,
  FileVideoIcon,
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
import { mediaApi, type Media } from '@/lib/api/media';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return min > 0 ? `${min}:${sec.toString().padStart(2, '0')}` : `${sec}s`;
}

type MediaCardProps = {
  media: Media;
  onDeleted?: () => void;
  onRenamed?: () => void;
};

export function MediaCard({ media, onDeleted, onRenamed }: MediaCardProps) {
  const [isRenameOpen, setIsRenameOpen] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [newName, setNewName] = React.useState(media.name);
  const [isRenaming, setIsRenaming] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [error, setError] = React.useState('');

  const isImage = media.mediaType === 'IMAGE';
  const isVideo = media.mediaType === 'VIDEO';

  const handleRename = async () => {
    if (!newName.trim() || newName.trim() === media.name) {
      setIsRenameOpen(false);
      return;
    }

    setIsRenaming(true);
    setError('');

    try {
      await mediaApi.rename(media.id, newName.trim());
      setIsRenameOpen(false);
      onRenamed?.();
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
      await mediaApi.remove(media.id);
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
      <Card className="group relative overflow-hidden rounded-xl border bg-card shadow-none transition-all hover:shadow-sm">
        {/* Thumbnail / Preview */}
        <div className="relative aspect-video w-full overflow-hidden bg-muted">
          {isImage && media.url ? (
            <img
              src={media.url}
              alt={media.name}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : isVideo ? (
            <div className="flex h-full w-full items-center justify-center bg-muted">
              <div className="flex flex-col items-center gap-1 text-muted-foreground">
                <HugeiconsIcon icon={PlayIcon} size={32} />
                {media.durationMs && (
                  <span className="text-xs">{formatDuration(media.durationMs)}</span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted">
              <HugeiconsIcon icon={ImageIcon} size={32} className="text-muted-foreground" />
            </div>
          )}

          {/* Badge de tipo */}
          <div className="absolute left-2 top-2">
            <Badge variant="secondary" className="text-[10px] uppercase">
              {isImage ? 'IMG' : 'VID'}
            </Badge>
          </div>

          {/* Menu de ações */}
          <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="icon" className="h-7 w-7 rounded-full">
                  <HugeiconsIcon icon={MoreHorizontalIcon} size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                  onClick={() => {
                    setNewName(media.name);
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
        </div>

        {/* Info */}
        <div className="space-y-1 p-3">
          <p className="truncate text-sm font-medium leading-tight" title={media.name}>
            {media.name}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{formatFileSize(media.fileSize)}</span>
            {media.width && media.height && (
              <>
                <span>·</span>
                <span>{media.width}×{media.height}</span>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Dialog: Renomear */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Renomear mídia</DialogTitle>
            <DialogDescription>
              Altere o nome de exibição deste conteúdo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="media-name">Nome</Label>
              <Input
                id="media-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleRename();
                }}
                maxLength={100}
                autoFocus
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameOpen(false)} disabled={isRenaming}>
              Cancelar
            </Button>
            <Button onClick={handleRename} disabled={isRenaming || !newName.trim()}>
              {isRenaming ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar exclusão */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir mídia</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir <strong>{media.name}</strong>? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
