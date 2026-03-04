import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { DatabaseService } from '@/modules/database/database.service';
import { DevicesService } from '@/devices/devices.service';
import { DeviceErrorCode } from '@/devices/constants';

// ─── Helpers ──────────────────────────────────────────────────────────

function createMockDb() {
  return {
    device: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    location: {
      findFirst: vi.fn(),
    },
    deviceEvent: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    playEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  } as unknown as DatabaseService;
}

function makeDevice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dev-1',
    workspaceId: 'ws-1',
    locationId: 'loc-1',
    name: 'TV Recepção',
    orientation: 'HORIZONTAL' as const,
    resolution: 'AUTO',
    operationalStatus: 'ACTIVE' as const,
    isPublic: false,
    isPartnerTv: false,
    partnerName: null,
    partnerRevenueSharePct: null,
    pairingCode: 'ABC123',
    pairingExpiresAt: new Date(Date.now() + 600_000),
    deviceToken: 'token-xyz',
    deviceSecret: 'secret-abc',
    pairedAt: null,
    lastHeartbeat: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    location: { id: 'loc-1', name: 'Loja Centro' },
    workspace: { id: 'ws-1', name: 'Meu Workspace' },
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────

describe('DevicesService', () => {
  let service: DevicesService;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
    const configMock = {
      get: vi.fn().mockReturnValue('https://telumiapi-production.up.railway.app'),
    };
    service = new DevicesService(db as unknown as DatabaseService, configMock as any);
  });

  // ── pairDevice ────────────────────────────────────────────────────

  describe('pairDevice', () => {
    it('pairs a device successfully with valid code', async () => {
      const device = makeDevice();
      (db.device.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(device);
      (db.device.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...device,
        pairingCode: null,
        pairingExpiresAt: null,
        pairedAt: new Date(),
        deviceToken: 'new-token',
        deviceSecret: 'new-secret',
      });

      const result = await service.pairDevice('ABC123');

      expect(result.success).toBe(true);
      expect(result.data.deviceToken).toBe('new-token');
      expect(result.data.deviceSecret).toBe('new-secret');
      expect(result.data.device.name).toBe('TV Recepção');
    });

    it('throws NotFoundException for invalid code', async () => {
      (db.device.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.pairDevice('XXXXXX')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for expired code', async () => {
      const device = makeDevice({
        pairingExpiresAt: new Date(Date.now() - 60_000), // expired
      });
      (db.device.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(device);

      await expect(service.pairDevice('ABC123')).rejects.toThrow(BadRequestException);
    });
  });

  // ── pairDeviceByToken ─────────────────────────────────────────────

  describe('pairDeviceByToken', () => {
    it('reconnects a device by token', async () => {
      const device = makeDevice({ pairedAt: new Date(), deviceToken: 'existing-token' });
      (db.device.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(device);
      (db.device.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...device,
        pairedAt: new Date(),
      });

      const result = await service.pairDeviceByToken('existing-token');

      expect(result.success).toBe(true);
      expect(result.data.device.id).toBe('dev-1');
    });

    it('throws BadRequestException for empty token', async () => {
      await expect(service.pairDeviceByToken('')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for invalid token', async () => {
      (db.device.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.pairDeviceByToken('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  // ── heartbeatByToken ──────────────────────────────────────────────

  describe('heartbeatByToken', () => {
    it('records heartbeat and returns computed status', async () => {
      const device = makeDevice({ pairedAt: new Date(), deviceToken: 'token-abc' });
      (db.device.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(device);
      (db.device.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...device,
        lastHeartbeat: new Date(),
      });

      const result = await service.heartbeatByToken('token-abc');

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('ONLINE');
    });

    it('throws for invalid occurredAt', async () => {
      const device = makeDevice({ pairedAt: new Date(), deviceToken: 'token-abc' });
      (db.device.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(device);

      await expect(
        service.heartbeatByToken('token-abc', 'not-a-date'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws for empty token', async () => {
      await expect(service.heartbeatByToken('')).rejects.toThrow(BadRequestException);
    });
  });

  // ── create ────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a device with partner fields', async () => {
      const location = { id: 'loc-1', name: 'Loja' };
      (db.location.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(location);
      (db.device.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
      (db.device.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null); // no name collision, no pairing code collision

      const createdDevice = makeDevice({
        isPartnerTv: true,
        partnerName: 'Clínica Saúde',
        partnerRevenueSharePct: 30,
      });
      (db.device.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdDevice);

      const result = await service.create('ws-1', {
        name: 'TV Recepção',
        locationId: 'loc-1',
        isPartnerTv: true,
        partnerName: 'Clínica Saúde',
        partnerRevenueSharePct: 30,
      });

      expect(result.success).toBe(true);
      expect(result.data.isPartnerTv).toBe(true);
      expect(result.data.partnerName).toBe('Clínica Saúde');
      expect(result.data.partnerRevenueSharePct).toBe(30);
    });

    it('throws ForbiddenException when location not in workspace', async () => {
      (db.location.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        service.create('ws-1', { name: 'TV', locationId: 'bad-loc' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when screen limit reached', async () => {
      (db.location.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'loc-1' });
      (db.device.count as ReturnType<typeof vi.fn>).mockResolvedValue(3); // MAX_SCREENS_DEFAULT

      await expect(
        service.create('ws-1', { name: 'TV', locationId: 'loc-1' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException for duplicate name', async () => {
      (db.location.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'loc-1' });
      (db.device.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
      (db.device.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'existing' }); // name collision

      await expect(
        service.create('ws-1', { name: 'TV', locationId: 'loc-1' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── ingestTelemetryEvent ──────────────────────────────────────────

  describe('ingestTelemetryEvent', () => {
    it('creates a telemetry event successfully', async () => {
      (db.device.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'dev-1' });
      (db.deviceEvent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null); // no duplicate
      (db.deviceEvent.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'evt-1' });

      const result = await service.ingestTelemetryEvent({
        deviceToken: 'token-abc',
        eventType: 'CRASH_LOOP',
        severity: 'CRITICAL',
        message: 'Crash detectado',
        occurredAt: new Date().toISOString(),
      });

      expect(result.success).toBe(true);
      expect(result.data.deduplicated).toBe(false);
      expect(result.data.eventId).toBe('evt-1');
    });

    it('deduplicates events within 30 min window', async () => {
      (db.device.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'dev-1' });
      (db.deviceEvent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'existing-evt' });

      const result = await service.ingestTelemetryEvent({
        deviceToken: 'token-abc',
        eventType: 'CRASH_LOOP',
        occurredAt: new Date().toISOString(),
      });

      expect(result.success).toBe(true);
      expect(result.data.deduplicated).toBe(true);
    });

    it('throws for invalid device token', async () => {
      (db.device.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        service.ingestTelemetryEvent({
          deviceToken: 'invalid',
          eventType: 'CRASH_LOOP',
          occurredAt: new Date().toISOString(),
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws for empty token', async () => {
      await expect(
        service.ingestTelemetryEvent({
          deviceToken: '',
          eventType: 'CRASH_LOOP',
          occurredAt: new Date().toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── ingestPlayEvent ───────────────────────────────────────────────

  describe('ingestPlayEvent', () => {
    it('creates a play event successfully', async () => {
      (db.device.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'dev-1',
        deviceSecret: null,
      });
      (db.playEvent.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (db.playEvent.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'pe-1',
        deliveryStatus: 'ONLINE_VERIFIED',
      });

      const now = new Date();
      const result = await service.ingestPlayEvent({
        deviceToken: 'token-abc',
        playId: 'play-001',
        startedAt: now.toISOString(),
        endedAt: new Date(now.getTime() + 15_000).toISOString(),
        durationMs: 15_000,
      });

      expect(result.success).toBe(true);
      expect(result.data.deduplicated).toBe(false);
      expect(result.data.deliveryStatus).toBe('ONLINE_VERIFIED');
    });

    it('deduplicates by playId', async () => {
      (db.device.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'dev-1',
        deviceSecret: null,
      });
      (db.playEvent.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'existing-pe' });

      const now = new Date();
      const result = await service.ingestPlayEvent({
        deviceToken: 'token-abc',
        playId: 'play-001',
        startedAt: now.toISOString(),
        endedAt: new Date(now.getTime() + 15_000).toISOString(),
        durationMs: 15_000,
      });

      expect(result.success).toBe(true);
      expect(result.data.deduplicated).toBe(true);
    });

    it('validates HMAC when deviceSecret is set', async () => {
      const { createHmac } = await import('crypto');
      const deviceSecret = 'test-secret-key';
      const now = new Date();
      const endedAt = new Date(now.getTime() + 15_000);
      const playId = 'play-hmac-001';
      const payload = `${playId}:${now.toISOString()}:${endedAt.toISOString()}:15000`;
      const validSignature = createHmac('sha256', deviceSecret).update(payload).digest('hex');

      (db.device.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'dev-1',
        deviceSecret,
      });
      (db.playEvent.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (db.playEvent.create as ReturnType<typeof vi.fn>).mockImplementation((args: { data: Record<string, unknown> }) => {
        return Promise.resolve({
          id: 'pe-hmac',
          deliveryStatus: args.data.deliveryStatus,
        });
      });

      const result = await service.ingestPlayEvent({
        deviceToken: 'token-abc',
        playId,
        startedAt: now.toISOString(),
        endedAt: endedAt.toISOString(),
        durationMs: 15_000,
        hmacSignature: validSignature,
      });

      expect(result.data.deliveryStatus).toBe('ONLINE_VERIFIED');
    });

    it('marks NOT_ELIGIBLE when HMAC is invalid', async () => {
      (db.device.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'dev-1',
        deviceSecret: 'real-secret',
      });
      (db.playEvent.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (db.playEvent.create as ReturnType<typeof vi.fn>).mockImplementation((args: { data: Record<string, unknown> }) => {
        return Promise.resolve({
          id: 'pe-bad-hmac',
          deliveryStatus: args.data.deliveryStatus,
        });
      });

      const now = new Date();
      const result = await service.ingestPlayEvent({
        deviceToken: 'token-abc',
        playId: 'play-bad-hmac',
        startedAt: now.toISOString(),
        endedAt: new Date(now.getTime() + 15_000).toISOString(),
        durationMs: 15_000,
        hmacSignature: 'totally-wrong-signature',
      });

      expect(result.data.deliveryStatus).toBe('NOT_ELIGIBLE');
    });

    it('throws for empty token', async () => {
      await expect(
        service.ingestPlayEvent({
          deviceToken: '',
          playId: 'x',
          startedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
          durationMs: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── getRecoveryLink ───────────────────────────────────────────────

  describe('getRecoveryLink', () => {
    it('throws when device not found', async () => {
      (db.device.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.getRecoveryLink('ws-1', 'dev-bad')).rejects.toThrow(NotFoundException);
    });

    it('throws when device not yet paired', async () => {
      (db.device.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'dev-1',
        pairedAt: null,
        deviceToken: null,
      });

      await expect(service.getRecoveryLink('ws-1', 'dev-1')).rejects.toThrow(BadRequestException);
    });

    it('returns recovery link for paired device', async () => {
      (db.device.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'dev-1',
        pairedAt: new Date(),
        deviceToken: 'token-xyz',
      });

      const result = await service.getRecoveryLink('ws-1', 'dev-1');

      expect(result.success).toBe(true);
      expect(result.data.recoveryLink).toContain('pairToken=token-xyz');
    });
  });
});
