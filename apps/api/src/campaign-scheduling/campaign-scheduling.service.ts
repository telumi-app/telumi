import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createHash } from 'crypto';

import { DatabaseService } from '@/modules/database';

import { CapacityEngineService } from './capacity-engine.service';
import { ValidateScheduleDto } from './dto/validate-schedule.dto';
import { ConfirmScheduleDto } from './dto/confirm-schedule.dto';

import {
  computeRate,
  computeTimelineDuration,
  computeTimelineHash,
  expandDateRange,
  expandOccurrences,
  HOLD_TTL_MS,
  MAX_SUGGESTIONS,
  ScheduleErrorCode,
  SuggestionType,
  validateTimeline,
  ValidationStatus,
} from '@telumi/shared';

import type {
  PlannedOccurrence,
  ScheduleSuggestion,
  ScheduleValidationResponse,
  ScreenValidationSummary,
  TimelineItem,
} from '@telumi/shared';

/**
 * CampaignSchedulingService — orquestra o fluxo de validação e confirmação
 * do agendamento de campanhas no modo INTERNAL.
 *
 * Fluxo:
 * 1) validate: calcula occurrences, verifica capacidade, cria hold
 * 2) confirm: revalida, insere ScheduleRule + ScheduleOccurrence, consome hold
 */
@Injectable()
export class CampaignSchedulingService {
  private readonly logger = new Logger(CampaignSchedulingService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly capacityEngine: CapacityEngineService,
  ) {}

  // ─── VALIDATE ──────────────────────────────────────────────────────

  async validate(
    workspaceId: string,
    campaignId: string,
    dto: ValidateScheduleDto,
  ): Promise<ScheduleValidationResponse> {
    // Expirar holds velhos primeiro
    await this.capacityEngine.expireStaleHolds();

    // 1) Carregar campanha + assets
    const campaign = await this.db.campaign.findFirst({
      where: { id: campaignId, workspaceId },
      include: {
        assets: {
          orderBy: { position: 'asc' },
          include: { media: { select: { id: true, durationMs: true } } },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campanha não encontrada.');
    }

    // 2) Validar timeline
    const timelineItems: TimelineItem[] = campaign.assets.map((a, i) => ({
      creativeId: a.mediaId,
      durationSeconds: a.durationMs / 1000,
      orderIndex: i,
    }));

    const tlValidation = validateTimeline(timelineItems);
    if (!tlValidation.valid) {
      return this.buildInvalidResponse(
        ScheduleErrorCode.INVALID_TIMELINE,
        dto,
        tlValidation.durationSeconds,
      );
    }

    // 3) Validar datas
    if (dto.dateStart > dto.dateEnd) {
      return this.buildInvalidResponse(
        ScheduleErrorCode.INVALID_DATES,
        dto,
        tlValidation.durationSeconds,
      );
    }

    // 4) Validar janelas
    if (dto.windows.length === 0) {
      return this.buildInvalidResponse(
        ScheduleErrorCode.INVALID_WINDOW,
        dto,
        tlValidation.durationSeconds,
      );
    }

    // 5) Verificar telas elegíveis
    const eligibleScreens = await this.db.device.findMany({
      where: {
        id: { in: dto.screenIds },
        workspaceId,
        operationalStatus: 'ACTIVE',
      },
      select: { id: true, name: true },
    });

    if (eligibleScreens.length === 0) {
      return this.buildInvalidResponse(
        ScheduleErrorCode.NO_ELIGIBLE_SCREENS,
        dto,
        tlValidation.durationSeconds,
      );
    }

    const eligibleIds = eligibleScreens.map((s) => s.id);
    const screenNameMap = new Map(eligibleScreens.map((s) => [s.id, s.name]));

    // 6) Calcular rate
    const timelineDurationSeconds = tlValidation.durationSeconds;
    const rate = computeRate(timelineDurationSeconds, dto.playsPerHour);

    // 7) Expandir datas e occurrences
    const dates = expandDateRange(dto.dateStart, dto.dateEnd, dto.daysOfWeek);
    if (dates.length === 0) {
      return this.buildInvalidResponse(
        ScheduleErrorCode.INVALID_DATES,
        dto,
        timelineDurationSeconds,
      );
    }

    const plannedOccurrences = expandOccurrences({
      dates,
      windows: dto.windows,
      screenIds: eligibleIds,
      timezone: dto.timezone,
      playsPerHour: dto.playsPerHour,
      timelineDurationSeconds,
      rate,
    });

    // 8) Checar capacidade por tela
    const screenSummaries: ScreenValidationSummary[] = [];
    const okScreenIds: string[] = [];
    let globalMinMaxPph = Infinity;
    let allFit = true;
    let someFit = false;

    // Agrupar occurrences por tela
    const occByScreen = new Map<string, typeof plannedOccurrences>();
    for (const occ of plannedOccurrences) {
      if (!occByScreen.has(occ.screenId)) {
        occByScreen.set(occ.screenId, []);
      }
      occByScreen.get(occ.screenId)!.push(occ);
    }

    for (const [screenId, occs] of occByScreen) {
      let screenFits = true;
      let screenMinMaxPph = Infinity;

      for (const occ of occs) {
        const result = await this.capacityEngine.checkScreenCapacity(
          screenId,
          occ.startAtUtc,
          occ.endAtUtc,
          rate,
          timelineDurationSeconds,
        );

        if (!result.fits) {
          screenFits = false;
          allFit = false;
        }
        if (result.maxPlaysPerHour < screenMinMaxPph) {
          screenMinMaxPph = result.maxPlaysPerHour;
        }
      }

      if (screenFits) {
        someFit = true;
        okScreenIds.push(screenId);
      }

      if (screenMinMaxPph < globalMinMaxPph) {
        globalMinMaxPph = screenMinMaxPph;
      }

      screenSummaries.push({
        screenId,
        screenName: screenNameMap.get(screenId) ?? screenId,
        status: screenFits ? ValidationStatus.OK : ValidationStatus.SEM_CAPACIDADE,
        reason: screenFits ? null : ScheduleErrorCode.CAPACITY_FULL,
        maxPlaysPerHourAllowed: screenMinMaxPph === Infinity ? dto.playsPerHour : screenMinMaxPph,
      });
    }

    // 9) Determinar status global
    let status: ValidationStatus;
    let code: ScheduleErrorCode | null = null;

    if (allFit) {
      status = ValidationStatus.OK;
    } else if (someFit) {
      status = ValidationStatus.PARCIAL;
      code = ScheduleErrorCode.CAPACITY_PARTIAL;
    } else {
      status = ValidationStatus.SEM_CAPACIDADE;
      code = ScheduleErrorCode.CAPACITY_FULL;
    }

    // 10) Gerar sugestões
    const suggestions = this.buildSuggestions(
      status,
      globalMinMaxPph === Infinity ? 0 : globalMinMaxPph,
      okScreenIds,
      dto,
    );

    // 11) Criar hold (se OK ou PARCIAL)
    let holdId: string | null = null;
    let holdExpiresAt: string | null = null;

    if (status === ValidationStatus.OK || status === ValidationStatus.PARCIAL) {
      // Normalizar payload e calcular hash
      const payloadHash = this.computePayloadHash(dto, tlValidation.hash);

      // Invalidar holds anteriores para esta campanha
      await this.db.capacityHold.updateMany({
        where: {
          campaignId,
          status: 'ACTIVE',
        },
        data: { status: 'EXPIRED' },
      });

      const expiresAt = new Date(Date.now() + HOLD_TTL_MS);

      // Serializar occurrences para o hold
      const holdOccurrences: PlannedOccurrence[] = plannedOccurrences
        .filter((o) => okScreenIds.includes(o.screenId)) // só incluir telas que cabem
        .map((o) => ({
          screenId: o.screenId,
          startAtUtc: o.startAtUtc.toISOString(),
          endAtUtc: o.endAtUtc.toISOString(),
          playsPerHour: o.playsPerHour,
          rate: o.rate,
          timelineDurationSeconds: o.timelineDurationSeconds,
        }));

      const hold = await this.db.capacityHold.create({
        data: {
          workspaceId,
          campaignId,
          payloadHash,
          expiresAt,
          occurrencesJson: holdOccurrences as unknown as object,
          status: 'ACTIVE',
        },
      });

      holdId = hold.id;
      holdExpiresAt = expiresAt.toISOString();
    }

    return {
      status,
      code,
      eligibleScreensCount: eligibleScreens.length,
      requestedScreensCount: dto.screenIds.length,
      timelineDurationSeconds,
      playsPerHour: dto.playsPerHour,
      rate,
      screenSummaries,
      suggestions,
      holdId,
      holdExpiresAt,
    };
  }

  // ─── CONFIRM ───────────────────────────────────────────────────────

  async confirm(
    workspaceId: string,
    campaignId: string,
    dto: ConfirmScheduleDto,
  ): Promise<{ success: boolean; ruleId: string; occurrenceCount: number }> {
    // 1) Carregar hold
    const hold = await this.db.capacityHold.findFirst({
      where: {
        id: dto.holdId,
        campaignId,
        workspaceId,
      },
    });

    if (!hold) {
      throw new NotFoundException(ScheduleErrorCode.HOLD_NOT_FOUND);
    }

    if (hold.status !== 'ACTIVE') {
      throw new UnprocessableEntityException(ScheduleErrorCode.HOLD_EXPIRED);
    }

    if (hold.expiresAt < new Date()) {
      // Expirar e rejeitar
      await this.db.capacityHold.update({
        where: { id: hold.id },
        data: { status: 'EXPIRED' },
      });
      throw new UnprocessableEntityException(ScheduleErrorCode.HOLD_EXPIRED);
    }

    // 2) Verificar idempotência
    const existingByKey = await this.db.capacityHold.findFirst({
      where: {
        idempotencyKey: dto.idempotencyKey,
        status: 'CONSUMED',
      },
    });

    if (existingByKey) {
      throw new ConflictException(ScheduleErrorCode.IDEMPOTENCY_CONFLICT);
    }

    // 3) Verificar que a timeline da campanha não mudou
    const campaign = await this.db.campaign.findFirst({
      where: { id: campaignId, workspaceId },
      include: {
        assets: {
          orderBy: { position: 'asc' },
          include: { media: { select: { id: true, durationMs: true } } },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campanha não encontrada.');
    }

    const timelineItems: TimelineItem[] = campaign.assets.map((a, i) => ({
      creativeId: a.mediaId,
      durationSeconds: a.durationMs / 1000,
      orderIndex: i,
    }));

    const currentHash = computeTimelineHash(timelineItems);
    const currentDuration = computeTimelineDuration(timelineItems);

    // Extrair o timeline hash do payloadHash (re-computar)
    // O payloadHash inclui o timeline hash, então comparar indiretamente
    // verificando os occurrences do hold vs a duração atual
    const holdOccurrences = hold.occurrencesJson as unknown as PlannedOccurrence[];
    if (holdOccurrences.length > 0) {
      const holdDuration = holdOccurrences[0].timelineDurationSeconds;
      if (holdDuration !== currentDuration) {
        throw new UnprocessableEntityException(
          ScheduleErrorCode.CAMPAIGN_CHANGED_SINCE_VALIDATION,
        );
      }
    }

    // 4) Re-validar capacidade (excluindo o próprio hold)
    for (const occ of holdOccurrences) {
      const result = await this.capacityEngine.checkScreenCapacity(
        occ.screenId,
        new Date(occ.startAtUtc),
        new Date(occ.endAtUtc),
        occ.rate,
        occ.timelineDurationSeconds,
        undefined,
        hold.id, // excluir o próprio hold da contagem
      );

      if (!result.fits) {
        throw new UnprocessableEntityException(ScheduleErrorCode.HOLD_MISMATCH);
      }
    }

    // 5) Executar inserção em transação
    const result = await this.db.$transaction(async (tx) => {
      // Criar ScheduleRule
      // Reconstruir os dados do rule a partir do hold
      const screenIds = [...new Set(holdOccurrences.map((o) => o.screenId))];
      const playsPerHour = holdOccurrences[0]?.playsPerHour ?? 12;

      // Extrair datas/janelas do hold occurrences
      const startDates = holdOccurrences.map((o) => new Date(o.startAtUtc));
      const endDates = holdOccurrences.map((o) => new Date(o.endAtUtc));
      const dateStart = new Date(Math.min(...startDates.map((d) => d.getTime())));
      const dateEnd = new Date(Math.max(...endDates.map((d) => d.getTime())));

      const rule = await tx.scheduleRule.create({
        data: {
          workspaceId,
          campaignId,
          timezone: 'America/Sao_Paulo', // Do workspace
          dateStart,
          dateEnd,
          daysOfWeek: [],
          windows: [],
          playsPerHour,
          screenIds,
        },
      });

      // Criar ScheduleOccurrence em batch
      const occurrenceData = holdOccurrences.map((occ) => ({
        workspaceId,
        campaignId,
        screenId: occ.screenId,
        sourceRuleId: rule.id,
        startAtUtc: new Date(occ.startAtUtc),
        endAtUtc: new Date(occ.endAtUtc),
        playsPerHour: occ.playsPerHour,
        rate: occ.rate,
        timelineDurationSnapshotSeconds: occ.timelineDurationSeconds,
        status: 'ACTIVE' as const,
      }));

      await tx.scheduleOccurrence.createMany({ data: occurrenceData });

      // Atualizar campaign com snapshot
      await tx.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'ACTIVE',
          timelineDurationSnapshotSeconds: currentDuration,
          timelineHash: currentHash,
        },
      });

      // Consumir hold + gravar idempotency key
      await tx.capacityHold.update({
        where: { id: hold.id },
        data: {
          status: 'CONSUMED',
          idempotencyKey: dto.idempotencyKey,
        },
      });

      return { ruleId: rule.id, occurrenceCount: occurrenceData.length };
    });

    this.logger.log(
      `Campaign ${campaignId} scheduled: rule=${result.ruleId}, ` +
        `occurrences=${result.occurrenceCount}`,
    );

    return {
      success: true,
      ruleId: result.ruleId,
      occurrenceCount: result.occurrenceCount,
    };
  }

  // ─── PLAYER ENDPOINT ──────────────────────────────────────────────

  async getScreenContent(
    screenId: string,
    at?: Date,
  ): Promise<{
    campaigns: Array<{
      campaignId: string;
      campaignName: string;
      playsPerHour: number;
      rate: number;
      timeline: Array<{
        assetId: string;
        storageKey: string;
        durationSeconds: number;
        position: number;
        mediaType: string;
      }>;
    }>;
    fallbackPlaylistId: string | null;
  }> {
    const now = at ?? new Date();

    // Buscar occurrences ativas para esta tela no momento atual
    const occurrences = await this.db.scheduleOccurrence.findMany({
      where: {
        screenId,
        status: 'ACTIVE',
        startAtUtc: { lte: now },
        endAtUtc: { gt: now },
      },
      select: {
        campaignId: true,
        playsPerHour: true,
        rate: true,
      },
    });

    // Agrupar por campanha (pode haver múltiplas occurrences no mesmo intervalo)
    const campaignMap = new Map<string, { playsPerHour: number; rate: number }>();
    for (const occ of occurrences) {
      if (!campaignMap.has(occ.campaignId)) {
        campaignMap.set(occ.campaignId, {
          playsPerHour: occ.playsPerHour,
          rate: occ.rate,
        });
      }
    }

    const campaigns: Array<{
      campaignId: string;
      campaignName: string;
      playsPerHour: number;
      rate: number;
      timeline: Array<{
        assetId: string;
        storageKey: string;
        durationSeconds: number;
        position: number;
        mediaType: string;
      }>;
    }> = [];

    if (campaignMap.size > 0) {
      const campaignData = await this.db.campaign.findMany({
        where: { id: { in: [...campaignMap.keys()] } },
        include: {
          assets: {
            orderBy: { position: 'asc' },
            include: {
              media: {
                select: {
                  id: true,
                  storageKey: true,
                  durationMs: true,
                  mediaType: true,
                },
              },
            },
          },
        },
      });

      for (const c of campaignData) {
        const meta = campaignMap.get(c.id);
        if (!meta) continue;

        campaigns.push({
          campaignId: c.id,
          campaignName: c.name,
          playsPerHour: meta.playsPerHour,
          rate: meta.rate,
          timeline: c.assets.map((a) => ({
            assetId: a.mediaId,
            storageKey: a.media.storageKey,
            durationSeconds: a.durationMs / 1000,
            position: a.position,
            mediaType: a.media.mediaType,
          })),
        });
      }
    }

    // Fallback playlist
    const screen = await this.db.device.findUnique({
      where: { id: screenId },
      select: { workspaceId: true },
    });

    let fallbackPlaylistId: string | null = null;
    if (screen) {
      const workspace = await this.db.workspace.findUnique({
        where: { id: screen.workspaceId },
        select: { fallbackPlaylistId: true },
      });
      fallbackPlaylistId = workspace?.fallbackPlaylistId ?? null;
    }

    return { campaigns, fallbackPlaylistId };
  }

  // ─── HELPERS ───────────────────────────────────────────────────────

  private computePayloadHash(dto: ValidateScheduleDto, timelineHash: string): string {
    // Normalizar: ordenar arrays para hash estável
    const normalized = {
      timezone: dto.timezone,
      dateStart: dto.dateStart,
      dateEnd: dto.dateEnd,
      daysOfWeek: [...dto.daysOfWeek].sort(),
      windows: [...dto.windows].sort((a, b) => a.startTime.localeCompare(b.startTime)),
      playsPerHour: dto.playsPerHour,
      screenIds: [...dto.screenIds].sort(),
      timelineHash,
    };
    return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  }

  private buildInvalidResponse(
    code: ScheduleErrorCode,
    dto: ValidateScheduleDto,
    timelineDurationSeconds: number,
  ): ScheduleValidationResponse {
    return {
      status: ValidationStatus.INVALIDO,
      code,
      eligibleScreensCount: 0,
      requestedScreensCount: dto.screenIds.length,
      timelineDurationSeconds,
      playsPerHour: dto.playsPerHour,
      rate: computeRate(timelineDurationSeconds, dto.playsPerHour),
      screenSummaries: [],
      suggestions: [],
      holdId: null,
      holdExpiresAt: null,
    };
  }

  private buildSuggestions(
    status: ValidationStatus,
    globalMinMaxPph: number,
    okScreenIds: string[],
    dto: ValidateScheduleDto,
  ): ScheduleSuggestion[] {
    if (status === ValidationStatus.OK) return [];

    const suggestions: ScheduleSuggestion[] = [];

    // 1) Reduzir frequência
    if (globalMinMaxPph >= 1 && globalMinMaxPph < dto.playsPerHour) {
      suggestions.push({
        type: SuggestionType.REDUCE_FREQUENCY,
        label: 'SUGGESTION_REDUCE_FREQUENCY',
        payload: { playsPerHour: globalMinMaxPph },
      });
    }

    // 2) Shift de janela (para cada janela)
    for (const window of dto.windows) {
      const startMin = parseInt(window.startTime.split(':')[0]) * 60 +
        parseInt(window.startTime.split(':')[1]);
      const endMin = parseInt(window.endTime.split(':')[0]) * 60 +
        parseInt(window.endTime.split(':')[1]);

      const shiftMinutes = 30;

      // Shift para frente
      if (endMin + shiftMinutes <= 23 * 60 + 59) {
        const newStartH = Math.floor((startMin + shiftMinutes) / 60);
        const newStartM = (startMin + shiftMinutes) % 60;
        const newEndH = Math.floor((endMin + shiftMinutes) / 60);
        const newEndM = (endMin + shiftMinutes) % 60;
        suggestions.push({
          type: SuggestionType.SHIFT_WINDOW,
          label: 'SUGGESTION_SHIFT_WINDOW_LATER',
          payload: {
            window: {
              startTime: `${String(newStartH).padStart(2, '0')}:${String(newStartM).padStart(2, '0')}`,
              endTime: `${String(newEndH).padStart(2, '0')}:${String(newEndM).padStart(2, '0')}`,
            },
          },
        });
      }

      if (suggestions.length >= MAX_SUGGESTIONS) break;
    }

    // 3) Reduzir telas
    if (
      okScreenIds.length > 0 &&
      okScreenIds.length < dto.screenIds.length &&
      suggestions.length < MAX_SUGGESTIONS
    ) {
      suggestions.push({
        type: SuggestionType.REDUCE_SCREENS,
        label: 'SUGGESTION_REDUCE_SCREENS',
        payload: { screenIds: okScreenIds },
      });
    }

    return suggestions.slice(0, MAX_SUGGESTIONS);
  }
}
