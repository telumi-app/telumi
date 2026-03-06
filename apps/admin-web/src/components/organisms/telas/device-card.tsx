'use client';

import * as React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  RefreshIcon,
  AlarmClockIcon,
  Settings01Icon,
  Copy01Icon,
  Delete02Icon,
  UserGroupIcon,
} from '@hugeicons/core-free-icons';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Device, DeviceStatus } from '@/lib/api/devices';
import { devicesApi } from '@/lib/api/devices';
import { locationsApi, type Location } from '@/lib/api/locations';
import { type MeResponseData } from '@/lib/api/auth';

const READINESS_CONFIG = {
  PENDING_PAIRING: { label: 'Aguardando vínculo', tone: 'text-yellow-700 dark:text-yellow-300' },
  SYNCED: { label: 'Manifesto sincronizado', tone: 'text-emerald-700 dark:text-emerald-300' },
  DEGRADED: { label: 'Operando degradado', tone: 'text-amber-700 dark:text-amber-300' },
  RECOVERY_ONLY: { label: 'Modo recuperação', tone: 'text-orange-700 dark:text-orange-300' },
  PAUSED: { label: 'Operação pausada', tone: 'text-muted-foreground' },
} as const;

const HEARTBEAT_WINDOW_LABEL = {
  UNKNOWN: 'Sem heartbeat',
  FRESH: 'Heartbeat em dia',
  DELAYED: 'Heartbeat atrasado',
  STALE: 'Heartbeat expirado',
} as const;

const STATUS_CONFIG: Record<
  DeviceStatus,
  {
    label: string;
    description?: string;
    variant: 'default' | 'secondary' | 'outline' | 'destructive';
    dotColor: string;
  }
> = {
  PENDING: {
    label: 'Aguardando conexão',
    description: 'Ainda não foi pareada',
    variant: 'outline',
    dotColor: 'bg-yellow-500',
  },
  ONLINE: {
    label: 'Online agora',
    variant: 'default',
    dotColor: 'bg-green-500',
  },
  UNSTABLE: {
    label: 'Conexão instável',
    variant: 'outline',
    dotColor: 'bg-orange-500',
  },
  OFFLINE: {
    label: 'Offline',
    variant: 'secondary',
    dotColor: 'bg-muted-foreground',
  },
};

type DeviceCardProps = {
  device: Device;
  onUpdated?: () => void;
  onDeleted?: () => void;
  workspace?: MeResponseData['workspace'] | null;
};

export function DeviceCard({ device, onUpdated, onDeleted, workspace }: DeviceCardProps) {
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isLoadingLocations, setIsLoadingLocations] = React.useState(false);
  const [isRotatingRecoveryLink, setIsRotatingRecoveryLink] = React.useState(false);
  const [saveError, setSaveError] = React.useState('');
  const [recoveryError, setRecoveryError] = React.useState('');
  const [recoveryLink, setRecoveryLink] = React.useState('');
  const [copySuccess, setCopySuccess] = React.useState(false);
  const [locations, setLocations] = React.useState<Location[]>([]);
  const [name, setName] = React.useState(device.name);
  const [locationId, setLocationId] = React.useState(device.locationId);
  const [orientation, setOrientation] = React.useState(device.orientation);
  const [resolution, setResolution] = React.useState(device.resolution);
  const [operationalStatus, setOperationalStatus] = React.useState(device.operationalStatus);
  const [isPublic, setIsPublic] = React.useState(device.isPublic);
  const [isPartnerTv, setIsPartnerTv] = React.useState(device.isPartnerTv);
  const [partnerName, setPartnerName] = React.useState(device.partnerName ?? '');
  const [partnerSharePct, setPartnerSharePct] = React.useState<number | ''>(device.partnerRevenueSharePct ?? '');
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState('');
  const statusConfig = STATUS_CONFIG[device.status];
  const readinessConfig = device.telemetry?.playbackReadiness
    ? READINESS_CONFIG[device.telemetry.playbackReadiness]
    : null;

  React.useEffect(() => {
    if (!isEditOpen) {
      setName(device.name);
      setLocationId(device.locationId);
      setOrientation(device.orientation);
      setResolution(device.resolution);
      setOperationalStatus(device.operationalStatus);
      setIsPublic(device.isPublic);
      setIsPartnerTv(device.isPartnerTv);
      setPartnerName(device.partnerName ?? '');
      setPartnerSharePct(device.partnerRevenueSharePct ?? '');
      setSaveError('');
    }
  }, [device, isEditOpen]);

  React.useEffect(() => {
    if (!isEditOpen) return;
    if (locations.length > 0) return;

    setIsLoadingLocations(true);
    setSaveError('');

    void locationsApi
      .list()
      .then((response) => {
        setLocations(response.data ?? []);
      })
      .catch((error) => {
        setSaveError(error instanceof Error ? error.message : 'Não foi possível carregar os locais.');
      })
      .finally(() => {
        setIsLoadingLocations(false);
      });
  }, [isEditOpen, locations.length]);

  const onUpdatedRef = React.useRef(onUpdated);
  React.useEffect(() => {
    onUpdatedRef.current = onUpdated;
  });

  React.useEffect(() => {
    if (device.status !== 'PENDING' || !device.pairingExpiresAt) return;

    let mounted = true;
    let timeoutId: NodeJS.Timeout;

    const regenerate = async () => {
      try {
        await devicesApi.regenerateCode(device.id);
        if (mounted) onUpdatedRef.current?.();
      } catch {
        // fail silently and wait for next tick or reload
      }
    };

    const expiresAt = new Date(device.pairingExpiresAt).getTime();
    const now = Date.now();

    if (now >= expiresAt) {
      void regenerate();
    } else {
      timeoutId = setTimeout(() => {
        void regenerate();
      }, expiresAt - now + 1000);
    }

    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [device.id, device.status, device.pairingExpiresAt]);

  const formatRelativeTime = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMin < 1) return 'há menos de 1 minuto';
    if (diffMin < 60) return `há ${diffMin} minuto${diffMin === 1 ? '' : 's'}`;
    if (diffHours < 24) return `há ${diffHours} hora${diffHours === 1 ? '' : 's'}`;
    return `há ${diffDays} dia${diffDays === 1 ? '' : 's'}`;
  };

  const isPairingExpired =
    device.pairingExpiresAt && new Date(device.pairingExpiresAt) < new Date();
  const canRepair = device.status === 'OFFLINE';
  const recentEvents7d = device.telemetry?.recentEvents7d ?? 0;
  const warningEvents7d = device.telemetry?.warningEvents7d ?? 0;
  const criticalEvents7d = device.telemetry?.criticalEvents7d ?? 0;

  const handleSave = async () => {
    const trimmedName = name.trim();

    if (trimmedName.length < 3) {
      setSaveError('O nome deve ter no mínimo 3 caracteres.');
      return;
    }

    if (!locationId) {
      setSaveError('Selecione um local.');
      return;
    }

    setSaveError('');
    setIsSaving(true);

    try {
      await devicesApi.update(device.id, {
        name: trimmedName,
        locationId,
        orientation,
        resolution,
        operationalStatus,
        isPublic,
        isPartnerTv,
        partnerName: isPartnerTv ? (partnerName.trim() || undefined) : undefined,
        partnerRevenueSharePct: isPartnerTv && partnerSharePct !== '' ? Number(partnerSharePct) : undefined,
      });

      setIsEditOpen(false);
      onUpdated?.();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Não foi possível salvar as alterações.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleteError('');
    setIsDeleting(true);

    try {
      await devicesApi.remove(device.id);
      setIsDeleteConfirmOpen(false);
      setIsEditOpen(false);
      onDeleted?.();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Não foi possível excluir a tela.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRotateRecoveryLink = async () => {
    setRecoveryError('');
    setIsRotatingRecoveryLink(true);
    setCopySuccess(false);

    try {
      const response = await devicesApi.rotateRecoveryLink(device.id);
      setRecoveryLink(response.data?.recoveryLink ?? '');
      onUpdated?.();
    } catch (error) {
      setRecoveryError(error instanceof Error ? error.message : 'Não foi possível reparear a tela.');
    } finally {
      setIsRotatingRecoveryLink(false);
    }
  };

  const handleCopyRecoveryLink = async () => {
    if (!recoveryLink) return;

    try {
      await navigator.clipboard.writeText(recoveryLink);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      setRecoveryError('Não foi possível copiar automaticamente. Copie o link manualmente.');
    }
  };

  return (
    <Card className="group relative flex aspect-square flex-col justify-between overflow-hidden rounded-xl border bg-card text-card-foreground shadow-none">
      <div>
        <CardHeader className="flex flex-row items-start justify-between gap-3 p-5 pb-2">
          <div className="min-w-0 space-y-1.5">
            <CardTitle className="truncate text-xl font-semibold leading-none tracking-tight">
              {device.name}
            </CardTitle>
            <p className="truncate text-sm text-muted-foreground">
              {device.locationName}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => setIsEditOpen(true)}
            title="Editar tela"
          >
            <HugeiconsIcon icon={Settings01Icon} size={16} />
            <span className="sr-only">Editar</span>
          </Button>
        </CardHeader>

        <CardContent className="space-y-3 p-5 pt-0">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Status:</span>
              <Badge
                variant={statusConfig.variant}
                className="gap-1.5 px-2.5 py-0.5 text-xs font-medium"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${statusConfig.dotColor}`} />
                {statusConfig.label}
              </Badge>
            </div>

            {readinessConfig && (
              <div className="rounded-xl border border-border/70 bg-muted/20 px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Runtime do player
                </p>
                <div className="mt-1.5 flex items-center justify-between gap-3">
                  <p className={`text-sm font-medium ${readinessConfig.tone}`}>
                    {readinessConfig.label}
                  </p>
                  <Badge variant="outline" className="text-[10px] uppercase tracking-[0.08em]">
                    {device.telemetry?.cacheStrategy === 'OFFLINE_FIRST' ? 'offline-first' : 'sync'}
                  </Badge>
                </div>
              </div>
            )}

            {device.status !== 'PENDING' && (
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    Capacidade
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {device.telemetry?.capabilityTier ?? 'ENTRY'} · {device.telemetry?.resolutionClass ?? 'AUTO'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {HEARTBEAT_WINDOW_LABEL[device.telemetry?.heartbeatWindow ?? 'UNKNOWN']}
                  </p>
                </div>

                <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    Incidentes 7d
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {recentEvents7d} evento{recentEvents7d === 1 ? '' : 's'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {criticalEvents7d} crítico{criticalEvents7d === 1 ? '' : 's'} · {warningEvents7d} alerta{warningEvents7d === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
            )}

            {device.telemetry?.lastEventType && (
              <div className="rounded-xl border border-dashed border-border/80 bg-background/60 px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      Último incidente
                    </p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {device.telemetry.lastEventType.replaceAll('_', ' ')}
                    </p>
                  </div>
                  <Badge variant={device.telemetry.lastEventSeverity === 'CRITICAL' ? 'destructive' : 'outline'}>
                    {device.telemetry.lastEventSeverity ?? 'INFO'}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatRelativeTime(device.telemetry.lastEventAt ?? null) ?? 'Sem registro recente'}
                </p>
              </div>
            )}
          </div>

          {device.status === 'PENDING' && device.pairingCode && (
            <div className="rounded-xl border border-dashed border-muted-foreground/40 bg-muted/20 px-4 py-3 text-center">
              <p className="mb-2 text-sm font-medium text-muted-foreground">
                Código de conexão
              </p>
              <p className="overflow-hidden text-ellipsis font-mono text-[clamp(1.75rem,2.1vw,2.2rem)] font-semibold tracking-[0.14em] leading-none text-foreground">
                {device.pairingCode}
              </p>
              {device.pairingExpiresAt && (
                <div className="mt-2.5 flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <HugeiconsIcon icon={AlarmClockIcon} size={14} />
                  {isPairingExpired ? (
                    <span className="flex items-center gap-1.5 text-primary">
                      <HugeiconsIcon icon={RefreshIcon} size={14} className="animate-spin" />
                      Gerando novo código...
                    </span>
                  ) : (
                    <span>
                      Expira em{' '}
                      {Math.max(
                        0,
                        Math.ceil(
                          (new Date(device.pairingExpiresAt).getTime() - Date.now()) / 60000,
                        ),
                      )}{' '}
                      min
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </div>

      {device.status !== 'PENDING' && (
        <div className="flex items-center justify-between border-t bg-muted/20 px-5 py-3.5 text-sm">
          <span className="text-muted-foreground">Última atividade</span>
          <span className="font-medium text-foreground">
            {formatRelativeTime(device.lastHeartbeat) ?? 'Nunca'}
          </span>
        </div>
      )}

      <Dialog
        open={isEditOpen}
        onOpenChange={(open) => {
          setIsEditOpen(open);
          if (!open) {
            setRecoveryError('');
            setCopySuccess(false);
            setRecoveryLink('');
          }
        }}
      >
        <DialogContent className="flex max-h-[90vh] max-w-[520px] flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Editar tela</DialogTitle>
            <DialogDescription>Ajuste os dados da TV sem perder o histórico de conexão.</DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-4 overflow-y-auto pr-1">
            <div>
              <label className="text-sm font-medium" htmlFor={`device-name-${device.id}`}>
                Nome da tela
              </label>
              <Input
                id={`device-name-${device.id}`}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex: TV Recepção"
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Local</label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger className="mt-1">
                  <SelectValue
                    placeholder={isLoadingLocations ? 'Carregando locais...' : 'Selecione um local'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Orientação</label>
                <Select value={orientation} onValueChange={(value) => setOrientation(value as Device['orientation'])}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HORIZONTAL">Horizontal</SelectItem>
                    <SelectItem value="VERTICAL">Vertical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Status operacional</label>
                <Select
                  value={operationalStatus}
                  onValueChange={(value) => setOperationalStatus(value as Device['operationalStatus'])}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Ativa</SelectItem>
                    <SelectItem value="INACTIVE">Inativa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Resolução</label>
                <Select value={resolution} onValueChange={setResolution}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AUTO">Auto detect</SelectItem>
                    <SelectItem value="1920x1080">1920x1080 (Full HD)</SelectItem>
                    <SelectItem value="1280x720">1280x720 (HD)</SelectItem>
                    <SelectItem value="3840x2160">3840x2160 (4K)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {workspace?.goalProfile !== 'INTERNAL' && (
                <div>
                  <label className="text-sm font-medium">Disponível no marketplace</label>
                  <Select value={isPublic ? 'true' : 'false'} onValueChange={(value) => setIsPublic(value === 'true')}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Sim</SelectItem>
                      <SelectItem value="false">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {workspace?.goalProfile !== 'INTERNAL' && (
              <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <HugeiconsIcon icon={UserGroupIcon} size={16} className="text-muted-foreground shrink-0" />
                  <p className="text-sm font-medium">TV de parceiro</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Marque se esta TV pertence a um parceiro externo (ex.: clínica, comércio). O repasse é calculado pelo percentual abaixo.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">TV de parceiro</label>
                    <Select
                      value={isPartnerTv ? 'true' : 'false'}
                      onValueChange={(value) => {
                        setIsPartnerTv(value === 'true');
                        if (value === 'false') {
                          setPartnerName('');
                          setPartnerSharePct('');
                        }
                      }}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="false">Não</SelectItem>
                        <SelectItem value="true">Sim</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {isPartnerTv && (
                    <div>
                      <label className="text-sm font-medium">Repasse (%)</label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        placeholder="Ex: 30"
                        value={partnerSharePct}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPartnerSharePct(val === '' ? '' : Number(val));
                        }}
                        className="mt-1"
                      />
                    </div>
                  )}
                </div>

                {isPartnerTv && (
                  <div>
                    <label className="text-sm font-medium">Nome do parceiro</label>
                    <Input
                      placeholder="Ex: Clínica Saúde Mais"
                      value={partnerName}
                      onChange={(e) => setPartnerName(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                )}
              </div>
            )}

            {saveError && <p className="text-sm text-destructive">{saveError}</p>}

            {canRepair && (
              <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                <p className="text-sm font-medium">Repareamento manual</p>
                <p className="text-xs text-muted-foreground">
                  Gere um novo link para reconectar esta TV caso tenha perdido o pareamento.
                </p>
                <div className="flex gap-2">
                  <Input
                    value={recoveryLink}
                    readOnly
                    placeholder="Clique em Reparear para gerar o link"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0"
                    onClick={handleCopyRecoveryLink}
                    disabled={!recoveryLink}
                  >
                    <HugeiconsIcon icon={Copy01Icon} size={16} />
                    {copySuccess ? 'Copiado' : 'Copiar'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0"
                    onClick={handleRotateRecoveryLink}
                    disabled={isRotatingRecoveryLink}
                  >
                    {isRotatingRecoveryLink ? <HugeiconsIcon icon={RefreshIcon} size={16} className="animate-spin" /> : null}
                    Reparear
                  </Button>
                </div>
                {recoveryError && <p className="text-xs text-destructive">{recoveryError}</p>}
              </div>
            )}
          </div>

          <DialogFooter className="flex-row items-center justify-between gap-2 border-t pt-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => { setDeleteError(''); setIsDeleteConfirmOpen(true); }}
            >
              <HugeiconsIcon icon={Delete02Icon} size={16} />
              Excluir tela
            </Button>

            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsEditOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleSave} disabled={isSaving || isLoadingLocations}>
                {isSaving ? <HugeiconsIcon icon={RefreshIcon} size={16} className="animate-spin" /> : null}
                Salvar alterações
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog — delete */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
                <HugeiconsIcon icon={Delete02Icon} size={18} className="text-destructive" />
              </span>
              Excluir tela
            </DialogTitle>
            <DialogDescription className="pt-1">
              Tem certeza que deseja excluir{' '}
              <span className="font-semibold text-foreground">{device.name}</span>? Todos os dados
              de histórico, heartbeats e eventos serão removidos permanentemente. Esta ação não pode
              ser desfeita.
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {deleteError}
            </p>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsDeleteConfirmOpen(false)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <HugeiconsIcon icon={RefreshIcon} size={16} className="animate-spin" />
              ) : (
                <HugeiconsIcon icon={Delete02Icon} size={16} />
              )}
              {isDeleting ? 'Excluindo...' : 'Excluir tela'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
