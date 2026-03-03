import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  MessageEvent,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';

import { DatabaseService } from '@/modules/database';
import { STORAGE_PROVIDER, StorageProvider } from '@/media/storage/storage.interface';

import { DeviceErrorCode } from './constants';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { generatePairingCode, getPairingExpiration } from './utils/pairing-code';

const MAX_SCREENS_DEFAULT = 3;
const MAX_PAIRING_CODE_RETRIES = 5;
const HEARTBEAT_ONLINE_THRESHOLD_MS = 90 * 1000; // 90 seconds (PRD)
const HEARTBEAT_UNSTABLE_THRESHOLD_MS = 180 * 1000; // 180 seconds

type DeviceOrientation = 'HORIZONTAL' | 'VERTICAL';
type DeviceOperationalStatus = 'ACTIVE' | 'INACTIVE';

export type ComputedDeviceStatus = 'PENDING' | 'ONLINE' | 'UNSTABLE' | 'OFFLINE';

function computeDeviceStatus(
  pairedAt: Date | null,
  lastHeartbeat: Date | null,
): ComputedDeviceStatus {
  if (!pairedAt) return 'PENDING';
  if (!lastHeartbeat) return 'OFFLINE';

  const elapsed = Date.now() - lastHeartbeat.getTime();
  if (elapsed <= HEARTBEAT_ONLINE_THRESHOLD_MS) return 'ONLINE';
  if (elapsed <= HEARTBEAT_UNSTABLE_THRESHOLD_MS) return 'UNSTABLE';
  return 'OFFLINE';
}

function computeOperationalAlerts(status: ComputedDeviceStatus): string[] {
  if (status === 'OFFLINE') return ['TV_OFFLINE'];
  if (status === 'UNSTABLE') return ['TV_UNSTABLE'];
  return [];
}

type PlaybackItem = {
  assetId: string;
  campaignId?: string;
  mediaType: 'IMAGE' | 'VIDEO';
  durationMs: number;
  url: string;
};

@Injectable()
export class DevicesService {
  private readonly statusEvents$ = new Subject<{
    workspaceId: string;
    deviceId: string;
    status: ComputedDeviceStatus;
    heartbeatAt: string | null;
    timestamp: string;
    source: 'pair' | 'repair' | 'heartbeat';
  }>();

  constructor(
    private readonly db: DatabaseService,
    @Optional() @Inject(STORAGE_PROVIDER) private readonly storage?: StorageProvider,
  ) { }

  private isScheduleActiveNow(schedule: {
    startDate: Date;
    endDate: Date | null;
    startTime: string;
    endTime: string;
    daysOfWeek: number[];
  }) {
    const now = new Date();

    const startDate = new Date(schedule.startDate);
    startDate.setHours(0, 0, 0, 0);

    const endDate = schedule.endDate ? new Date(schedule.endDate) : null;
    if (endDate) {
      endDate.setHours(23, 59, 59, 999);
    }

    if (now < startDate) return false;
    if (endDate && now > endDate) return false;

    const today = now.getDay();
    if (!schedule.daysOfWeek.includes(today)) return false;

    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const current = `${hh}:${mm}`;

    return current >= schedule.startTime && current <= schedule.endTime;
  }

  private async buildSignedUrl(storageKey: string) {
    if (!this.storage) return null;
    try {
      return await this.storage.presignedGetUrl(storageKey, 3600);
    } catch {
      return null;
    }
  }

  streamWorkspaceEvents(workspaceId: string): Observable<MessageEvent> {
    return this.statusEvents$.pipe(
      filter((event) => event.workspaceId === workspaceId),
      map((event) => ({
        type: 'device-status',
        data: event,
      })),
    );
  }

  private emitStatusEvent(params: {
    workspaceId: string;
    deviceId: string;
    status: ComputedDeviceStatus;
    heartbeatAt: Date | null;
    source: 'pair' | 'repair' | 'heartbeat';
  }) {
    this.statusEvents$.next({
      workspaceId: params.workspaceId,
      deviceId: params.deviceId,
      status: params.status,
      heartbeatAt: params.heartbeatAt ? params.heartbeatAt.toISOString() : null,
      timestamp: new Date().toISOString(),
      source: params.source,
    });
  }

  private getPlayerBaseUrl() {
    return (process.env.PLAYER_RECOVERY_URL ?? process.env.PLAYER_URL ?? 'https://player.telumi.com.br')
      .replace(/\/$/, '');
  }

  private buildRecoveryLink(deviceToken: string) {
    return `${this.getPlayerBaseUrl()}/?pairToken=${encodeURIComponent(deviceToken)}`;
  }

  private mapDeviceResponse(
    device: {
      id: string;
      name: string;
      locationId: string;
      orientation: DeviceOrientation;
      resolution: string;
      operationalStatus: DeviceOperationalStatus;
      isPublic: boolean;
      pairingCode: string | null;
      pairingExpiresAt: Date | null;
      pairedAt?: Date | null;
      lastHeartbeat?: Date | null;
      isPartnerTv?: boolean;
      partnerName?: string | null;
      partnerRevenueSharePct?: number | null;
      createdAt: Date;
      location?: { id: string; name: string };
    },
    fallbackLocationName?: string,
  ) {
    const status = computeDeviceStatus(device.pairedAt ?? null, device.lastHeartbeat ?? null);
    const lastHeartbeatAgeSeconds = device.lastHeartbeat
      ? Math.max(0, Math.floor((Date.now() - device.lastHeartbeat.getTime()) / 1000))
      : null;

    return {
      id: device.id,
      name: device.name,
      locationId: device.locationId,
      locationName: device.location?.name ?? fallbackLocationName ?? '',
      orientation: device.orientation,
      resolution: device.resolution,
      operationalStatus: device.operationalStatus,
      isPublic: device.isPublic,
      isPartnerTv: device.isPartnerTv ?? false,
      partnerName: device.partnerName ?? null,
      partnerRevenueSharePct: device.partnerRevenueSharePct ?? null,
      pairingCode: device.pairingCode,
      pairingExpiresAt: device.pairingExpiresAt,
      pairedAt: device.pairedAt ?? null,
      lastHeartbeat: device.lastHeartbeat ?? null,
      status,
      operationalAlerts: computeOperationalAlerts(status),
      telemetry: {
        lastHeartbeatAgeSeconds,
      },
      createdAt: device.createdAt,
    };
  }

  async findAll(workspaceId: string) {
    const devices = await this.db.device.findMany({
      where: { workspaceId },
      include: {
        location: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: devices.map((device) => this.mapDeviceResponse(device)),
    };
  }

  async create(workspaceId: string, dto: CreateDeviceDto) {
    // Check location belongs to this workspace
    const location = await this.db.location.findFirst({
      where: { id: dto.locationId, workspaceId },
    });

    if (!location) {
      throw new ForbiddenException({ code: DeviceErrorCode.LOCATION_NOT_IN_WORKSPACE, message: 'O local selecionado não pertence ao seu ambiente.' });
    }

    // Check screen limit
    const deviceCount = await this.db.device.count({ where: { workspaceId } });
    if (deviceCount >= MAX_SCREENS_DEFAULT) {
      throw new ForbiddenException({ code: DeviceErrorCode.DEVICE_LIMIT_REACHED, message: 'Limite de telas atingido. Ajuste seu plano para adicionar mais telas.' });
    }

    // Check name uniqueness within workspace
    const nameExists = await this.db.device.findUnique({
      where: { workspaceId_name: { workspaceId, name: dto.name } },
    });

    if (nameExists) {
      throw new ConflictException({ code: DeviceErrorCode.DEVICE_NAME_DUPLICATE, message: 'Já existe uma tela com esse nome neste ambiente.' });
    }

    // Generate unique pairing code with collision retry
    const { code, expiresAt } = await this.generateUniquePairingCode();

    const device = await this.db.device.create({
      data: {
        workspaceId,
        locationId: dto.locationId,
        name: dto.name,
        orientation: dto.orientation ?? 'HORIZONTAL',
        resolution: dto.resolution?.trim() || 'AUTO',
        operationalStatus: dto.operationalStatus ?? 'ACTIVE',
        isPublic: dto.isPublic ?? false,
        isPartnerTv: dto.isPartnerTv ?? false,
        partnerName: dto.isPartnerTv ? (dto.partnerName?.trim() || null) : null,
        partnerRevenueSharePct: dto.isPartnerTv ? (dto.partnerRevenueSharePct ?? null) : null,
        pairingCode: code,
        pairingExpiresAt: expiresAt,
      },
      include: {
        location: { select: { id: true, name: true } },
      },
    });

    return {
      success: true,
      data: this.mapDeviceResponse(device),
    };
  }

  async update(workspaceId: string, deviceId: string, dto: UpdateDeviceDto) {
    const existing = await this.db.device.findFirst({
      where: { id: deviceId, workspaceId },
      include: {
        location: { select: { id: true, name: true } },
      },
    });

    if (!existing) {
      throw new NotFoundException('Tela não encontrada.');
    }

    if (dto.locationId && dto.locationId !== existing.locationId) {
      const location = await this.db.location.findFirst({
        where: { id: dto.locationId, workspaceId },
      });

      if (!location) {
        throw new ForbiddenException('O local selecionado não pertence ao seu ambiente.');
      }
    }

    const nextName = dto.name?.trim();
    if (nextName && nextName !== existing.name) {
      const nameExists = await this.db.device.findUnique({
        where: { workspaceId_name: { workspaceId, name: nextName } },
      });

      if (nameExists && nameExists.id !== deviceId) {
        throw new ConflictException('Já existe uma tela com esse nome neste ambiente.');
      }
    }

    const updated = await this.db.device.update({
      where: { id: deviceId },
      data: {
        ...(nextName ? { name: nextName } : {}),
        ...(dto.locationId ? { locationId: dto.locationId } : {}),
        ...(dto.orientation ? { orientation: dto.orientation } : {}),
        ...(dto.resolution ? { resolution: dto.resolution.trim() || 'AUTO' } : {}),
        ...(dto.operationalStatus ? { operationalStatus: dto.operationalStatus } : {}),
        ...(dto.isPublic !== undefined ? { isPublic: dto.isPublic } : {}),
        ...(dto.isPartnerTv !== undefined ? { isPartnerTv: dto.isPartnerTv } : {}),
        ...(dto.partnerName !== undefined ? { partnerName: dto.partnerName?.trim() || null } : {}),
        ...(dto.partnerRevenueSharePct !== undefined ? { partnerRevenueSharePct: dto.partnerRevenueSharePct } : {}),
      },
      include: {
        location: { select: { id: true, name: true } },
      },
    });

    return {
      success: true,
      data: this.mapDeviceResponse(updated),
    };
  }

  async remove(workspaceId: string, deviceId: string) {
    const device = await this.db.device.findFirst({
      where: { id: deviceId, workspaceId },
    });

    if (!device) {
      throw new NotFoundException('Tela não encontrada.');
    }

    await this.db.device.delete({ where: { id: deviceId } });

    return { success: true };
  }

  async regenerateCode(workspaceId: string, deviceId: string) {
    const device = await this.db.device.findFirst({
      where: { id: deviceId, workspaceId },
    });

    if (!device) {
      throw new NotFoundException('Tela não encontrada.');
    }

    const { code, expiresAt } = await this.generateUniquePairingCode();

    const updated = await this.db.device.update({
      where: { id: deviceId },
      data: {
        pairingCode: code,
        pairingExpiresAt: expiresAt,
      },
    });

    return {
      success: true,
      data: {
        id: updated.id,
        pairingCode: updated.pairingCode,
        pairingExpiresAt: updated.pairingExpiresAt,
      },
    };
  }

  private async generateUniquePairingCode(): Promise<{
    code: string;
    expiresAt: Date;
  }> {
    for (let attempt = 0; attempt < MAX_PAIRING_CODE_RETRIES; attempt++) {
      const code = generatePairingCode();
      const existing = await this.db.device.findUnique({
        where: { pairingCode: code },
      });

      if (!existing) {
        return { code, expiresAt: getPairingExpiration() };
      }
    }

    throw new ConflictException({
      code: DeviceErrorCode.PAIRING_CODE_COLLISION,
      message: 'Não foi possível gerar um código de pareamento único. Tente novamente.',
    });
  }

  async pairDevice(pairingCode: string) {
    const code = pairingCode.toUpperCase().trim();

    const device = await this.db.device.findUnique({
      where: { pairingCode: code },
    });

    if (!device) {
      throw new NotFoundException({ code: DeviceErrorCode.PAIRING_CODE_NOT_FOUND, message: 'Código de pareamento inválido.' });
    }

    if (!device.pairingExpiresAt || device.pairingExpiresAt < new Date()) {
      throw new BadRequestException({ code: DeviceErrorCode.PAIRING_CODE_EXPIRED, message: 'Este código já expirou. Gere um novo no painel.' });
    }

    const deviceToken = randomBytes(32).toString('hex');
    const deviceSecret = randomBytes(32).toString('hex');

    const updated = await this.db.device.update({
      where: { id: device.id },
      data: {
        pairingCode: null,
        pairingExpiresAt: null,
        pairedAt: new Date(),
        deviceToken,
        deviceSecret,
      },
      include: {
        workspace: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
      },
    });

    this.emitStatusEvent({
      workspaceId: updated.workspace.id,
      deviceId: updated.id,
      status: computeDeviceStatus(updated.pairedAt, updated.lastHeartbeat),
      heartbeatAt: updated.lastHeartbeat,
      source: 'pair',
    });

    return {
      success: true,
      data: {
        deviceToken: updated.deviceToken,
        deviceSecret: updated.deviceSecret,
        device: {
          id: updated.id,
          name: updated.name,
          workspaceName: updated.workspace.name,
          locationName: updated.location.name,
          orientation: updated.orientation,
          resolution: updated.resolution,
        },
      },
      message: 'Dispositivo pareado com sucesso.',
    };
  }

  async pairDeviceByToken(pairToken: string) {
    const token = pairToken.trim();

    if (!token) {
      throw new BadRequestException({ code: DeviceErrorCode.DEVICE_TOKEN_INVALID, message: 'Token de recuperação inválido.' });
    }

    const device = await this.db.device.findUnique({
      where: { deviceToken: token },
    });

    if (!device) {
      throw new NotFoundException({ code: DeviceErrorCode.DEVICE_TOKEN_INVALID, message: 'Link de recuperação inválido ou expirado.' });
    }

    const updated = await this.db.device.update({
      where: { id: device.id },
      data: {
        pairedAt: new Date(),
      },
      include: {
        workspace: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
      },
    });

    this.emitStatusEvent({
      workspaceId: updated.workspace.id,
      deviceId: updated.id,
      status: computeDeviceStatus(updated.pairedAt, updated.lastHeartbeat),
      heartbeatAt: updated.lastHeartbeat,
      source: 'repair',
    });

    return {
      success: true,
      data: {
        deviceToken: updated.deviceToken,
        device: {
          id: updated.id,
          name: updated.name,
          workspaceName: updated.workspace.name,
          locationName: updated.location.name,
          orientation: updated.orientation,
          resolution: updated.resolution,
        },
      },
      message: 'Dispositivo reconectado com sucesso.',
    };
  }

  async heartbeatByToken(
    deviceToken: string,
    occurredAt?: string,
    playerStatus?: string,
    manifestVersion?: string,
  ) {
    const token = deviceToken.trim();

    if (!token) {
      throw new BadRequestException({ code: DeviceErrorCode.DEVICE_TOKEN_INVALID, message: 'Token do dispositivo é obrigatório.' });
    }

    const device = await this.db.device.findUnique({
      where: { deviceToken: token },
      include: {
        workspace: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
      },
    });

    if (!device) {
      throw new NotFoundException({ code: DeviceErrorCode.DEVICE_TOKEN_INVALID, message: 'Dispositivo não encontrado para este token.' });
    }

    const heartbeatAt = occurredAt ? new Date(occurredAt) : new Date();
    if (Number.isNaN(heartbeatAt.getTime())) {
      throw new BadRequestException({ code: DeviceErrorCode.HEARTBEAT_INVALID_DATE, message: 'occurredAt inválido.' });
    }

    const updated = await this.db.device.update({
      where: { id: device.id },
      data: {
        lastHeartbeat: heartbeatAt,
        ...(device.pairedAt ? {} : { pairedAt: heartbeatAt }),
      },
      include: {
        workspace: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
      },
    });

    const computedStatus = computeDeviceStatus(updated.pairedAt, updated.lastHeartbeat);

    this.emitStatusEvent({
      workspaceId: updated.workspace.id,
      deviceId: updated.id,
      status: computedStatus,
      heartbeatAt: updated.lastHeartbeat,
      source: 'heartbeat',
    });

    return {
      success: true,
      data: {
        device: {
          id: updated.id,
          name: updated.name,
          workspaceName: updated.workspace.name,
          locationName: updated.location.name,
          orientation: updated.orientation,
          resolution: updated.resolution,
        },
        status: computedStatus,
        heartbeatAt,
        playerStatus: playerStatus ?? null,
        manifestVersion: manifestVersion ?? null,
        ingestionLagMs: Math.max(0, Date.now() - heartbeatAt.getTime()),
      },
      message: 'Heartbeat recebido com sucesso.',
    };
  }

  async getPlaybackManifestByToken(deviceToken: string) {
    const token = deviceToken.trim();

    if (!token) {
      throw new BadRequestException({
        code: DeviceErrorCode.DEVICE_TOKEN_INVALID,
        message: 'Token do dispositivo é obrigatório.',
      });
    }

    const device = await this.db.device.findUnique({
      where: { deviceToken: token },
      select: {
        id: true,
        workspaceId: true,
        operationalStatus: true,
      },
    });

    if (!device) {
      throw new NotFoundException({
        code: DeviceErrorCode.DEVICE_TOKEN_INVALID,
        message: 'Dispositivo não encontrado para este token.',
      });
    }

    if (device.operationalStatus !== 'ACTIVE') {
      return {
        success: true,
        data: {
          manifestVersion: null,
          scheduleId: null,
          items: [],
        },
      };
    }

    const occurrenceManifest = await this.buildOccurrenceManifest(device.workspaceId, device.id);
    if (occurrenceManifest) {
      return {
        success: true,
        data: occurrenceManifest,
      };
    }

    const schedules = await this.db.schedule.findMany({
      where: {
        workspaceId: device.workspaceId,
        status: 'PUBLISHED',
        targets: {
          some: {
            deviceId: device.id,
          },
        },
      },
      include: {
        campaign: {
          include: {
            assets: {
              orderBy: { position: 'asc' },
              include: {
                media: true,
              },
            },
          },
        },
        playlist: {
          include: {
            items: {
              orderBy: { position: 'asc' },
              include: {
                media: true,
              },
            },
          },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { updatedAt: 'desc' },
      ],
    });

    const activeSchedules = schedules.filter((schedule) => this.isScheduleActiveNow(schedule));

    if (activeSchedules.length === 0) {
      return {
        success: true,
        data: {
          manifestVersion: null,
          scheduleId: null,
          items: [],
        },
      };
    }

    const legacyEntries: Array<{
      key: string;
      scheduleId: string;
      frequencyPerHour: number;
      updatedAt: Date;
      items: PlaybackItem[];
    }> = [];

    for (const schedule of activeSchedules) {
      const itemsRaw = schedule.sourceType === 'CAMPAIGN'
        ? (schedule.campaign?.status === 'ACTIVE' ? (schedule.campaign.assets ?? []).map((asset) => ({
          assetId: asset.id,
          campaignId: schedule.campaignId ?? undefined,
          mediaType: asset.media.mediaType,
          durationMs: asset.durationMs,
          uploadStatus: asset.media.uploadStatus,
          storageKey: asset.media.storageKey,
        })) : [])
        : (schedule.playlist?.items ?? []).map((item) => ({
          assetId: item.id,
          campaignId: undefined,
          mediaType: item.media.mediaType,
          durationMs: item.durationMs,
          uploadStatus: item.media.uploadStatus,
          storageKey: item.media.storageKey,
        }));

      const readyItems = itemsRaw.filter((item) => item.uploadStatus === 'READY');

      const signedItems = (
        await Promise.all(
          readyItems.map(async (item) => {
            const url = await this.buildSignedUrl(item.storageKey);
            if (!url) return null;
            return {
              assetId: item.assetId,
              campaignId: item.campaignId,
              mediaType: item.mediaType,
              durationMs: item.durationMs,
              url,
            } satisfies PlaybackItem;
          }),
        )
      ).filter((item): item is NonNullable<typeof item> => item !== null);

      if (signedItems.length === 0) continue;

      legacyEntries.push({
        key: schedule.id,
        scheduleId: schedule.id,
        frequencyPerHour: Math.max(1, schedule.frequencyPerHour),
        updatedAt: schedule.updatedAt,
        items: signedItems,
      });
    }

    if (legacyEntries.length === 0) {
      return {
        success: true,
        data: {
          manifestVersion: null,
          scheduleId: null,
          items: [],
        },
      };
    }

    const cycle = this.buildWeightedCampaignCycle(
      legacyEntries.map((entry) => ({
        campaignId: entry.key,
        playsPerHour: entry.frequencyPerHour,
      })),
    );

    const byKey = new Map(legacyEntries.map((entry) => [entry.key, entry]));
    const items: PlaybackItem[] = [];

    for (const key of cycle) {
      const entry = byKey.get(key);
      if (!entry || entry.items.length === 0) continue;
      items.push(...entry.items);
    }

    if (items.length === 0) {
      return {
        success: true,
        data: {
          manifestVersion: null,
          scheduleId: null,
          items: [],
        },
      };
    }

    const primary = legacyEntries[0]!;
    const manifestVersion = `sched:${legacyEntries
      .map((entry) => `${entry.scheduleId}:${entry.updatedAt.getTime()}:${entry.frequencyPerHour}`)
      .join('|')}`;

    return {
      success: true,
      data: {
        manifestVersion,
        scheduleId: primary.scheduleId,
        items,
      },
    };
  }

  private buildWeightedCampaignCycle(campaigns: Array<{ campaignId: string; playsPerHour: number }>) {
    if (campaigns.length === 0) return [] as string[];

    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const gcdAll = campaigns
      .map((c) => Math.max(1, c.playsPerHour))
      .reduce((acc, val) => gcd(acc, val));

    const normalized = campaigns.map((c) => ({
      campaignId: c.campaignId,
      weight: Math.max(1, Math.floor(c.playsPerHour / gcdAll)),
    }));

    // Limitar ciclo para manifesto leve e polling frequente
    const maxCycleSize = 60;
    let totalWeight = normalized.reduce((sum, c) => sum + c.weight, 0);

    if (totalWeight > maxCycleSize) {
      const factor = maxCycleSize / totalWeight;
      for (const item of normalized) {
        item.weight = Math.max(1, Math.round(item.weight * factor));
      }
      totalWeight = normalized.reduce((sum, c) => sum + c.weight, 0);
      if (totalWeight > maxCycleSize) {
        const trimFactor = maxCycleSize / totalWeight;
        for (const item of normalized) {
          item.weight = Math.max(1, Math.floor(item.weight * trimFactor));
        }
      }
    }

    const cycle: string[] = [];
    for (const item of normalized) {
      for (let i = 0; i < item.weight; i++) {
        cycle.push(item.campaignId);
      }
    }

    return cycle;
  }

  private async buildOccurrenceManifest(workspaceId: string, deviceId: string): Promise<{
    manifestVersion: string | null;
    scheduleId: string | null;
    items: PlaybackItem[];
  } | null> {
    const now = new Date();

    const activeOccurrences = await this.db.scheduleOccurrence.findMany({
      where: {
        workspaceId,
        screenId: deviceId,
        status: 'ACTIVE',
        startAtUtc: { lte: now },
        endAtUtc: { gt: now },
      },
      select: {
        id: true,
        campaignId: true,
        playsPerHour: true,
        campaign: {
          select: {
            id: true,
            status: true,
            assets: {
              orderBy: { position: 'asc' },
              include: {
                media: true,
              },
            },
          },
        },
      },
    });

    if (activeOccurrences.length === 0) {
      return null;
    }

    const campaignMap = new Map<string, {
      campaignId: string;
      playsPerHour: number;
      timeline: PlaybackItem[];
    }>();

    for (const occ of activeOccurrences) {
      const campaign = occ.campaign;
      if (!campaign || campaign.status !== 'ACTIVE') continue;
      if (campaignMap.has(campaign.id)) continue;

      const timelineRaw = campaign.assets.map((asset) => ({
        assetId: asset.id,
        campaignId: campaign.id,
        mediaType: asset.media.mediaType,
        durationMs: asset.durationMs,
        uploadStatus: asset.media.uploadStatus,
        storageKey: asset.media.storageKey,
      }));

      const readyItems = timelineRaw.filter((item) => item.uploadStatus === 'READY');

      const signedTimeline = (
        await Promise.all(
          readyItems.map(async (item) => {
            const url = await this.buildSignedUrl(item.storageKey);
            if (!url) return null;
            return {
              assetId: item.assetId,
              campaignId: item.campaignId,
              mediaType: item.mediaType,
              durationMs: item.durationMs,
              url,
            } satisfies PlaybackItem;
          }),
        )
      ).filter((item): item is NonNullable<typeof item> => item !== null);

      if (signedTimeline.length === 0) continue;

      campaignMap.set(campaign.id, {
        campaignId: campaign.id,
        playsPerHour: occ.playsPerHour,
        timeline: signedTimeline,
      });
    }

    if (campaignMap.size === 0) {
      return null;
    }

    const campaigns = [...campaignMap.values()];
    const cycle = this.buildWeightedCampaignCycle(
      campaigns.map((c) => ({ campaignId: c.campaignId, playsPerHour: c.playsPerHour })),
    );

    if (cycle.length === 0) {
      return null;
    }

    const items: PlaybackItem[] = [];

    for (const campaignId of cycle) {
      const campaign = campaignMap.get(campaignId);
      if (!campaign || campaign.timeline.length === 0) continue;
      items.push(...campaign.timeline);
    }

    if (items.length === 0) {
      return null;
    }

    const manifestVersion = `occ:${activeOccurrences.map((o) => o.id).sort().join('|')}`;

    return {
      manifestVersion,
      scheduleId: null,
      items,
    };
  }

  async getRecoveryLink(workspaceId: string, deviceId: string) {
    const device = await this.db.device.findFirst({
      where: { id: deviceId, workspaceId },
      select: {
        id: true,
        pairedAt: true,
        deviceToken: true,
      },
    });

    if (!device) {
      throw new NotFoundException('Tela não encontrada.');
    }

    if (!device.pairedAt || !device.deviceToken) {
      throw new BadRequestException('A tela ainda não foi pareada para gerar link de recuperação.');
    }

    return {
      success: true,
      data: {
        deviceId: device.id,
        recoveryLink: this.buildRecoveryLink(device.deviceToken),
      },
    };
  }

  async rotateRecoveryLink(workspaceId: string, deviceId: string) {
    const device = await this.db.device.findFirst({
      where: { id: deviceId, workspaceId },
      select: {
        id: true,
        pairedAt: true,
      },
    });

    if (!device) {
      throw new NotFoundException('Tela não encontrada.');
    }

    if (!device.pairedAt) {
      throw new BadRequestException('A tela ainda não foi pareada para reparear.');
    }

    const nextToken = randomBytes(32).toString('hex');

    const updated = await this.db.device.update({
      where: { id: device.id },
      data: {
        deviceToken: nextToken,
      },
      select: {
        id: true,
        deviceToken: true,
      },
    });

    return {
      success: true,
      data: {
        deviceId: updated.id,
        recoveryLink: this.buildRecoveryLink(updated.deviceToken!),
      },
      message: 'Link de recuperação rotacionado com sucesso.',
    };
  }

  // ─── Telemetria operacional ─────────────────────────────────────────

  /**
   * Deduplicação: (deviceId + eventType) dentro de 30 minutos é ignorado
   * para evitar flood de eventos repetitivos (ex: CRASH_LOOP).
   */
  private readonly TELEMETRY_DEDUPE_WINDOW_MS = 30 * 60 * 1000; // 30 min

  async ingestTelemetryEvent(params: {
    deviceToken: string;
    eventType: string;
    severity?: string;
    message?: string;
    metadata?: Record<string, unknown>;
    occurredAt: string;
  }) {
    const token = params.deviceToken.trim();

    if (!token) {
      throw new BadRequestException({
        code: DeviceErrorCode.DEVICE_TOKEN_INVALID,
        message: 'Token do dispositivo é obrigatório.',
      });
    }

    const device = await this.db.device.findUnique({
      where: { deviceToken: token },
      select: { id: true },
    });

    if (!device) {
      throw new NotFoundException({
        code: DeviceErrorCode.DEVICE_TOKEN_INVALID,
        message: 'Dispositivo não encontrado para este token.',
      });
    }

    const occurredAt = new Date(params.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) {
      throw new BadRequestException({
        code: DeviceErrorCode.HEARTBEAT_INVALID_DATE,
        message: 'occurredAt inválido.',
      });
    }

    // Deduplica por (deviceId, eventType) dentro da janela
    const dedupeKey = `${device.id}:${params.eventType}`;
    const dedupeWindowStart = new Date(occurredAt.getTime() - this.TELEMETRY_DEDUPE_WINDOW_MS);

    const duplicate = await this.db.deviceEvent.findFirst({
      where: {
        deviceId: device.id,
        eventType: params.eventType as never,
        occurredAt: { gte: dedupeWindowStart },
        dedupeKey,
      },
      select: { id: true },
    });

    if (duplicate) {
      return {
        success: true,
        data: { deduplicated: true, existingEventId: duplicate.id },
        message: 'Evento duplicado ignorado (janela de 30 min).',
      };
    }

    const event = await this.db.deviceEvent.create({
      data: {
        deviceId: device.id,
        eventType: params.eventType as never,
        severity: (params.severity as never) ?? 'INFO',
        message: params.message ?? null,
        metadata: params.metadata ? (params.metadata as Record<string, string>) : undefined,
        occurredAt,
        dedupeKey,
      },
    });

    return {
      success: true,
      data: { eventId: event.id, deduplicated: false },
      message: 'Evento de telemetria registrado.',
    };
  }

  // ─── Proof-of-Play ─────────────────────────────────────────────────

  async ingestPlayEvent(params: {
    deviceToken: string;
    playId: string;
    campaignId?: string;
    assetId?: string;
    startedAt: string;
    endedAt: string;
    durationMs: number;
    manifestVersion?: string;
    assetHash?: string;
    hmacSignature?: string;
  }) {
    const token = params.deviceToken.trim();

    if (!token) {
      throw new BadRequestException({
        code: DeviceErrorCode.DEVICE_TOKEN_INVALID,
        message: 'Token do dispositivo é obrigatório.',
      });
    }

    const device = await this.db.device.findUnique({
      where: { deviceToken: token },
      select: { id: true, deviceSecret: true },
    });

    if (!device) {
      throw new NotFoundException({
        code: DeviceErrorCode.DEVICE_TOKEN_INVALID,
        message: 'Dispositivo não encontrado para este token.',
      });
    }

    const startedAt = new Date(params.startedAt);
    const endedAt = new Date(params.endedAt);

    if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) {
      throw new BadRequestException({
        code: DeviceErrorCode.HEARTBEAT_INVALID_DATE,
        message: 'startedAt ou endedAt inválido.',
      });
    }

    // Validação HMAC (quando deviceSecret estiver configurado)
    let deliveryStatus: 'ONLINE_VERIFIED' | 'OFFLINE_SYNCED' | 'NOT_ELIGIBLE' = 'ONLINE_VERIFIED';

    if (device.deviceSecret && params.hmacSignature) {
      const { createHmac } = await import('crypto');
      const payload = `${params.playId}:${params.startedAt}:${params.endedAt}:${params.durationMs}`;
      const expected = createHmac('sha256', device.deviceSecret).update(payload).digest('hex');

      if (expected !== params.hmacSignature) {
        deliveryStatus = 'NOT_ELIGIBLE';
      }
    } else if (!params.hmacSignature) {
      // Sem assinatura: se já é posterior ao play (sync tardia), marcar como OFFLINE_SYNCED
      const lagMs = Date.now() - endedAt.getTime();
      if (lagMs > 60_000) {
        deliveryStatus = 'OFFLINE_SYNCED';
      }
    }

    // Idempotência: playId único
    const existing = await this.db.playEvent.findUnique({
      where: { playId: params.playId },
      select: { id: true },
    });

    if (existing) {
      return {
        success: true,
        data: { playEventId: existing.id, deduplicated: true },
        message: 'PlayEvent já registrado (idempotente).',
      };
    }

    const playEvent = await this.db.playEvent.create({
      data: {
        deviceId: device.id,
        playId: params.playId,
        campaignId: params.campaignId ?? null,
        assetId: params.assetId ?? null,
        startedAt,
        endedAt,
        durationMs: params.durationMs,
        manifestVersion: params.manifestVersion ?? null,
        assetHash: params.assetHash ?? null,
        hmacSignature: params.hmacSignature ?? null,
        deliveryStatus,
        syncedAt: new Date(),
      },
    });

    return {
      success: true,
      data: {
        playEventId: playEvent.id,
        deliveryStatus: playEvent.deliveryStatus,
        deduplicated: false,
      },
      message: 'PlayEvent registrado com sucesso.',
    };
  }
}
