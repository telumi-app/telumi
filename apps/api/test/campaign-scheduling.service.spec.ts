import { describe, it, expect, vi, beforeEach } from 'vitest';

import { CampaignSchedulingService } from '../src/campaign-scheduling/campaign-scheduling.service';
import { CapacityEngineService } from '../src/campaign-scheduling/capacity-engine.service';
import { ValidationStatus, ScheduleErrorCode } from '@telumi/shared';

// ─── Mocks ──────────────────────────────────────────────────────────

function createMockDb() {
  return {
    campaign: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    device: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    scheduleOccurrence: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
    scheduleRule: {
      create: vi.fn(),
    },
    capacityHold: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    workspace: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  };
}

function createMockCampaign(overrides: Record<string, unknown> = {}) {
  return {
    id: 'campaign-1',
    workspaceId: 'ws-1',
    name: 'Test Campaign',
    status: 'DRAFT',
    assets: [
      {
        id: 'asset-1',
        mediaId: 'media-1',
        position: 0,
        durationMs: 15000, // 15 seconds
        media: { id: 'media-1', durationMs: 15000 },
      },
      {
        id: 'asset-2',
        mediaId: 'media-2',
        position: 1,
        durationMs: 15000,
        media: { id: 'media-2', durationMs: 15000 },
      },
    ],
    ...overrides,
  };
}

function createValidateDto(overrides: Record<string, unknown> = {}) {
  return {
    timezone: 'America/Sao_Paulo',
    dateStart: '2026-03-10',
    dateEnd: '2026-03-10',
    daysOfWeek: [2], // terça-feira
    windows: [{ startTime: '09:00', endTime: '12:00' }],
    playsPerHour: 12,
    screenIds: ['screen-1', 'screen-2'],
    ...overrides,
  };
}

// ─── Testes ─────────────────────────────────────────────────────────

describe('CampaignSchedulingService', () => {
  let service: CampaignSchedulingService;
  let capacityEngine: CapacityEngineService;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
    capacityEngine = new CapacityEngineService(db as any);
    service = new CampaignSchedulingService(db as any, capacityEngine);

    // Padrão: expirar holds não afeta nada
    db.capacityHold.updateMany.mockResolvedValue({ count: 0 });
  });

  // ─── VALIDATE ──────────────────────────────────────────────────────

  describe('validate', () => {
    it('retorna OK quando tudo cabe', async () => {
      const campaign = createMockCampaign();
      const dto = createValidateDto();

      db.campaign.findFirst.mockResolvedValue(campaign);
      db.device.findMany.mockResolvedValue([
        { id: 'screen-1', name: 'TV Recepção 1' },
        { id: 'screen-2', name: 'TV Recepção 2' },
      ]);

      // Sem ocorrências existentes no banco
      db.scheduleOccurrence.findMany.mockResolvedValue([]);
      // Sem holds ativos de outras campanhas
      db.capacityHold.findMany.mockResolvedValue([]);
      // Hold criado
      db.capacityHold.create.mockResolvedValue({ id: 'hold-1' });

      const result = await service.validate('ws-1', 'campaign-1', dto as any);

      expect(result.status).toBe(ValidationStatus.OK);
      expect(result.code).toBeNull();
      expect(result.eligibleScreensCount).toBe(2);
      expect(result.timelineDurationSeconds).toBe(30); // 15s + 15s
      expect(result.playsPerHour).toBe(12);
      expect(result.rate).toBeCloseTo(0.1, 6); // 30 * 12 / 3600
      expect(result.holdId).toBe('hold-1');
      expect(result.holdExpiresAt).toBeTruthy();
      expect(result.suggestions).toEqual([]);
    });

    it('retorna INVALIDO quando campanha não tem assets', async () => {
      const campaign = createMockCampaign({ assets: [] });
      const dto = createValidateDto();

      db.campaign.findFirst.mockResolvedValue(campaign);

      const result = await service.validate('ws-1', 'campaign-1', dto as any);

      expect(result.status).toBe(ValidationStatus.INVALIDO);
      expect(result.code).toBe(ScheduleErrorCode.INVALID_TIMELINE);
      expect(result.holdId).toBeNull();
    });

    it('retorna INVALIDO quando dateStart > dateEnd', async () => {
      const campaign = createMockCampaign();
      const dto = createValidateDto({
        dateStart: '2026-03-15',
        dateEnd: '2026-03-10',
      });

      db.campaign.findFirst.mockResolvedValue(campaign);

      const result = await service.validate('ws-1', 'campaign-1', dto as any);

      expect(result.status).toBe(ValidationStatus.INVALIDO);
      expect(result.code).toBe(ScheduleErrorCode.INVALID_DATES);
    });

    it('retorna INVALIDO quando nenhuma tela é elegível', async () => {
      const campaign = createMockCampaign();
      const dto = createValidateDto();

      db.campaign.findFirst.mockResolvedValue(campaign);
      db.device.findMany.mockResolvedValue([]); // nenhuma tela ativa

      const result = await service.validate('ws-1', 'campaign-1', dto as any);

      expect(result.status).toBe(ValidationStatus.INVALIDO);
      expect(result.code).toBe(ScheduleErrorCode.NO_ELIGIBLE_SCREENS);
    });

    it('retorna PARCIAL quando parte das telas não cabe', async () => {
      const campaign = createMockCampaign();
      const dto = createValidateDto({ playsPerHour: 12 });

      db.campaign.findFirst.mockResolvedValue(campaign);
      db.device.findMany.mockResolvedValue([
        { id: 'screen-1', name: 'TV 1' },
        { id: 'screen-2', name: 'TV 2' },
      ]);

      // screen-1: sem existente → cabe
      // screen-2: ocorrência existente rate=0.9 (0.9 + 0.1 = 1.0 > 0.95) → não cabe
      db.scheduleOccurrence.findMany.mockImplementation(async (args: any) => {
        if (args?.where?.screenId === 'screen-2') {
          return [{
            startAtUtc: new Date('2026-03-10T12:00:00Z'),
            endAtUtc: new Date('2026-03-10T15:00:00Z'),
            rate: 0.9,
          }];
        }
        return [];
      });
      db.capacityHold.findMany.mockResolvedValue([]);
      db.capacityHold.create.mockResolvedValue({ id: 'hold-2' });

      const result = await service.validate('ws-1', 'campaign-1', dto as any);

      expect(result.status).toBe(ValidationStatus.PARCIAL);
      expect(result.code).toBe(ScheduleErrorCode.CAPACITY_PARTIAL);
      expect(result.holdId).toBe('hold-2');
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('retorna SEM_CAPACIDADE quando nenhuma tela cabe', async () => {
      const campaign = createMockCampaign();
      const dto = createValidateDto({
        playsPerHour: 12,
        screenIds: ['screen-1'],
      });

      db.campaign.findFirst.mockResolvedValue(campaign);
      db.device.findMany.mockResolvedValue([
        { id: 'screen-1', name: 'TV 1' },
      ]);

      // Tela lotada: rate=0.9 + 0.1 = 1.0 > 0.95
      db.scheduleOccurrence.findMany.mockResolvedValue([{
        startAtUtc: new Date('2026-03-10T12:00:00Z'),
        endAtUtc: new Date('2026-03-10T15:00:00Z'),
        rate: 0.9,
      }]);
      db.capacityHold.findMany.mockResolvedValue([]);

      const result = await service.validate('ws-1', 'campaign-1', dto as any);

      expect(result.status).toBe(ValidationStatus.SEM_CAPACIDADE);
      expect(result.code).toBe(ScheduleErrorCode.CAPACITY_FULL);
      expect(result.holdId).toBeNull();
    });

    it('invalida holds anteriores da mesma campanha ao criar novo', async () => {
      const campaign = createMockCampaign();
      const dto = createValidateDto({ screenIds: ['screen-1'] });

      db.campaign.findFirst.mockResolvedValue(campaign);
      db.device.findMany.mockResolvedValue([{ id: 'screen-1', name: 'TV 1' }]);
      db.scheduleOccurrence.findMany.mockResolvedValue([]);
      db.capacityHold.findMany.mockResolvedValue([]);
      db.capacityHold.create.mockResolvedValue({ id: 'hold-new' });

      await service.validate('ws-1', 'campaign-1', dto as any);

      // Deve ter expirado holds anteriores da mesma campanha
      expect(db.capacityHold.updateMany).toHaveBeenCalledWith({
        where: { campaignId: 'campaign-1', status: 'ACTIVE' },
        data: { status: 'EXPIRED' },
      });
    });
  });

  // ─── CONFIRM ───────────────────────────────────────────────────────

  describe('confirm', () => {
    const holdOccurrences = [
      {
        screenId: 'screen-1',
        startAtUtc: '2026-03-10T12:00:00.000Z',
        endAtUtc: '2026-03-10T15:00:00.000Z',
        playsPerHour: 12,
        rate: 0.1,
        timelineDurationSeconds: 30,
      },
    ];

    it('confirma com hold válido', async () => {
      const campaign = createMockCampaign();

      // 1ª chamada: buscar hold pelo id
      // 2ª chamada: verificar idempotency key
      db.capacityHold.findFirst
        .mockResolvedValueOnce({
          id: 'hold-1',
          campaignId: 'campaign-1',
          workspaceId: 'ws-1',
          status: 'ACTIVE',
          expiresAt: new Date(Date.now() + 300_000),
          payloadHash: 'somehash',
          occurrencesJson: holdOccurrences,
        })
        .mockResolvedValueOnce(null); // nenhum conflit de idempotência

      db.campaign.findFirst.mockResolvedValue(campaign);

      // Re-validação de capacidade: sem ocupação
      db.scheduleOccurrence.findMany.mockResolvedValue([]);
      db.capacityHold.findMany.mockResolvedValue([]);

      // Transação interativa
      const ruleCreated = { id: 'rule-1' };
      db.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          scheduleRule: { create: vi.fn().mockResolvedValue(ruleCreated) },
          scheduleOccurrence: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
          campaign: { update: vi.fn().mockResolvedValue(campaign) },
          capacityHold: { update: vi.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      });

      const result = await service.confirm('ws-1', 'campaign-1', {
        holdId: 'hold-1',
        idempotencyKey: 'idem-1',
      } as any);

      expect(result.success).toBe(true);
      expect(result.ruleId).toBe('rule-1');
      expect(result.occurrenceCount).toBe(1);
    });

    it('rejeita hold expirado', async () => {
      db.capacityHold.findFirst.mockResolvedValue({
        id: 'hold-1',
        campaignId: 'campaign-1',
        workspaceId: 'ws-1',
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() - 1_000), // já expirou
        payloadHash: 'somehash',
        occurrencesJson: [],
      });
      db.capacityHold.update.mockResolvedValue({});

      await expect(
        service.confirm('ws-1', 'campaign-1', {
          holdId: 'hold-1',
          idempotencyKey: 'idem-1',
        } as any),
      ).rejects.toThrow();
    });

    it('rejeita hold não encontrado', async () => {
      db.capacityHold.findFirst.mockResolvedValue(null);

      await expect(
        service.confirm('ws-1', 'campaign-1', {
          holdId: 'nonexistent',
          idempotencyKey: 'idem-1',
        } as any),
      ).rejects.toThrow();
    });

    it('rejeita idempotency key já utilizada', async () => {
      // 1ª chamada: buscar hold (válido)
      // 2ª chamada: encontra idempotency key já consumida
      db.capacityHold.findFirst
        .mockResolvedValueOnce({
          id: 'hold-1',
          campaignId: 'campaign-1',
          workspaceId: 'ws-1',
          status: 'ACTIVE',
          expiresAt: new Date(Date.now() + 300_000),
          payloadHash: 'somehash',
          occurrencesJson: holdOccurrences,
        })
        .mockResolvedValueOnce({
          id: 'hold-old',
          idempotencyKey: 'idem-1',
          status: 'CONSUMED',
        });

      await expect(
        service.confirm('ws-1', 'campaign-1', {
          holdId: 'hold-1',
          idempotencyKey: 'idem-1',
        } as any),
      ).rejects.toThrow();
    });

    it('rejeita quando timeline da campanha mudou desde validação', async () => {
      const campaignChanged = createMockCampaign({
        assets: [
          {
            id: 'asset-1',
            mediaId: 'media-1',
            position: 0,
            durationMs: 60000, // 60s em vez de 15s
            media: { id: 'media-1', durationMs: 60000 },
          },
        ],
      });

      // 1ª chamada: hold válido com duration=30s gravada
      // 2ª chamada: sem conflito idempotência
      db.capacityHold.findFirst
        .mockResolvedValueOnce({
          id: 'hold-1',
          campaignId: 'campaign-1',
          workspaceId: 'ws-1',
          status: 'ACTIVE',
          expiresAt: new Date(Date.now() + 300_000),
          payloadHash: 'somehash',
          occurrencesJson: holdOccurrences, // timelineDurationSeconds: 30
        })
        .mockResolvedValueOnce(null);

      // Campanha agora tem duração 60s em vez de 30s
      db.campaign.findFirst.mockResolvedValue(campaignChanged);

      await expect(
        service.confirm('ws-1', 'campaign-1', {
          holdId: 'hold-1',
          idempotencyKey: 'idem-2',
        } as any),
      ).rejects.toThrow();
    });

    it('rejeita quando capacidade mudou e hold não cabe mais', async () => {
      const campaign = createMockCampaign();

      db.capacityHold.findFirst
        .mockResolvedValueOnce({
          id: 'hold-1',
          campaignId: 'campaign-1',
          workspaceId: 'ws-1',
          status: 'ACTIVE',
          expiresAt: new Date(Date.now() + 300_000),
          payloadHash: 'somehash',
          occurrencesJson: holdOccurrences,
        })
        .mockResolvedValueOnce(null); // sem conflito idempotência

      db.campaign.findFirst.mockResolvedValue(campaign);

      // Outra campanha ocupou a tela nesse intervalo (rate=0.9)
      db.scheduleOccurrence.findMany.mockResolvedValue([{
        startAtUtc: new Date('2026-03-10T12:00:00Z'),
        endAtUtc: new Date('2026-03-10T15:00:00Z'),
        rate: 0.9,
      }]);
      db.capacityHold.findMany.mockResolvedValue([]);

      await expect(
        service.confirm('ws-1', 'campaign-1', {
          holdId: 'hold-1',
          idempotencyKey: 'idem-3',
        } as any),
      ).rejects.toThrow();
    });
  });
});
