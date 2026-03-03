'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowLeft01Icon,
  RefreshIcon,
  Save,
  AddCircleIcon,
} from '@hugeicons/core-free-icons';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { campaignsApi, type Campaign, type CampaignStatus } from '@/lib/api/campaigns';
import { schedulesApi, type Schedule, type ScheduleStatus } from '@/lib/api/schedules';
import { devicesApi, type Device } from '@/lib/api/devices';
import { mediaApi } from '@/lib/api/media';
import { clearSessionToken, getSessionToken } from '@/lib/auth/session';
import {
  CampaignTimeline,
  type CampaignTimelineItem,
} from '@/components/organisms/campanhas/campaign-timeline';
import { CampaignTargetSelector } from '@/components/organisms/campanhas/campaign-target-selector';

const DAYS = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
] as const;

const CAMPAIGN_STATUS_OPTIONS: CampaignStatus[] = [
  'DRAFT',
  'ACTIVE',
  'PAUSED',
  'FINISHED',
  'CANCELLED',
];

function statusLabel(status: CampaignStatus | ScheduleStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'Rascunho';
    case 'ACTIVE':
      return 'Ativa';
    case 'PAUSED':
      return 'Pausada';
    case 'FINISHED':
      return 'Finalizada';
    case 'CANCELLED':
      return 'Cancelada';
    case 'PUBLISHED':
      return 'Publicada';
    default:
      return status;
  }
}

function toDateInputValue(value: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

export default function EditCampaignPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const campaignId = params?.id;

  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isSavingSchedule, setIsSavingSchedule] = React.useState(false);
  const [error, setError] = React.useState('');
  const [helper, setHelper] = React.useState('');

  const [campaign, setCampaign] = React.useState<Campaign | null>(null);
  const [schedules, setSchedules] = React.useState<Schedule[]>([]);
  const [devices, setDevices] = React.useState<Device[]>([]);

  const [name, setName] = React.useState('');
  const [objective, setObjective] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [status, setStatus] = React.useState<CampaignStatus>('DRAFT');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [timeline, setTimeline] = React.useState<CampaignTimelineItem[]>([]);

  const [newScheduleName, setNewScheduleName] = React.useState('');
  const [newScheduleStartDate, setNewScheduleStartDate] = React.useState('');
  const [newScheduleEndDate, setNewScheduleEndDate] = React.useState('');
  const [newScheduleStartTime, setNewScheduleStartTime] = React.useState('08:00');
  const [newScheduleEndTime, setNewScheduleEndTime] = React.useState('18:00');
  const [newScheduleFrequency, setNewScheduleFrequency] = React.useState(4);
  const [newScheduleDays, setNewScheduleDays] = React.useState<number[]>([1, 2, 3, 4, 5]);
  const [newSchedulePriority, setNewSchedulePriority] = React.useState(0);
  const [newScheduleDevices, setNewScheduleDevices] = React.useState<string[]>([]);

  const loadData = React.useCallback(async () => {
    if (!campaignId) return;

    const token = getSessionToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    setError('');
    setHelper('');

    try {
      const [campaignRes, schedulesRes, devicesRes, mediaRes] = await Promise.all([
        campaignsApi.get(campaignId),
        schedulesApi.list(),
        devicesApi.list(),
        mediaApi.list(),
      ]);

      const loadedCampaign = campaignRes.data;
      if (!loadedCampaign) {
        throw new Error('Campanha não encontrada.');
      }

      const mediaMap = new Map((mediaRes.data ?? []).map((m) => [m.id, m]));
      const timelineItems: CampaignTimelineItem[] = (loadedCampaign.assets ?? [])
        .sort((a, b) => a.position - b.position)
        .map((asset, index) => {
          const media = mediaMap.get(asset.mediaId);
          const isVideo = (asset.media?.mediaType ?? media?.mediaType) === 'VIDEO';
          const maxDuration = isVideo
            ? Math.max(3, ((asset.media?.durationMs ?? media?.durationMs ?? asset.durationMs) / 1000))
            : undefined;

          return {
            id: `${asset.id}-${asset.mediaId}-${index}`,
            mediaId: asset.mediaId,
            name: asset.media?.name ?? media?.name ?? `Criativo ${index + 1}`,
            type: isVideo ? 'video' : 'image',
            duration: Math.max(3, asset.durationMs / 1000),
            maxDuration,
            order: index,
            url: media?.url,
          };
        });

      const allSchedules = schedulesRes.data ?? [];
      const campaignSchedules = allSchedules.filter((schedule) => schedule.campaignId === loadedCampaign.id);

      setCampaign(loadedCampaign);
      setSchedules(campaignSchedules);
      setDevices(devicesRes.data ?? []);

      setName(loadedCampaign.name);
      setObjective(loadedCampaign.objective ?? '');
      setDescription(loadedCampaign.description ?? '');
      setStatus(loadedCampaign.status);
      setStartDate(toDateInputValue(loadedCampaign.startDate));
      setEndDate(toDateInputValue(loadedCampaign.endDate));
      setTimeline(timelineItems);

      setNewScheduleName(`${loadedCampaign.name} - Programação`);
      setNewScheduleStartDate(toDateInputValue(loadedCampaign.startDate) || new Date().toISOString().slice(0, 10));
      setNewScheduleEndDate(toDateInputValue(loadedCampaign.endDate));
    } catch (err) {
      if (err instanceof Error && err.message.includes('Sessão inválida')) {
        clearSessionToken();
        router.replace('/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Erro ao carregar campanha.');
    } finally {
      setIsLoading(false);
    }
  }, [campaignId, router]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSaveCampaign = async () => {
    if (!campaignId) return;

    if (!name.trim()) {
      setError('Nome da campanha é obrigatório.');
      return;
    }

    if (timeline.length === 0) {
      setError('Adicione ao menos um criativo na timeline.');
      return;
    }

    setIsSaving(true);
    setError('');
    setHelper('');

    try {
      await campaignsApi.update(campaignId, {
        name: name.trim(),
        objective: objective.trim() || undefined,
        description: description.trim() || undefined,
        status,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        assets: timeline.map((item, position) => ({
          mediaId: item.mediaId,
          position,
          durationMs: Math.round(item.duration * 1000),
        })),
      });

      setHelper('Campanha atualizada com sucesso.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar campanha.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateSchedule = async () => {
    if (!campaignId || !campaign) return;

    if (newScheduleDevices.length === 0) {
      setError('Selecione ao menos uma tela para criar a programação.');
      return;
    }

    if (!newScheduleStartDate) {
      setError('Informe a data de início da programação.');
      return;
    }

    if (newScheduleStartTime >= newScheduleEndTime) {
      setError('Horário de início deve ser menor que horário de fim.');
      return;
    }

    if (newScheduleDays.length === 0) {
      setError('Selecione pelo menos um dia da semana.');
      return;
    }

    setIsSavingSchedule(true);
    setError('');
    setHelper('');

    try {
      await schedulesApi.create({
        name: newScheduleName.trim() || `${campaign.name} - Programação`,
        sourceType: 'CAMPAIGN',
        campaignId,
        startDate: newScheduleStartDate,
        endDate: newScheduleEndDate || undefined,
        startTime: newScheduleStartTime,
        endTime: newScheduleEndTime,
        frequencyPerHour: newScheduleFrequency,
        daysOfWeek: newScheduleDays,
        priority: newSchedulePriority,
        deviceIds: newScheduleDevices,
      });

      setHelper('Programação criada com sucesso.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar programação.');
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleScheduleStatus = async (scheduleId: string, nextStatus: ScheduleStatus) => {
    setError('');
    setHelper('');

    try {
      if (nextStatus === 'PUBLISHED') {
        await schedulesApi.publish(scheduleId);
      } else {
        await schedulesApi.update(scheduleId, { status: nextStatus });
      }
      setHelper('Status da programação atualizado.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar programação.');
    }
  };

  const toggleDay = (day: number) => {
    setNewScheduleDays((prev) => {
      const set = new Set(prev);
      if (set.has(day)) set.delete(day);
      else set.add(day);
      return Array.from(set).sort((a, b) => a - b);
    });
  };

  const eligibleDevices = React.useMemo(
    () =>
      devices.filter(
        (device) =>
          device.operationalStatus === 'ACTIVE' &&
          (device.status === 'ONLINE' || device.status === 'UNSTABLE'),
      ),
    [devices],
  );

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <HugeiconsIcon icon={RefreshIcon} size={32} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <Button variant="outline" onClick={() => router.push('/campanhas')}>
          <HugeiconsIcon icon={ArrowLeft01Icon} size={16} className="mr-2" />
          Voltar para campanhas
        </Button>
        <Card className="p-6 text-sm text-muted-foreground">
          Campanha não encontrada.
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/45">
            Conteúdo
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-[1.75rem]">
            Editar campanha
          </h1>
          <p className="text-[13px] text-muted-foreground/65">
            Atualize dados, timeline e gerencie programações vinculadas.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/campanhas')}>
            <HugeiconsIcon icon={ArrowLeft01Icon} size={16} className="mr-2" />
            Voltar
          </Button>
          <Button onClick={() => void handleSaveCampaign()} disabled={isSaving}>
            <HugeiconsIcon icon={Save} size={16} className="mr-2" />
            {isSaving ? 'Salvando...' : 'Salvar alterações'}
          </Button>
        </div>
      </div>

      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      {helper && <div className="rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-700">{helper}</div>}

      <Card className="space-y-4 p-4">
        <h2 className="text-base font-semibold">Informações da campanha</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as CampaignStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CAMPAIGN_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {statusLabel(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="objective">Objetivo</Label>
            <Input id="objective" value={objective} onChange={(e) => setObjective(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="start-date">Data de início</Label>
            <Input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="end-date">Data de fim (opcional)</Label>
            <Input id="end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
      </Card>

      <Card className="space-y-4 p-4">
        <h2 className="text-base font-semibold">Timeline da campanha</h2>
        <CampaignTimeline
          items={timeline}
          onChange={setTimeline}
          onSavePlaylist={async () => {
            setHelper('Use "Salvar alterações" para persistir a timeline na campanha.');
          }}
          helperMessage="Use este editor para organizar criativos e ajustar duração de cada inserção."
        />
      </Card>

      <Card className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Programações vinculadas</h2>
          <Badge variant="secondary">{schedules.length} programação(ões)</Badge>
        </div>

        {schedules.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma programação vinculada a esta campanha.</p>
        ) : (
          <div className="space-y-3">
            {schedules.map((schedule) => (
              <Card key={schedule.id} className="space-y-3 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{schedule.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {schedule.startTime}–{schedule.endTime} · {schedule.frequencyPerHour}/h · prioridade {schedule.priority}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{statusLabel(schedule.status)}</Badge>
                    {schedule.status !== 'PUBLISHED' && (
                      <Button size="sm" variant="outline" onClick={() => void handleScheduleStatus(schedule.id, 'PUBLISHED')}>
                        Publicar
                      </Button>
                    )}
                    {schedule.status === 'PUBLISHED' && (
                      <Button size="sm" variant="outline" onClick={() => void handleScheduleStatus(schedule.id, 'PAUSED')}>
                        Pausar
                      </Button>
                    )}
                    {schedule.status === 'PAUSED' && (
                      <Button size="sm" variant="outline" onClick={() => void handleScheduleStatus(schedule.id, 'PUBLISHED')}>
                        Reativar
                      </Button>
                    )}
                    {schedule.status !== 'FINISHED' && (
                      <Button size="sm" variant="outline" onClick={() => void handleScheduleStatus(schedule.id, 'FINISHED')}>
                        Finalizar
                      </Button>
                    )}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Dias: {schedule.daysOfWeek.map((day) => DAYS.find((d) => d.value === day)?.label ?? day).join(', ')}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      <Card className="space-y-4 p-4">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={AddCircleIcon} size={18} />
          <h2 className="text-base font-semibold">Nova programação para esta campanha</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="new-schedule-name">Nome</Label>
            <Input
              id="new-schedule-name"
              value={newScheduleName}
              onChange={(e) => setNewScheduleName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-schedule-freq">Frequência por hora</Label>
            <Input
              id="new-schedule-freq"
              type="number"
              min={1}
              max={120}
              value={newScheduleFrequency}
              onChange={(e) => setNewScheduleFrequency(Number(e.target.value || 1))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-schedule-start-date">Data de início</Label>
            <Input
              id="new-schedule-start-date"
              type="date"
              value={newScheduleStartDate}
              onChange={(e) => setNewScheduleStartDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-schedule-end-date">Data de fim</Label>
            <Input
              id="new-schedule-end-date"
              type="date"
              value={newScheduleEndDate}
              onChange={(e) => setNewScheduleEndDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-schedule-start-time">Hora início</Label>
            <Input
              id="new-schedule-start-time"
              type="time"
              value={newScheduleStartTime}
              onChange={(e) => setNewScheduleStartTime(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-schedule-end-time">Hora fim</Label>
            <Input
              id="new-schedule-end-time"
              type="time"
              value={newScheduleEndTime}
              onChange={(e) => setNewScheduleEndTime(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-schedule-priority">Prioridade</Label>
            <Input
              id="new-schedule-priority"
              type="number"
              min={0}
              value={newSchedulePriority}
              onChange={(e) => setNewSchedulePriority(Number(e.target.value || 0))}
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label>Dias da semana</Label>
            <div className="flex flex-wrap gap-3 rounded-md border p-3">
              {DAYS.map((day) => (
                <label key={day.value} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={newScheduleDays.includes(day.value)}
                    onCheckedChange={() => toggleDay(day.value)}
                  />
                  {day.label}
                </label>
              ))}
            </div>
          </div>

          <div className="md:col-span-2">
            <CampaignTargetSelector
              devices={eligibleDevices}
              selectedDeviceIds={newScheduleDevices}
              onChange={setNewScheduleDevices}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => void handleCreateSchedule()} disabled={isSavingSchedule}>
            {isSavingSchedule ? 'Criando...' : 'Criar programação'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
