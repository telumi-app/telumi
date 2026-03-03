'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  CheckmarkBadge01Icon,
  MegaphoneIcon,
  RefreshIcon,
  Save,
} from '@hugeicons/core-free-icons';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import { Textarea } from '@/components/ui/textarea';

import { campaignsApi } from '@/lib/api/campaigns';
import { devicesApi, type Device } from '@/lib/api/devices';
import { playlistsApi } from '@/lib/api/playlists';
import { schedulesApi } from '@/lib/api/schedules';
import { clearSessionToken, getSessionToken } from '@/lib/auth/session';

import {
  CampaignTimeline,
  type CampaignTimelineItem,
} from './campaign-timeline';
import { CampaignTargetSelector } from './campaign-target-selector';

const STEP_TITLES = [
  'Informações',
  'Playlist',
  'Frequência e telas',
  'Agenda',
  'Revisão',
] as const;

const DRAFT_STORAGE_KEY = 'telumi:campaign_draft' as const;

const DAYS = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
] as const;

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

type WizardForm = {
  name: string;
  objective: string;
  description: string;
  timeline: CampaignTimelineItem[];
  playlistName: string;
  frequencyPerHour: number;
  selectedDeviceIds: string[];
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  priority: number;
};

export function CampaignWizard() {
  const router = useRouter();

  const [step, setStep] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isDraftRestored, setIsDraftRestored] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSavingPlaylist, setIsSavingPlaylist] = React.useState(false);
  const [savedPlaylistId, setSavedPlaylistId] = React.useState<string | null>(null);
  const [helperMessage, setHelperMessage] = React.useState('');
  const [error, setError] = React.useState('');
  const [devices, setDevices] = React.useState<Device[]>([]);

  const [form, setForm] = React.useState<WizardForm>({
    name: '',
    objective: '',
    description: '',
    timeline: [],
    playlistName: '',
    frequencyPerHour: 4,
    selectedDeviceIds: [],
    startDate: getTodayDate(),
    endDate: '',
    startTime: '08:00',
    endTime: '18:00',
    daysOfWeek: [1, 2, 3, 4, 5],
    priority: 0,
  });

  // ── Restaurar rascunho do sessionStorage ao montar ──────────────
  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as { step?: number; form?: Partial<WizardForm> };
        if (draft.form) {
          setForm((prev) => ({
            ...prev,
            ...draft.form,
            // Garantir campos obrigatórios se vieram corrompidos
            timeline: Array.isArray(draft.form?.timeline) ? draft.form.timeline : prev.timeline,
            daysOfWeek: Array.isArray(draft.form?.daysOfWeek) ? draft.form.daysOfWeek : prev.daysOfWeek,
            selectedDeviceIds: Array.isArray(draft.form?.selectedDeviceIds) ? draft.form.selectedDeviceIds : prev.selectedDeviceIds,
          }));
        }
        if (typeof draft.step === 'number' && draft.step >= 0 && draft.step < STEP_TITLES.length) {
          setStep(draft.step);
        }
      }
    } catch {
      // JSON inválido ou storage indisponível — ignora
    }
    setIsDraftRestored(true);
  }, []);

  // ── Persistir rascunho toda vez que form ou step mudar ──────────
  React.useEffect(() => {
    if (!isDraftRestored) return; // Não salva antes de restaurar
    try {
      sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ step, form }));
    } catch {
      // sessionStorage cheio ou indisponível — ignora
    }
  }, [step, form, isDraftRestored]);

  const eligibleDevices = React.useMemo(
    () =>
      devices.filter(
        (device) =>
          device.operationalStatus === 'ACTIVE' &&
          (device.status === 'ONLINE' || device.status === 'UNSTABLE'),
      ),
    [devices],
  );

  React.useEffect(() => {
    if (form.name.trim() && !form.playlistName.trim()) {
      setForm((prev) => ({
        ...prev,
        playlistName: `${prev.name.trim()} - Playlist`,
      }));
    }
  }, [form.name, form.playlistName]);

  React.useEffect(() => {
    const bootstrap = async () => {
      const token = getSessionToken();
      if (!token) {
        router.replace('/login');
        return;
      }

      try {
        const res = await devicesApi.list();
        setDevices(res.data ?? []);
      } catch (err) {
        if (err instanceof Error && err.message.includes('Sessão inválida')) {
          clearSessionToken();
          router.replace('/login');
          return;
        }
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados do wizard.');
      } finally {
        setIsLoading(false);
      }
    };

    void bootstrap();
  }, [router]);

  const setField = <K extends keyof WizardForm>(key: K, value: WizardForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleDay = (day: number) => {
    setForm((prev) => {
      const set = new Set(prev.daysOfWeek);
      if (set.has(day)) set.delete(day);
      else set.add(day);
      return { ...prev, daysOfWeek: Array.from(set).sort((a, b) => a - b) };
    });
  };

  const validateStep = (index: number): string | null => {
    if (index === 0) {
      if (form.name.trim().length < 2) return 'Informe um nome de campanha com pelo menos 2 caracteres.';
      if (form.objective.trim().length < 2) return 'Informe um objetivo para a campanha.';
    }

    if (index === 1) {
      if (form.timeline.length === 0) return 'Adicione pelo menos 1 conteúdo na timeline.';
    }

    if (index === 2) {
      if (form.selectedDeviceIds.length === 0) return 'Selecione ao menos uma tela para a campanha.';
      if (form.frequencyPerHour < 1 || form.frequencyPerHour > 120) {
        return 'A frequência deve estar entre 1 e 120 inserções por hora.';
      }
    }

    if (index === 3) {
      if (!form.startDate) return 'Informe a data de início.';
      if (!form.startTime || !form.endTime) return 'Informe horário de início e fim.';
      if (form.startTime >= form.endTime) return 'O horário de início deve ser anterior ao horário de fim.';
      if (form.daysOfWeek.length === 0) return 'Selecione ao menos um dia da semana.';
    }

    return null;
  };

  const nextStep = () => {
    const validationError = validateStep(step);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setStep((prev) => Math.min(prev + 1, STEP_TITLES.length - 1));
  };

  const prevStep = () => {
    setError('');
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSavePlaylist = async (playlistNameFromModal?: string) => {
    if (form.timeline.length === 0) {
      setError('Adicione conteúdos na timeline para salvar a playlist.');
      return;
    }

    const playlistName = (playlistNameFromModal ?? form.playlistName).trim();
    if (playlistName.length < 2) {
      setError('Defina um nome para a playlist reutilizável.');
      return;
    }

    if (playlistName !== form.playlistName) {
      setField('playlistName', playlistName);
    }

    setIsSavingPlaylist(true);
    setError('');
    setHelperMessage('');

    const payload = {
      name: playlistName,
      description: `Gerada a partir da campanha ${form.name || 'sem nome'}`,
      items: form.timeline.map((item, position) => ({
        mediaId: item.mediaId,
        position,
        durationMs: Math.round(item.duration * 1000),
      })),
    };

    try {
      if (savedPlaylistId) {
        await playlistsApi.update(savedPlaylistId, payload);
        setHelperMessage('Playlist atualizada com sucesso. Você pode reutilizar e editar depois.');
      } else {
        const created = await playlistsApi.create(payload);
        setSavedPlaylistId(created.data?.id ?? null);
        setHelperMessage('Playlist salva com sucesso para reutilização futura.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar playlist.');
    } finally {
      setIsSavingPlaylist(false);
    }
  };

  const submitCampaign = async (publishNow: boolean) => {
    const validationError = validateStep(0) || validateStep(1) || validateStep(2) || validateStep(3);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const campaignRes = await campaignsApi.create({
        name: form.name.trim(),
        objective: form.objective.trim(),
        description: form.description.trim() || undefined,
        startDate: form.startDate,
        endDate: form.endDate || undefined,
        assets: form.timeline.map((item, position) => ({
          mediaId: item.mediaId,
          position,
          durationMs: Math.round(item.duration * 1000),
        })),
      });

      const campaignId = campaignRes.data?.id;

      if (!campaignId) {
        throw new Error('Não foi possível criar a campanha.');
      }

      const scheduleRes = await schedulesApi.create({
        name: `${form.name.trim()} - Programação`,
        sourceType: 'CAMPAIGN',
        campaignId,
        startDate: form.startDate,
        endDate: form.endDate || undefined,
        startTime: form.startTime,
        endTime: form.endTime,
        frequencyPerHour: form.frequencyPerHour,
        daysOfWeek: form.daysOfWeek,
        priority: form.priority,
        deviceIds: form.selectedDeviceIds,
      });

      const scheduleId = scheduleRes.data?.id;

      if (publishNow && scheduleId) {
        await schedulesApi.publish(scheduleId);
        await campaignsApi.update(campaignId, { status: 'ACTIVE' });
      }

      try { sessionStorage.removeItem(DRAFT_STORAGE_KEY); } catch { /* noop */ }
      router.replace('/campanhas');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar campanha.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearDraftAndNavigate = (path: string) => {
    try { sessionStorage.removeItem(DRAFT_STORAGE_KEY); } catch { /* noop */ }
    router.push(path);
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <HugeiconsIcon icon={RefreshIcon} size={28} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Criar campanha</h1>
        <p className="text-sm text-muted-foreground">
          Configure objetivo, timeline de conteúdo, frequência, telas e agenda em um único fluxo.
        </p>
      </div>

      <Card className="p-4">
        <div className="grid gap-2 md:grid-cols-5">
          {STEP_TITLES.map((title, index) => (
            <div key={title} className="flex items-center gap-2 rounded-md border p-2">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                  index <= step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                {index + 1}
              </div>
              <span className="text-xs font-medium">{title}</span>
            </div>
          ))}
        </div>
      </Card>

      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {step === 0 && (
        <Card className="space-y-4 p-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Informações básicas</h2>
            <p className="text-sm text-muted-foreground">Defina o contexto da campanha.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="campaign-name">Nome da campanha</Label>
              <Input
                id="campaign-name"
                placeholder="Ex.: Promoção de Março"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="campaign-objective">Objetivo</Label>
              <Input
                id="campaign-objective"
                placeholder="Ex.: Aumentar visitas na recepção"
                value={form.objective}
                onChange={(e) => setField('objective', e.target.value)}
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="campaign-description">Descrição (opcional)</Label>
              <Textarea
                id="campaign-description"
                placeholder="Detalhes da comunicação e contexto da campanha"
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
              />
            </div>
          </div>
        </Card>
      )}

      {step === 1 && (
        <CampaignTimeline
          items={form.timeline}
          onChange={(items) => setField('timeline', items)}
          onSavePlaylist={handleSavePlaylist}
          isSavingPlaylist={isSavingPlaylist}
          helperMessage={helperMessage}
        />
      )}

      {step === 2 && (
        <div className="space-y-4">
          <Card className="space-y-4 p-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Frequência e prioridade</h2>
              <p className="text-sm text-muted-foreground">Defina ritmo de inserção e peso da campanha.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Frequência (inserções por hora)</Label>
                <Select
                  value={String(form.frequencyPerHour)}
                  onValueChange={(value) => setField('frequencyPerHour', Number(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {[2, 4, 6, 8, 12, 20, 30, 60].map((option) => (
                      <SelectItem key={option} value={String(option)}>
                        {option} por hora
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Prioridade</Label>
                <Select
                  value={String(form.priority)}
                  onValueChange={(value) => setField('priority', Number(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Normal</SelectItem>
                    <SelectItem value="1">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <CampaignTargetSelector
              devices={eligibleDevices}
              selectedDeviceIds={form.selectedDeviceIds}
              onChange={(deviceIds) => setField('selectedDeviceIds', deviceIds)}
            />
          </Card>
        </div>
      )}

      {step === 3 && (
        <Card className="space-y-4 p-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Agenda de exibição</h2>
            <p className="text-sm text-muted-foreground">Determine período, horário e dias da semana.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="start-date">Data de início</Label>
              <Input
                id="start-date"
                type="date"
                value={form.startDate}
                onChange={(e) => setField('startDate', e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="end-date">Data de fim (opcional)</Label>
              <Input
                id="end-date"
                type="date"
                value={form.endDate}
                onChange={(e) => setField('endDate', e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="start-time">Horário de início</Label>
              <Input
                id="start-time"
                type="time"
                value={form.startTime}
                onChange={(e) => setField('startTime', e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="end-time">Horário de fim</Label>
              <Input
                id="end-time"
                type="time"
                value={form.endTime}
                onChange={(e) => setField('endTime', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Dias da semana</Label>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-7">
              {DAYS.map((day) => {
                const checked = form.daysOfWeek.includes(day.value);
                return (
                  <label key={day.value} className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm">
                    <Checkbox checked={checked} onCheckedChange={() => toggleDay(day.value)} />
                    {day.label}
                  </label>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {step === 4 && (
        <Card className="space-y-4 p-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Revisão final</h2>
            <p className="text-sm text-muted-foreground">Confirme os dados antes de salvar ou publicar.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase text-muted-foreground">Campanha</p>
              <p className="text-sm font-medium">{form.name || '—'}</p>
              <p className="text-sm text-muted-foreground">Objetivo: {form.objective || '—'}</p>
            </div>

            <div className="rounded-md border p-3">
              <p className="text-xs uppercase text-muted-foreground">Timeline</p>
              <p className="text-sm font-medium">{form.timeline.length} clipes</p>
              <p className="text-sm text-muted-foreground">Playlist: {form.playlistName || 'não salva'}</p>
            </div>

            <div className="rounded-md border p-3">
              <p className="text-xs uppercase text-muted-foreground">Exibição</p>
              <p className="text-sm font-medium">{form.frequencyPerHour}/h · prioridade {form.priority === 1 ? 'alta' : 'normal'}</p>
              <p className="text-sm text-muted-foreground">{form.selectedDeviceIds.length} telas selecionadas</p>
            </div>

            <div className="rounded-md border p-3">
              <p className="text-xs uppercase text-muted-foreground">Agenda</p>
              <p className="text-sm font-medium">{form.startDate} {form.endDate ? `até ${form.endDate}` : '(sem data fim)'}</p>
              <p className="text-sm text-muted-foreground">{form.startTime} – {form.endTime}</p>
            </div>
          </div>

          <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Fluxo de publicação</p>
            <p>Salvar rascunho cria campanha + programação em DRAFT.</p>
            <p>Publicar agora cria e já publica a programação, ativando a campanha.</p>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" onClick={() => clearDraftAndNavigate('/campanhas')}>
          Cancelar
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={prevStep} disabled={step === 0 || isSubmitting} className="gap-2">
            <HugeiconsIcon icon={ArrowLeft01Icon} size={14} />
            Voltar
          </Button>

          {step < STEP_TITLES.length - 1 && (
            <Button onClick={nextStep} disabled={isSubmitting} className="gap-2">
              Avançar
              <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
            </Button>
          )}

          {step === STEP_TITLES.length - 1 && (
            <>
              <Button
                variant="secondary"
                onClick={() => void submitCampaign(false)}
                disabled={isSubmitting}
                className="gap-2"
              >
                <HugeiconsIcon icon={Save} size={14} />
                {isSubmitting ? 'Salvando...' : 'Salvar rascunho'}
              </Button>
              <Button onClick={() => void submitCampaign(true)} disabled={isSubmitting} className="gap-2">
                <HugeiconsIcon icon={CheckmarkBadge01Icon} size={14} />
                {isSubmitting ? 'Publicando...' : 'Publicar agora'}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={MegaphoneIcon} size={14} />
          <span>
            Boas práticas: salve a playlist para reaproveitar e editar em <Badge variant="outline">Playlists</Badge>.
          </span>
        </div>
      </div>
    </div>
  );
}
