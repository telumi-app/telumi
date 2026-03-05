'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowLeft01Icon,
  CalendarSyncIcon,
  MegaphoneIcon,
  PlayListIcon,
  ComputerIcon,
  Tick02Icon,
} from '@hugeicons/core-free-icons';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

import { schedulesApi } from '@/lib/api/schedules';
import { campaignsApi, type Campaign } from '@/lib/api/campaigns';
import { playlistsApi, type Playlist } from '@/lib/api/playlists';
import { devicesApi, type Device } from '@/lib/api/devices';
import { getSessionToken, clearSessionToken } from '@/lib/auth/session';

// ─── Constants ─────────────────────────────────────────────────────

const DAYS_OF_WEEK = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
];

// ─── Component ─────────────────────────────────────────────────────

export function ScheduleWizard() {
  const router = useRouter();

  // Data
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);
  const [playlists, setPlaylists] = React.useState<Playlist[]>([]);
  const [devices, setDevices] = React.useState<Device[]>([]);
  const [loadingData, setLoadingData] = React.useState(true);
  const [loadError, setLoadError] = React.useState('');

  // Form state
  const [name, setName] = React.useState('');
  const [sourceType, setSourceType] = React.useState<'CAMPAIGN' | 'PLAYLIST'>('CAMPAIGN');
  const [campaignId, setCampaignId] = React.useState('');
  const [playlistId, setPlaylistId] = React.useState('');
  const [startDate, setStartDate] = React.useState(
    () => new Date().toISOString().split('T')[0],
  );
  const [endDate, setEndDate] = React.useState('');
  const [startTime, setStartTime] = React.useState('08:00');
  const [endTime, setEndTime] = React.useState('22:00');
  const [frequencyPerHour, setFrequencyPerHour] = React.useState(1);
  const [daysOfWeek, setDaysOfWeek] = React.useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [selectedDeviceIds, setSelectedDeviceIds] = React.useState<string[]>([]);
  const [publishNow, setPublishNow] = React.useState(true);

  // Submission
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState('');

  // ── Load data ────────────────────────────────────────────────────

  React.useEffect(() => {
    const token = getSessionToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    void (async () => {
      try {
        const [campaignsRes, playlistsRes, devicesRes] = await Promise.all([
          campaignsApi.list(),
          playlistsApi.list(),
          devicesApi.list(),
        ]);
        setCampaigns(
          (campaignsRes.data ?? []).filter((c) =>
            ['DRAFT', 'ACTIVE', 'PAUSED'].includes(c.status),
          ),
        );
        setPlaylists(playlistsRes.data ?? []);
        setDevices(devicesRes.data ?? []);
      } catch (err) {
        if (err instanceof Error && err.message.includes('Sessão inválida')) {
          clearSessionToken();
          router.replace('/login');
          return;
        }
        setLoadError(
          err instanceof Error ? err.message : 'Erro ao carregar dados.',
        );
      } finally {
        setLoadingData(false);
      }
    })();
  }, [router]);

  // ── Helpers ──────────────────────────────────────────────────────

  const toggleDay = (day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const toggleDevice = (deviceId: string) => {
    setSelectedDeviceIds((prev) =>
      prev.includes(deviceId)
        ? prev.filter((id) => id !== deviceId)
        : [...prev, deviceId],
    );
  };

  const isValid = React.useMemo(() => {
    if (!name.trim()) return false;
    if (sourceType === 'CAMPAIGN' && !campaignId) return false;
    if (sourceType === 'PLAYLIST' && !playlistId) return false;
    if (!startDate) return false;
    if (!startTime || !endTime) return false;
    if (daysOfWeek.length === 0) return false;
    if (selectedDeviceIds.length === 0) return false;
    return true;
  }, [name, sourceType, campaignId, playlistId, startDate, startTime, endTime, daysOfWeek, selectedDeviceIds]);

  // ── Submit ───────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const payload = {
        name: name.trim(),
        sourceType,
        ...(sourceType === 'CAMPAIGN' ? { campaignId } : { playlistId }),
        startDate,
        ...(endDate ? { endDate } : {}),
        startTime,
        endTime,
        frequencyPerHour,
        daysOfWeek,
        deviceIds: selectedDeviceIds,
      };

      const created = await schedulesApi.create(payload);

      if (publishNow && created.data?.id) {
        await schedulesApi.publish(created.data.id);
      }

      router.push('/programacao');
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Erro ao criar programação.',
      );
      setIsSubmitting(false);
    }
  };

  // ── Loading state ────────────────────────────────────────────────

  if (loadingData) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <HugeiconsIcon icon={CalendarSyncIcon} size={32} className="animate-pulse text-muted-foreground" />
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="mt-0.5 shrink-0"
          type="button"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={20} />
        </Button>
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">
            Nova programação
          </h1>
          <p className="text-sm text-muted-foreground">
            Defina quando e onde a campanha ou playlist será exibida.
          </p>
        </div>
      </div>

      {loadError && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {loadError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* ── Seção 1: Identificação ── */}
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Identificação</h2>
            <p className="text-sm text-muted-foreground">
              Dê um nome para identificar esta programação.
            </p>
          </div>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="schedule-name">Nome da programação *</Label>
            <Input
              id="schedule-name"
              placeholder="Ex: Campanha verão — segundo turno"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
        </section>

        {/* ── Seção 2: Conteúdo ── */}
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Conteúdo</h2>
            <p className="text-sm text-muted-foreground">
              Escolha o que será exibido: uma campanha ou uma playlist.
            </p>
          </div>
          <Separator />

          {/* Source type toggle */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setSourceType('CAMPAIGN')}
              className={`flex flex-1 items-center gap-3 rounded-lg border p-4 text-left transition-colors ${
                sourceType === 'CAMPAIGN'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-muted/50'
              }`}
            >
              <HugeiconsIcon
                icon={MegaphoneIcon}
                size={20}
                className={
                  sourceType === 'CAMPAIGN'
                    ? 'text-primary'
                    : 'text-muted-foreground'
                }
              />
              <div>
                <p className="text-sm font-medium">Campanha</p>
                <p className="text-xs text-muted-foreground">
                  Exibir uma campanha existente
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSourceType('PLAYLIST')}
              className={`flex flex-1 items-center gap-3 rounded-lg border p-4 text-left transition-colors ${
                sourceType === 'PLAYLIST'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-muted/50'
              }`}
            >
              <HugeiconsIcon
                icon={PlayListIcon}
                size={20}
                className={
                  sourceType === 'PLAYLIST'
                    ? 'text-primary'
                    : 'text-muted-foreground'
                }
              />
              <div>
                <p className="text-sm font-medium">Playlist</p>
                <p className="text-xs text-muted-foreground">
                  Exibir uma playlist existente
                </p>
              </div>
            </button>
          </div>

          {/* Campaign selector */}
          {sourceType === 'CAMPAIGN' && (
            <div className="space-y-2">
              <Label>Campanha *</Label>
              {campaigns.length === 0 ? (
                <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Nenhuma campanha disponível.{' '}
                  <button
                    type="button"
                    className="text-primary underline underline-offset-2"
                    onClick={() => router.push('/campanhas/criar')}
                  >
                    Criar campanha
                  </button>
                </p>
              ) : (
                <Select value={campaignId} onValueChange={setCampaignId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma campanha" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Playlist selector */}
          {sourceType === 'PLAYLIST' && (
            <div className="space-y-2">
              <Label>Playlist *</Label>
              {playlists.length === 0 ? (
                <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Nenhuma playlist disponível.{' '}
                  <button
                    type="button"
                    className="text-primary underline underline-offset-2"
                    onClick={() => router.push('/playlists')}
                  >
                    Criar playlist
                  </button>
                </p>
              ) : (
                <Select value={playlistId} onValueChange={setPlaylistId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma playlist" />
                  </SelectTrigger>
                  <SelectContent>
                    {playlists.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </section>

        {/* ── Seção 3: Agenda ── */}
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Agenda</h2>
            <p className="text-sm text-muted-foreground">
              Configure as datas, horários e dias de exibição.
            </p>
          </div>
          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Data de início *</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">Data de término</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-time">Hora de início *</Label>
              <Input
                id="start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-time">Hora de término *</Label>
              <Input
                id="end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="frequency">Exibições / hora</Label>
              <Input
                id="frequency"
                type="number"
                min={1}
                max={60}
                value={frequencyPerHour}
                onChange={(e) => setFrequencyPerHour(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Days of week */}
          <div className="space-y-3">
            <Label>Dias da semana *</Label>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map((day) => {
                const active = daysOfWeek.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background hover:bg-muted'
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
            {daysOfWeek.length === 0 && (
              <p className="text-xs text-destructive">
                Selecione ao menos um dia.
              </p>
            )}
          </div>
        </section>

        {/* ── Seção 4: Telas ── */}
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Telas de destino</h2>
            <p className="text-sm text-muted-foreground">
              Selecione em quais telas essa programação será exibida.
            </p>
          </div>
          <Separator />

          {devices.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Nenhuma tela cadastrada.{' '}
              <button
                type="button"
                className="text-primary underline underline-offset-2"
                onClick={() => router.push('/telas')}
              >
                Cadastrar tela
              </button>
            </p>
          ) : (
            <div className="space-y-2">
              {devices.map((device) => {
                const selected = selectedDeviceIds.includes(device.id);
                return (
                  <label
                    key={device.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                      selected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <Checkbox
                      checked={selected}
                      onCheckedChange={() => toggleDevice(device.id)}
                    />
                    <div className="flex flex-1 items-center gap-2">
                      <HugeiconsIcon
                        icon={ComputerIcon}
                        size={16}
                        className="shrink-0 text-muted-foreground"
                      />
                      <span className="text-sm font-medium">{device.name}</span>
                      {device.locationName && (
                        <span className="text-xs text-muted-foreground">
                          — {device.locationName}
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-xs ${
                        device.status === 'ONLINE'
                          ? 'text-green-600'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {device.status === 'ONLINE' ? 'Online' : device.status === 'OFFLINE' ? 'Offline' : device.status}
                    </span>
                  </label>
                );
              })}
              {selectedDeviceIds.length === 0 && (
                <p className="text-xs text-destructive">
                  Selecione ao menos uma tela.
                </p>
              )}
            </div>
          )}
        </section>

        {/* ── Seção 5: Publicar ── */}
        <section className="space-y-4">
          <Separator />
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4">
            <Checkbox
              id="publish-now"
              checked={publishNow}
              onCheckedChange={(v) => setPublishNow(v === true)}
              className="mt-0.5"
            />
            <div>
              <p className="text-sm font-medium">Publicar imediatamente</p>
              <p className="text-xs text-muted-foreground">
                A programação será ativada assim que criada. Você pode pausá-la depois.
              </p>
            </div>
          </label>
        </section>

        {/* ── Erro de envio ── */}
        {submitError && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {submitError}
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex justify-end gap-3 pb-8">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={!isValid || isSubmitting} className="gap-2">
            {isSubmitting ? (
              <>
                <HugeiconsIcon icon={CalendarSyncIcon} size={16} className="animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <HugeiconsIcon icon={publishNow ? Tick02Icon : CalendarSyncIcon} size={16} />
                {publishNow ? 'Criar e publicar' : 'Salvar rascunho'}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
