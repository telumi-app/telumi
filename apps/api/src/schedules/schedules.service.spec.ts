import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DatabaseService } from '@/modules/database';

import { SchedulesService } from './schedules.service';

describe('SchedulesService', () => {
  let service: SchedulesService;

  const dbMock = {
    schedule: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    scheduleTarget: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    playlist: {
      findFirst: vi.fn(),
    },
    campaign: {
      findFirst: vi.fn(),
    },
    device: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  } as unknown as DatabaseService;

  const workspaceId = 'ws-1';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SchedulesService(dbMock);
  });

  // ─── findAll ─────────────────────────────────────────────────────

  describe('findAll', () => {
    it('deve listar programações do workspace', async () => {
      const now = new Date();
      dbMock.schedule.findMany = vi.fn().mockResolvedValue([
        {
          id: 'sch-1',
          name: 'Horário Comercial',
          sourceType: 'PLAYLIST',
          playlistId: 'pl-1',
          campaignId: null,
          status: 'DRAFT',
          startDate: now,
          endDate: null,
          startTime: '08:00',
          endTime: '18:00',
          daysOfWeek: [1, 2, 3, 4, 5],
          priority: 0,
          createdAt: now,
          updatedAt: now,
          playlist: { id: 'pl-1', name: 'Playlist A' },
          campaign: null,
          targets: [
            { id: 'st-1', deviceId: 'dev-1', device: { id: 'dev-1', name: 'TV 1', locationId: 'loc-1' } },
          ],
        },
      ]);

      const result = await service.findAll(workspaceId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].sourceName).toBe('Playlist A');
      expect(result.data[0].targetCount).toBe(1);
    });
  });

  // ─── findOne ─────────────────────────────────────────────────────

  describe('findOne', () => {
    it('deve lançar NotFoundException se não existir', async () => {
      dbMock.schedule.findFirst = vi.fn().mockResolvedValue(null);

      await expect(service.findOne(workspaceId, 'sch-999')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ──────────────────────────────────────────────────────

  describe('create', () => {
    it('deve criar programação com PLAYLIST', async () => {
      const now = new Date();
      dbMock.playlist.findFirst = vi.fn().mockResolvedValue({ id: 'pl-1', workspaceId });
      dbMock.device.findMany = vi.fn().mockResolvedValue([{ id: 'dev-1' }]);
      dbMock.schedule.create = vi.fn().mockResolvedValue({
        id: 'sch-1',
        name: 'Horário Comercial',
        sourceType: 'PLAYLIST',
        playlistId: 'pl-1',
        campaignId: null,
        status: 'DRAFT',
        startDate: now,
        endDate: null,
        startTime: '08:00',
        endTime: '18:00',
        frequencyPerHour: 6,
        daysOfWeek: [1, 2, 3, 4, 5],
        priority: 0,
        createdAt: now,
        updatedAt: now,
        playlist: { id: 'pl-1', name: 'Playlist A' },
        campaign: null,
        targets: [{ id: 'st-1', deviceId: 'dev-1', device: { id: 'dev-1', name: 'TV 1', locationId: 'loc-1' } }],
      });

      const result = await service.create(workspaceId, {
        name: 'Horário Comercial',
        sourceType: 'PLAYLIST',
        playlistId: 'pl-1',
        startDate: now.toISOString(),
        startTime: '08:00',
        endTime: '18:00',
        frequencyPerHour: 6,
        daysOfWeek: [1, 2, 3, 4, 5],
        deviceIds: ['dev-1'],
      } as any);

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('DRAFT');
      expect(result.data.frequencyPerHour).toBe(6);
    });

    it('deve lançar NotFoundException se playlist não existir', async () => {
      dbMock.playlist.findFirst = vi.fn().mockResolvedValue(null);

      await expect(
        service.create(workspaceId, {
          name: 'Teste',
          sourceType: 'PLAYLIST',
          playlistId: 'pl-missing',
          startDate: new Date().toISOString(),
          startTime: '08:00',
          endTime: '18:00',
          daysOfWeek: [1],
          deviceIds: ['dev-1'],
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('deve lançar BadRequestException sem telas', async () => {
      dbMock.playlist.findFirst = vi.fn().mockResolvedValue({ id: 'pl-1', workspaceId });

      await expect(
        service.create(workspaceId, {
          name: 'Teste',
          sourceType: 'PLAYLIST',
          playlistId: 'pl-1',
          startDate: new Date().toISOString(),
          startTime: '08:00',
          endTime: '18:00',
          daysOfWeek: [1],
          deviceIds: [],
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve lançar BadRequestException se startTime >= endTime', async () => {
      dbMock.playlist.findFirst = vi.fn().mockResolvedValue({ id: 'pl-1', workspaceId });
      dbMock.device.findMany = vi.fn().mockResolvedValue([{ id: 'dev-1' }]);

      await expect(
        service.create(workspaceId, {
          name: 'Teste',
          sourceType: 'PLAYLIST',
          playlistId: 'pl-1',
          startDate: new Date().toISOString(),
          startTime: '18:00',
          endTime: '08:00',
          daysOfWeek: [1],
          deviceIds: ['dev-1'],
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve lançar BadRequest se campaignId não fornecido para CAMPAIGN', async () => {
      await expect(
        service.create(workspaceId, {
          name: 'Teste',
          sourceType: 'CAMPAIGN',
          startDate: new Date().toISOString(),
          startTime: '08:00',
          endTime: '18:00',
          daysOfWeek: [1],
          deviceIds: ['dev-1'],
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── remove ──────────────────────────────────────────────────────

  describe('remove', () => {
    it('deve excluir programação DRAFT', async () => {
      dbMock.schedule.findFirst = vi.fn().mockResolvedValue({ id: 'sch-1', status: 'DRAFT' });
      dbMock.schedule.delete = vi.fn().mockResolvedValue({});

      const result = await service.remove(workspaceId, 'sch-1');

      expect(result.success).toBe(true);
    });

    it('deve rejeitar exclusão de programação PUBLISHED', async () => {
      dbMock.schedule.findFirst = vi.fn().mockResolvedValue({ id: 'sch-1', status: 'PUBLISHED' });

      await expect(service.remove(workspaceId, 'sch-1')).rejects.toThrow(BadRequestException);
    });

    it('deve lançar NotFoundException se não existir', async () => {
      dbMock.schedule.findFirst = vi.fn().mockResolvedValue(null);

      await expect(service.remove(workspaceId, 'sch-999')).rejects.toThrow(NotFoundException);
    });
  });
});
