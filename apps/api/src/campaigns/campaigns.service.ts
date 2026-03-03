import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { DatabaseService } from '@/modules/database';

import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

const DEFAULT_ASSET_DURATION_MS = 15000;

/** Transições de status permitidas */
const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['PAUSED', 'FINISHED', 'CANCELLED'],
  PAUSED: ['ACTIVE', 'CANCELLED'],
  FINISHED: [],
  CANCELLED: [],
};

@Injectable()
export class CampaignsService {
  constructor(private readonly db: DatabaseService) {}

  private parseDateOnlyStart(dateIso: string): Date {
    return new Date(`${dateIso}T00:00:00`);
  }

  private parseDateOnlyEnd(dateIso: string): Date {
    return new Date(`${dateIso}T23:59:59.999`);
  }

  private mapCampaignResponse(campaign: {
    id: string;
    name: string;
    objective?: string | null;
    description: string | null;
    status: string;
    startDate: Date | null;
    endDate: Date | null;
    createdAt: Date;
    updatedAt: Date;
    assets?: {
      id: string;
      mediaId: string;
      position: number;
      durationMs: number;
      media?: {
        id: string;
        name: string;
        originalName: string;
        mimeType: string;
        mediaType: string;
        fileSize: number;
        durationMs: number | null;
        width: number | null;
        height: number | null;
      };
    }[];
    schedules?: {
      id: string;
      status: string;
      targets?: { id: string }[];
    }[];
  }) {
    const schedules = campaign.schedules ?? [];
    const publishedSchedules = schedules.filter((schedule) => schedule.status === 'PUBLISHED');
    const activeTargetCount = publishedSchedules.reduce(
      (sum, schedule) => sum + (schedule.targets?.length ?? 0),
      0,
    );

    return {
      id: campaign.id,
      name: campaign.name,
      objective: campaign.objective ?? null,
      description: campaign.description,
      status: campaign.status,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      assetCount: campaign.assets?.length ?? 0,
      scheduleCount: schedules.length,
      activeTargetCount,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
      assets: campaign.assets?.map((asset) => ({
        id: asset.id,
        mediaId: asset.mediaId,
        position: asset.position,
        durationMs: asset.durationMs,
        media: asset.media
          ? {
              id: asset.media.id,
              name: asset.media.name,
              originalName: asset.media.originalName,
              mimeType: asset.media.mimeType,
              mediaType: asset.media.mediaType,
              fileSize: asset.media.fileSize,
              durationMs: asset.media.durationMs,
              width: asset.media.width,
              height: asset.media.height,
            }
          : undefined,
      })),
    };
  }

  private readonly includeAssets = {
    assets: {
      orderBy: { position: 'asc' as const },
      include: {
        media: {
          select: {
            id: true,
            name: true,
            originalName: true,
            mimeType: true,
            mediaType: true,
            fileSize: true,
            durationMs: true,
            width: true,
            height: true,
          },
        },
      },
    },
    schedules: {
      select: {
        id: true,
        status: true,
        targets: {
          select: {
            id: true,
          },
        },
      },
    },
  };

  async findAll(workspaceId: string) {
    const campaigns = await this.db.campaign.findMany({
      where: { workspaceId },
      include: this.includeAssets,
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: campaigns.map((c) => this.mapCampaignResponse(c)),
    };
  }

  async findOne(workspaceId: string, campaignId: string) {
    const campaign = await this.db.campaign.findFirst({
      where: { id: campaignId, workspaceId },
      include: this.includeAssets,
    });

    if (!campaign) {
      throw new NotFoundException('Campanha não encontrada.');
    }

    return {
      success: true,
      data: this.mapCampaignResponse(campaign),
    };
  }

  async create(workspaceId: string, dto: CreateCampaignDto) {
    const assets = dto.assets ?? [];

    // Validar mídias
    if (assets.length > 0) {
      const mediaIds = [...new Set(assets.map((a) => a.mediaId))];
      const existingMedia = await this.db.media.findMany({
        where: { id: { in: mediaIds }, workspaceId, uploadStatus: 'READY' },
        select: { id: true },
      });

      const existingIds = new Set(existingMedia.map((m) => m.id));
      const missing = mediaIds.filter((id) => !existingIds.has(id));

      if (missing.length > 0) {
        throw new NotFoundException(
          `Mídias não encontradas ou não estão prontas: ${missing.join(', ')}`,
        );
      }
    }

    const campaign = await this.db.campaign.create({
      data: {
        workspaceId,
        name: dto.name.trim(),
        objective: dto.objective?.trim() ?? null,
        description: dto.description?.trim() ?? null,
        status: 'DRAFT',
        startDate: dto.startDate ? this.parseDateOnlyStart(dto.startDate) : null,
        endDate: dto.endDate ? this.parseDateOnlyEnd(dto.endDate) : null,
        assets:
          assets.length > 0
            ? {
                create: assets.map((asset) => ({
                  mediaId: asset.mediaId,
                  position: asset.position,
                  durationMs: asset.durationMs ?? DEFAULT_ASSET_DURATION_MS,
                })),
              }
            : undefined,
      },
      include: this.includeAssets,
    });

    return {
      success: true,
      data: this.mapCampaignResponse(campaign),
    };
  }

  async update(workspaceId: string, campaignId: string, dto: UpdateCampaignDto) {
    const campaign = await this.db.campaign.findFirst({
      where: { id: campaignId, workspaceId },
    });

    if (!campaign) {
      throw new NotFoundException('Campanha não encontrada.');
    }

    // Validar transição de status
    if (dto.status && dto.status !== campaign.status) {
      const validTransitions = VALID_TRANSITIONS[campaign.status] ?? [];
      if (!validTransitions.includes(dto.status)) {
        throw new BadRequestException(
          `Não é possível mudar o status de "${campaign.status}" para "${dto.status}".`,
        );
      }
    }

    // Validar mídias
    if (dto.assets && dto.assets.length > 0) {
      const mediaIds = [...new Set(dto.assets.map((a) => a.mediaId))];
      const existingMedia = await this.db.media.findMany({
        where: { id: { in: mediaIds }, workspaceId, uploadStatus: 'READY' },
        select: { id: true },
      });

      const existingIds = new Set(existingMedia.map((m) => m.id));
      const missing = mediaIds.filter((id) => !existingIds.has(id));

      if (missing.length > 0) {
        throw new NotFoundException(
          `Mídias não encontradas ou não estão prontas: ${missing.join(', ')}`,
        );
      }
    }

    const updated = await this.db.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = {};

      if (dto.name !== undefined) updateData.name = dto.name.trim();
      if (dto.objective !== undefined) updateData.objective = dto.objective?.trim() ?? null;
      if (dto.description !== undefined) updateData.description = dto.description?.trim() ?? null;
      if (dto.status !== undefined) updateData.status = dto.status;
      if (dto.startDate !== undefined) {
        updateData.startDate = dto.startDate ? this.parseDateOnlyStart(dto.startDate) : null;
      }
      if (dto.endDate !== undefined) {
        updateData.endDate = dto.endDate ? this.parseDateOnlyEnd(dto.endDate) : null;
      }

      if (dto.assets !== undefined) {
        await tx.campaignAsset.deleteMany({ where: { campaignId } });

        if (dto.assets.length > 0) {
          await tx.campaignAsset.createMany({
            data: dto.assets.map((asset) => ({
              campaignId,
              mediaId: asset.mediaId,
              position: asset.position,
              durationMs: asset.durationMs ?? DEFAULT_ASSET_DURATION_MS,
            })),
          });
        }
      }

      return tx.campaign.update({
        where: { id: campaignId },
        data: updateData,
        include: this.includeAssets,
      });
    });

    return {
      success: true,
      data: this.mapCampaignResponse(updated),
    };
  }

  async remove(workspaceId: string, campaignId: string) {
    const campaign = await this.db.campaign.findFirst({
      where: { id: campaignId, workspaceId },
      select: {
        id: true,
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campanha não encontrada.');
    }

    await this.db.$transaction(async (tx) => {
      // Encerra programações vinculadas para evitar referências órfãs no fluxo legado.
      await tx.schedule.updateMany({
        where: { workspaceId, campaignId },
        data: {
          status: 'FINISHED',
          campaignId: null,
        },
      });

      // Deleção em cascata remove assets, rules, occurrences e holds associados.
      await tx.campaign.delete({ where: { id: campaignId } });
    });

    return { success: true, data: { id: campaignId } };
  }
}
