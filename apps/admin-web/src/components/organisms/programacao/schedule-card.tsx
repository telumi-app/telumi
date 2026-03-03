'use client';

import * as React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Delete02Icon,
  Edit02Icon,
  MoreHorizontalIcon,
  CalendarSyncIcon,
  PlayListIcon,
  MegaphoneIcon,
  Tick02Icon,
  ComputerIcon,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { schedulesApi, type Schedule, type ScheduleStatus } from '@/lib/api/schedules';

const STATUS_CONFIG: Record<ScheduleStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  DRAFT: { label: 'Rascunho', variant: 'secondary' },
  PUBLISHED: { label: 'Publicada', variant: 'default' },
  PAUSED: { label: 'Pausada', variant: 'outline' },
  FINISHED: { label: 'Finalizada', variant: 'secondary' },
};

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });
}

type ScheduleCardProps = {
  schedule: Schedule;
  onDeleted?: () => void;
  onUpdated?: () => void;
};

export function ScheduleCard({ schedule, onDeleted, onUpdated }: ScheduleCardProps) {
  const [isRenameOpen, setIsRenameOpen] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [newName, setNewName] = React.useState(schedule.name);
  const [isRenaming, setIsRenaming] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isPublishing, setIsPublishing] = React.useState(false);
  const [error, setError] = React.useState('');

  const statusCfg = STATUS_CONFIG[schedule.status];
  const canPublish = schedule.status === 'DRAFT' || schedule.status === 'PAUSED';
  const canDelete = schedule.status !== 'PUBLISHED';

  const handleRename = async () => {
    if (!newName.trim() || newName.trim() === schedule.name) {
      setIsRenameOpen(false);
      return;
    }

    setIsRenaming(true);
    setError('');

    try {
      await schedulesApi.update(schedule.id, { name: newName.trim() });
      setIsRenameOpen(false);
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao renomear.');
    } finally {
      setIsRenaming(false);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    setError('');

    try {
      await schedulesApi.publish(schedule.id);
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao publicar.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError('');

    try {
      await schedulesApi.remove(schedule.id);
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
              <HugeiconsIcon icon={CalendarSyncIcon} size={20} className="text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium leading-tight">{schedule.name}</p>
                <Badge variant={statusCfg.variant} className="text-[10px]">
                  {statusCfg.label}
                </Badge>
              </div>

              {/* Fonte */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <HugeiconsIcon
                  icon={schedule.sourceType === 'PLAYLIST' ? PlayListIcon : MegaphoneIcon}
                  size={12}
                />
                <span>
                  {schedule.sourceType === 'PLAYLIST' ? 'Playlist' : 'Campanha'}
                  {schedule.sourceName && `: ${schedule.sourceName}`}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                {/* Horário */}
                <span className="text-xs text-muted-foreground">
                  {schedule.startTime} – {schedule.endTime}
                </span>

                <Badge variant="outline" className="text-[10px]">
                  {schedule.frequencyPerHour}/h
                </Badge>

                {/* Dias da semana */}
                <div className="flex gap-0.5">
                  {DAY_LABELS.map((label, i) => (
                    <span
                      key={i}
                      className={`inline-flex h-5 w-5 items-center justify-center rounded text-[9px] font-medium ${
                        schedule.daysOfWeek.includes(i)
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground/50'
                      }`}
                    >
                      {label.charAt(0)}
                    </span>
                  ))}
                </div>

                {/* Telas */}
                <Badge variant="secondary" className="text-[10px]">
                  <HugeiconsIcon icon={ComputerIcon} size={10} className="mr-1" />
                  {schedule.targetCount} {schedule.targetCount === 1 ? 'tela' : 'telas'}
                </Badge>

                {/* Período */}
                {(schedule.startDate || schedule.endDate) && (
                  <span className="text-xs text-muted-foreground">
                    {formatDate(schedule.startDate)}
                    {schedule.endDate && ` — ${formatDate(schedule.endDate)}`}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {canPublish && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => void handlePublish()}
                disabled={isPublishing}
              >
                <HugeiconsIcon icon={Tick02Icon} size={12} />
                {isPublishing ? 'Publicando...' : 'Publicar'}
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <HugeiconsIcon icon={MoreHorizontalIcon} size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                  onClick={() => {
                    setNewName(schedule.name);
                    setIsRenameOpen(true);
                  }}
                >
                  <HugeiconsIcon icon={Edit02Icon} size={14} className="mr-2" />
                  Renomear
                </DropdownMenuItem>
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setIsDeleteOpen(true)}
                    >
                      <HugeiconsIcon icon={Delete02Icon} size={14} className="mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {error && (
          <p className="mt-2 text-xs text-destructive">{error}</p>
        )}
      </Card>

      {/* Dialog: Renomear */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Renomear programação</DialogTitle>
            <DialogDescription>Altere o nome da programação.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="schedule-name">Nome</Label>
              <Input
                id="schedule-name"
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
            <DialogTitle>Excluir programação</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir &quot;{schedule.name}&quot;? Esta ação não pode ser desfeita.
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
