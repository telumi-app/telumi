import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DatabaseService } from '@/modules/database';

import { CampaignsService } from './campaigns.service';

describe('CampaignsService', () => {
  let service: CampaignsService;

  const dbMock = {
    campaign: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    schedule: {
      updateMany: vi.fn(),
    },
    campaignAsset: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    media: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  } as unknown as DatabaseService;

  const workspaceId = 'ws-1';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CampaignsService(dbMock);
  });

  // ─── findAll ─────────────────────────────────────────────────────

  describe('findAll', () => {
    it('deve listar campanhas do workspace', async () => {
      const now = new Date();
      dbMock.campaign.findMany = vi.fn().mockResolvedValue([
        {
          id: 'cm-1',
          name: 'Campanha 1',
          description: null,
          status: 'DRAFT',
          startDate: now,
          endDate: null,
          createdAt: now,
          updatedAt: now,
          assets: [],
        },
      ]);

      const result = await service.findAll(workspaceId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Campanha 1');
      expect(result.data[0].assetCount).toBe(0);
    });
  });

  // ─── findOne ─────────────────────────────────────────────────────

  describe('findOne', () => {
    it('deve retornar campanha existente', async () => {
      const now = new Date();
      dbMock.campaign.findFirst = vi.fn().mockResolvedValue({
        id: 'cm-1',
        name: 'Campanha 1',
        description: null,
        status: 'DRAFT',
        startDate: null,
        endDate: null,
        createdAt: now,
        updatedAt: now,
        assets: [],
      });

      const result = await service.findOne(workspaceId, 'cm-1');

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('cm-1');
    });

    it('deve lançar NotFoundException se campanha não existir', async () => {
      dbMock.campaign.findFirst = vi.fn().mockResolvedValue(null);

      await expect(service.findOne(workspaceId, 'cm-999')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ──────────────────────────────────────────────────────

  describe('create', () => {
    it('deve criar campanha sem assets', async () => {
      const now = new Date();
      dbMock.campaign.create = vi.fn().mockResolvedValue({
        id: 'cm-1',
        name: 'Nova Campanha',
        description: null,
        status: 'DRAFT',
        startDate: null,
        endDate: null,
        createdAt: now,
        updatedAt: now,
        assets: [],
      });

      const result = await service.create(workspaceId, {
        name: 'Nova Campanha',
      } as any);

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Nova Campanha');
      expect(result.data.status).toBe('DRAFT');
    });

    it('deve lançar NotFoundException se mídia não existir', async () => {
      dbMock.media.findMany = vi.fn().mockResolvedValue([]);

      await expect(
        service.create(workspaceId, {
          name: 'Campanha com mídia',
          assets: [{ mediaId: 'media-missing', position: 0 }],
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('deve mapear objetivo quando informado', async () => {
      const now = new Date();
      dbMock.campaign.create = vi.fn().mockResolvedValue({
        id: 'cm-1',
        name: 'Nova Campanha',
        objective: 'Gerar awareness',
        description: null,
        status: 'DRAFT',
        startDate: null,
        endDate: null,
        createdAt: now,
        updatedAt: now,
        assets: [],
      });

      const result = await service.create(workspaceId, {
        name: 'Nova Campanha',
        objective: 'Gerar awareness',
      } as any);

      expect(result.success).toBe(true);
      expect(result.data.objective).toBe('Gerar awareness');
    });
  });

  // ─── update (status transitions) ────────────────────────────────

  describe('update', () => {
    it('deve permitir transição DRAFT → ACTIVE', async () => {
      const now = new Date();
      dbMock.campaign.findFirst = vi.fn().mockResolvedValue({
        id: 'cm-1',
        status: 'DRAFT',
        workspaceId,
      });

      dbMock.$transaction = vi.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const txMock = {
          campaignAsset: { deleteMany: vi.fn(), createMany: vi.fn() },
          campaign: {
            update: vi.fn().mockResolvedValue({
              id: 'cm-1',
              name: 'Campanha 1',
              description: null,
              status: 'ACTIVE',
              startDate: null,
              endDate: null,
              createdAt: now,
              updatedAt: now,
              assets: [],
            }),
          },
        };
        return fn(txMock);
      });

      const result = await service.update(workspaceId, 'cm-1', { status: 'ACTIVE' } as any);

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('ACTIVE');
    });

    it('deve rejeitar transição FINISHED → ACTIVE', async () => {
      dbMock.campaign.findFirst = vi.fn().mockResolvedValue({
        id: 'cm-1',
        status: 'FINISHED',
        workspaceId,
      });

      await expect(
        service.update(workspaceId, 'cm-1', { status: 'ACTIVE' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve rejeitar transição CANCELLED → ACTIVE', async () => {
      dbMock.campaign.findFirst = vi.fn().mockResolvedValue({
        id: 'cm-1',
        status: 'CANCELLED',
        workspaceId,
      });

      await expect(
        service.update(workspaceId, 'cm-1', { status: 'ACTIVE' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve lançar NotFoundException se campanha não existir', async () => {
      dbMock.campaign.findFirst = vi.fn().mockResolvedValue(null);

      await expect(
        service.update(workspaceId, 'cm-999', { name: 'Novo Nome' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── remove ──────────────────────────────────────────────────────

  describe('remove', () => {
    it('deve excluir campanha e finalizar schedules vinculadas', async () => {
      dbMock.campaign.findFirst = vi.fn().mockResolvedValue({
        id: 'cm-1',
      });
      dbMock.$transaction = vi.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const txMock = {
          schedule: {
            updateMany: vi.fn().mockResolvedValue({ count: 2 }),
          },
          campaign: {
            delete: vi.fn().mockResolvedValue({ id: 'cm-1' }),
          },
        };
        return fn(txMock);
      });

      const result = await service.remove(workspaceId, 'cm-1');

      expect(result.success).toBe(true);
    });

    it('deve excluir campanha ACTIVE', async () => {
      dbMock.campaign.findFirst = vi.fn().mockResolvedValue({
        id: 'cm-1',
      });
      dbMock.$transaction = vi.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const txMock = {
          schedule: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          campaign: {
            delete: vi.fn().mockResolvedValue({ id: 'cm-1' }),
          },
        };
        return fn(txMock);
      });

      const result = await service.remove(workspaceId, 'cm-1');

      expect(result.success).toBe(true);
    });

    it('deve lançar NotFoundException se campanha não existir', async () => {
      dbMock.campaign.findFirst = vi.fn().mockResolvedValue(null);

      await expect(service.remove(workspaceId, 'cm-999')).rejects.toThrow(NotFoundException);
    });
  });
});
