import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { DatabaseService } from '@/modules/database';

import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';

/** Transições de status válidas */
const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['PUBLISHED', 'FINISHED'],
  PUBLISHED: ['PAUSED', 'FINISHED'],
  PAUSED: ['PUBLISHED', 'FINISHED'],
  FINISHED: [],
};

@Injectable()
export class SchedulesService {
  constructor(private readonly db: DatabaseService) {}

  private parseDateOnlyStart(dateIso: string): Date {
    return new Date(`${dateIso}T00:00:00`);
  }

  private parseDateOnlyEnd(dateIso: string): Date {
    return new Date(`${dateIso}T23:59:59.999`);
  }

  private mapScheduleResponse(schedule: {
    id: string;
    name: string;
    sourceType: string;
    playlistId: string | null;
    campaignId: string | null;
    status: string;
    startDate: Date;
    endDate: Date | null;
    startTime: string;
    endTime: string;
    frequencyPerHour?: number;
    daysOfWeek: number[];
    priority: number;
    createdAt: Date;
    updatedAt: Date;
    playlist?: { id: string; name: string } | null;
    campaign?: { id: string; name: string; status: string } | null;
    targets?: { id: string; deviceId: string; device?: { id: string; name: string; locationId: string } }[];
  }) {
    return {
      id: schedule.id,
      name: schedule.name,
      sourceType: schedule.sourceType,
      playlistId: schedule.playlistId,
      campaignId: schedule.campaignId,
      status: schedule.status,
      startDate: schedule.startDate,
      endDate: schedule.endDate,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      frequencyPerHour: schedule.frequencyPerHour ?? 4,
      daysOfWeek: schedule.daysOfWeek,
      priority: schedule.priority,
      sourceName: schedule.playlist?.name ?? schedule.campaign?.name ?? null,
      targetCount: schedule.targets?.length ?? 0,
      targets: schedule.targets?.map((t) => ({
        id: t.id,
        deviceId: t.deviceId,
        deviceName: t.device?.name ?? null,
      })),
      createdAt: schedule.createdAt,
      updatedAt: schedule.updatedAt,
    };
  }

  private readonly includeRelations = {
    playlist: { select: { id: true, name: true } },
    campaign: { select: { id: true, name: true, status: true } },
    targets: {
      include: {
        device: { select: { id: true, name: true, locationId: true } },
      },
    },
  };

  async findAll(workspaceId: string) {
    const schedules = await this.db.schedule.findMany({
      where: { workspaceId },
      include: this.includeRelations,
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: schedules.map((s) => this.mapScheduleResponse(s)),
    };
  }

  async findOne(workspaceId: string, scheduleId: string) {
    const schedule = await this.db.schedule.findFirst({
      where: { id: scheduleId, workspaceId },
      include: this.includeRelations,
    });

    if (!schedule) {
      throw new NotFoundException('Programação não encontrada.');
    }

    return {
      success: true,
      data: this.mapScheduleResponse(schedule),
    };
  }

  async create(workspaceId: string, dto: CreateScheduleDto) {
    // Validar que sourceType corresponde ao ID fornecido
    if (dto.sourceType === 'PLAYLIST') {
      if (!dto.playlistId) {
        throw new BadRequestException('O ID da playlist é obrigatório para fonte do tipo PLAYLIST.');
      }
      const playlist = await this.db.playlist.findFirst({
        where: { id: dto.playlistId, workspaceId },
      });
      if (!playlist) {
        throw new NotFoundException('Playlist não encontrada.');
      }
    } else if (dto.sourceType === 'CAMPAIGN') {
      if (!dto.campaignId) {
        throw new BadRequestException('O ID da campanha é obrigatório para fonte do tipo CAMPAIGN.');
      }
      const campaign = await this.db.campaign.findFirst({
        where: { id: dto.campaignId, workspaceId },
      });
      if (!campaign) {
        throw new NotFoundException('Campanha não encontrada.');
      }
    }

    // Validar devices
    if (dto.deviceIds.length === 0) {
      throw new BadRequestException('É necessário selecionar pelo menos uma tela.');
    }

    const devices = await this.db.device.findMany({
      where: { id: { in: dto.deviceIds }, workspaceId },
      select: { id: true },
    });

    const existingIds = new Set(devices.map((d) => d.id));
    const missing = dto.deviceIds.filter((id) => !existingIds.has(id));

    if (missing.length > 0) {
      throw new NotFoundException(`Telas não encontradas: ${missing.join(', ')}`);
    }

    // Validar horários
    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('O horário de início deve ser anterior ao horário de fim.');
    }

    if (dto.daysOfWeek.length === 0) {
      throw new BadRequestException('É necessário selecionar pelo menos um dia da semana.');
    }

    const schedule = await this.db.schedule.create({
      data: {
        workspaceId,
        name: dto.name.trim(),
        sourceType: dto.sourceType,
        playlistId: dto.sourceType === 'PLAYLIST' ? dto.playlistId : null,
        campaignId: dto.sourceType === 'CAMPAIGN' ? dto.campaignId : null,
        status: 'DRAFT',
        startDate: this.parseDateOnlyStart(dto.startDate),
        endDate: dto.endDate ? this.parseDateOnlyEnd(dto.endDate) : null,
        startTime: dto.startTime,
        endTime: dto.endTime,
        frequencyPerHour: dto.frequencyPerHour ?? 4,
        daysOfWeek: dto.daysOfWeek,
        priority: dto.priority ?? 0,
        targets: {
          create: dto.deviceIds.map((deviceId) => ({ deviceId })),
        },
      },
      include: this.includeRelations,
    });

    return {
      success: true,
      data: this.mapScheduleResponse(schedule),
    };
  }

  async update(workspaceId: string, scheduleId: string, dto: UpdateScheduleDto) {
    const schedule = await this.db.schedule.findFirst({
      where: { id: scheduleId, workspaceId },
    });

    if (!schedule) {
      throw new NotFoundException('Programação não encontrada.');
    }

    // Validar transição de status
    if (dto.status && dto.status !== schedule.status) {
      const validTransitions = VALID_TRANSITIONS[schedule.status] ?? [];
      if (!validTransitions.includes(dto.status)) {
        throw new BadRequestException(
          `Não é possível mudar o status de "${schedule.status}" para "${dto.status}".`,
        );
      }
    }

    // Validar horários se ambos fornecidos
    const startTime = dto.startTime ?? schedule.startTime;
    const endTime = dto.endTime ?? schedule.endTime;
    if (startTime >= endTime) {
      throw new BadRequestException('O horário de início deve ser anterior ao horário de fim.');
    }

    // Validar devices se fornecidos
    if (dto.deviceIds) {
      if (dto.deviceIds.length === 0) {
        throw new BadRequestException('É necessário selecionar pelo menos uma tela.');
      }

      const devices = await this.db.device.findMany({
        where: { id: { in: dto.deviceIds }, workspaceId },
        select: { id: true },
      });

      const existingIds = new Set(devices.map((d) => d.id));
      const missing = dto.deviceIds.filter((id) => !existingIds.has(id));

      if (missing.length > 0) {
        throw new NotFoundException(`Telas não encontradas: ${missing.join(', ')}`);
      }
    }

    const updated = await this.db.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = {};

      if (dto.name !== undefined) updateData.name = dto.name.trim();
      if (dto.status !== undefined) updateData.status = dto.status;
      if (dto.startDate !== undefined) updateData.startDate = this.parseDateOnlyStart(dto.startDate);
      if (dto.endDate !== undefined) {
        updateData.endDate = dto.endDate ? this.parseDateOnlyEnd(dto.endDate) : null;
      }
      if (dto.startTime !== undefined) updateData.startTime = dto.startTime;
      if (dto.endTime !== undefined) updateData.endTime = dto.endTime;
      if (dto.frequencyPerHour !== undefined) updateData.frequencyPerHour = dto.frequencyPerHour;
      if (dto.daysOfWeek !== undefined) updateData.daysOfWeek = dto.daysOfWeek;
      if (dto.priority !== undefined) updateData.priority = dto.priority;

      // Replace targets
      if (dto.deviceIds !== undefined) {
        await tx.scheduleTarget.deleteMany({ where: { scheduleId } });
        if (dto.deviceIds.length > 0) {
          await tx.scheduleTarget.createMany({
            data: dto.deviceIds.map((deviceId) => ({
              scheduleId,
              deviceId,
            })),
          });
        }
      }

      return tx.schedule.update({
        where: { id: scheduleId },
        data: updateData,
        include: this.includeRelations,
      });
    });

    return {
      success: true,
      data: this.mapScheduleResponse(updated),
    };
  }

  /**
   * Publica uma programação (atalho para status PUBLISHED).
   */
  async publish(workspaceId: string, scheduleId: string) {
    return this.update(workspaceId, scheduleId, { status: 'PUBLISHED' });
  }

  async remove(workspaceId: string, scheduleId: string) {
    const schedule = await this.db.schedule.findFirst({
      where: { id: scheduleId, workspaceId },
    });

    if (!schedule) {
      throw new NotFoundException('Programação não encontrada.');
    }

    if (schedule.status === 'PUBLISHED') {
      throw new BadRequestException(
        'Não é possível remover uma programação publicada. Pause ou finalize primeiro.',
      );
    }

    await this.db.schedule.delete({ where: { id: scheduleId } });

    return { success: true, data: { id: scheduleId } };
  }
}
