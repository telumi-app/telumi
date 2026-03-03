'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import {
  Delete02Icon,
  Edit02Icon,
  MoreHorizontalIcon,
  PauseIcon,
  PlayIcon,
  PlaySquareIcon,
  Cancel01Icon,
  CalendarSyncIcon,
  TvSmartIcon,
} from '@hugeicons/core-free-icons';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { campaignsApi, type Campaign, type CampaignStatus } from '@/lib/api/campaigns';

// Status → left-border accent + label color
const STATUS_CONFIG: Record<
  CampaignStatus,
  {
    label: string;
    variant: 'default' | 'secondary' | 'outline' | 'destructive';
    dotColor: string;
  }
> = {
  DRAFT: {
    label: 'Rascunho',
    variant: 'outline',
    dotColor: 'bg-yellow-500',
  },
  ACTIVE: {
    label: 'Ativa',
    variant: 'default',
    dotColor: 'bg-green-500',
  },
  PAUSED: {
    label: 'Pausada',
    variant: 'secondary',
    dotColor: 'bg-muted-foreground',
  },
  FINISHED: {
    label: 'Finalizada',
    variant: 'secondary',
    dotColor: 'bg-muted-foreground',
  },
  CANCELLED: {
    label: 'Cancelada',
    variant: 'destructive',
    dotColor: 'bg-destructive',
  },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

type StatItemProps = { icon: IconSvgElement; value: number; label: string };
function StatItem({ icon, value, label }: StatItemProps) {
  return (
    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
      <HugeiconsIcon icon={icon} size={11} className="shrink-0 text-muted-foreground/50" />
      <span className="tabular-nums font-medium text-foreground/80">{value}</span>
      <span>{label}</span>
    </span>
  );
}

type CampaignCardProps = {
  campaign: Campaign;
  onDeleted?: () => void;
  onUpdated?: () => void;
};

export function CampaignCard({ campaign, onDeleted, onUpdated }: CampaignCardProps) {
  const router = useRouter();
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [isChangingStatus, setIsChangingStatus] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [error, setError] = React.useState('');

  const cfg = STATUS_CONFIG[campaign.status];
  const canPause = campaign.status === 'ACTIVE';
  const canReactivate = campaign.status === 'PAUSED';
  const canCancel = ['DRAFT', 'ACTIVE', 'PAUSED'].includes(campaign.status);

  const handleChangeStatus = async (status: CampaignStatus) => {
    setIsChangingStatus(true);
    setError('');
    try {
      await campaignsApi.update(campaign.id, { status });
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar status.');
    } finally {
      setIsChangingStatus(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError('');
    try {
      await campaignsApi.remove(campaign.id);
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
      <Card
        className="group relative flex aspect-square flex-col justify-between overflow-hidden rounded-xl border bg-card text-card-foreground shadow-none"
      >
        <div>
          <CardHeader className="flex flex-row items-start justify-between gap-3 p-5 pb-2">
            <div className="min-w-0 space-y-1.5">
              <CardTitle className="truncate text-xl font-semibold leading-none tracking-tight">
                {campaign.name}
              </CardTitle>
              <Badge
                variant={cfg.variant}
                className="w-fit gap-1.5 px-2.5 py-0.5 text-xs font-medium"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${cfg.dotColor}`} />
                {cfg.label}
              </Badge>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <HugeiconsIcon icon={MoreHorizontalIcon} size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                  onClick={() => router.push(`/campanhas/${campaign.id}/editar`)}
                >
                  <HugeiconsIcon icon={Edit02Icon} size={13} className="mr-2" />
                  Editar
                </DropdownMenuItem>
                {canPause && (
                  <DropdownMenuItem
                    disabled={isChangingStatus}
                    onClick={() => void handleChangeStatus('PAUSED')}
                  >
                    <HugeiconsIcon icon={PauseIcon} size={13} className="mr-2" />
                    Pausar
                  </DropdownMenuItem>
                )}
                {canReactivate && (
                  <DropdownMenuItem
                    disabled={isChangingStatus}
                    onClick={() => void handleChangeStatus('ACTIVE')}
                  >
                    <HugeiconsIcon icon={PlayIcon} size={13} className="mr-2" />
                    Reativar
                  </DropdownMenuItem>
                )}
                {canCancel && (
                  <DropdownMenuItem
                    disabled={isChangingStatus}
                    onClick={() => void handleChangeStatus('CANCELLED')}
                  >
                    <HugeiconsIcon icon={Cancel01Icon} size={13} className="mr-2" />
                    Cancelar
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setIsDeleteOpen(true)}
                >
                  <HugeiconsIcon icon={Delete02Icon} size={13} className="mr-2" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardHeader>

          <CardContent className="space-y-3 p-5 pt-0">
          {campaign.description && (
            <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {campaign.description}
            </p>
          )}

          {campaign.objective && !campaign.description && (
            <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {campaign.objective}
            </p>
          )}
          </CardContent>
        </div>

        <div className="flex items-center gap-4 border-t bg-muted/20 px-5 py-3.5 text-sm">
          <StatItem
            icon={PlaySquareIcon}
            value={campaign.assetCount}
            label={campaign.assetCount === 1 ? 'conteúdo' : 'conteúdos'}
          />
          <StatItem
            icon={CalendarSyncIcon}
            value={campaign.scheduleCount}
            label={campaign.scheduleCount === 1 ? 'prog.' : 'progs.'}
          />
          <StatItem
            icon={TvSmartIcon}
            value={campaign.activeTargetCount}
            label={campaign.activeTargetCount === 1 ? 'tela' : 'telas'}
          />
          {(campaign.startDate || campaign.endDate) && (
            <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
              {formatDate(campaign.startDate)}
              {campaign.endDate ? ` — ${formatDate(campaign.endDate)}` : ''}
            </span>
          )}
        </div>
      </Card>

      {/* Dialog: Excluir */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir campanha</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir &quot;{campaign.name}&quot;? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={isDeleting}>
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
