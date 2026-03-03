import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DevicesService } from './devices.service';

import { DatabaseService } from '@/modules/database';

describe('DevicesService', () => {
  let service: DevicesService;

  const dbMock = {
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
  } as unknown as DatabaseService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DevicesService(dbMock);
  });

  describe('create', () => {
    it('deve retornar 403 se location não pertence ao ambiente', async () => {
      dbMock.location.findFirst = vi.fn().mockResolvedValue(null);

      await expect(
        service.create('workspace-1', {
          name: 'TV Recepção',
          locationId: 'loc-other-workspace',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('deve retornar 403 se limite de telas atingido', async () => {
      dbMock.location.findFirst = vi.fn().mockResolvedValue({
        id: 'loc-1',
        workspaceId: 'workspace-1',
      });
      dbMock.device.count = vi.fn().mockResolvedValue(3);

      await expect(
        service.create('workspace-1', {
          name: 'TV Extra',
          locationId: 'loc-1',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('deve retornar 409 se nome duplicado no workspace', async () => {
      dbMock.location.findFirst = vi.fn().mockResolvedValue({
        id: 'loc-1',
        workspaceId: 'workspace-1',
      });
      dbMock.device.count = vi.fn().mockResolvedValue(1);
      dbMock.device.findUnique = vi.fn().mockResolvedValue({
        id: 'dev-existing',
        name: 'TV Recepção',
      });

      await expect(
        service.create('workspace-1', {
          name: 'TV Recepção',
          locationId: 'loc-1',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('deve criar um device com sucesso', async () => {
      dbMock.location.findFirst = vi.fn().mockResolvedValue({
        id: 'loc-1',
        workspaceId: 'workspace-1',
      });
      dbMock.device.count = vi.fn().mockResolvedValue(0);

      // Name uniqueness check
      dbMock.device.findUnique = vi.fn().mockResolvedValue(null);

      const now = new Date();
      dbMock.device.create = vi.fn().mockResolvedValue({
        id: 'dev-1',
        name: 'TV Recepção',
        locationId: 'loc-1',
        pairingCode: 'ABC123',
        pairingExpiresAt: new Date(Date.now() + 600000),
        pairedAt: null,
        lastHeartbeat: null,
        createdAt: now,
        location: { id: 'loc-1', name: 'Shopping' },
      });

      const result = await service.create('workspace-1', {
        name: 'TV Recepção',
        locationId: 'loc-1',
      });

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('TV Recepção');
      expect(result.data.pairingCode).toBe('ABC123');
      expect(result.data.status).toBe('PENDING');
    });
  });

  describe('regenerateCode', () => {
    it('deve retornar 404 se device não encontrado', async () => {
      dbMock.device.findFirst = vi.fn().mockResolvedValue(null);

      await expect(
        service.regenerateCode('workspace-1', 'dev-nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('deve regenerar código com sucesso', async () => {
      dbMock.device.findFirst = vi.fn().mockResolvedValue({
        id: 'dev-1',
        workspaceId: 'workspace-1',
      });

      // Code uniqueness check
      dbMock.device.findUnique = vi.fn().mockResolvedValue(null);

      dbMock.device.update = vi.fn().mockResolvedValue({
        id: 'dev-1',
        pairingCode: 'XYZ789',
        pairingExpiresAt: new Date(Date.now() + 600000),
      });

      const result = await service.regenerateCode('workspace-1', 'dev-1');

      expect(result.success).toBe(true);
      expect(result.data.pairingCode).toBe('XYZ789');
    });
  });

  describe('update', () => {
    it('deve retornar 404 quando a tela não existir no workspace', async () => {
      dbMock.device.findFirst = vi.fn().mockResolvedValue(null);

      await expect(
        service.update('workspace-1', 'dev-inexistente', { name: 'TV Nova' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('deve retornar 403 ao trocar para local de outro workspace', async () => {
      dbMock.device.findFirst = vi.fn().mockResolvedValueOnce({
        id: 'dev-1',
        workspaceId: 'workspace-1',
        name: 'TV Recepção',
        locationId: 'loc-1',
        orientation: 'HORIZONTAL',
        resolution: 'AUTO',
        operationalStatus: 'ACTIVE',
        isPublic: false,
        pairingCode: 'ABC123',
        pairingExpiresAt: new Date(),
        pairedAt: null,
        lastHeartbeat: null,
        createdAt: new Date(),
        location: { id: 'loc-1', name: 'Unidade Centro' },
      });
      dbMock.location.findFirst = vi.fn().mockResolvedValue(null);

      await expect(
        service.update('workspace-1', 'dev-1', { locationId: 'loc-outro' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('deve atualizar metadados da tela com sucesso', async () => {
      const now = new Date();

      dbMock.device.findFirst = vi.fn().mockResolvedValueOnce({
        id: 'dev-1',
        workspaceId: 'workspace-1',
        name: 'TV Recepção',
        locationId: 'loc-1',
        orientation: 'HORIZONTAL',
        resolution: 'AUTO',
        operationalStatus: 'ACTIVE',
        isPublic: false,
        pairingCode: 'ABC123',
        pairingExpiresAt: new Date(Date.now() + 600000),
        pairedAt: null,
        lastHeartbeat: null,
        createdAt: now,
        location: { id: 'loc-1', name: 'Unidade Centro' },
      });
      dbMock.device.findUnique = vi.fn().mockResolvedValue(null);
      dbMock.device.update = vi.fn().mockResolvedValue({
        id: 'dev-1',
        workspaceId: 'workspace-1',
        name: 'TV Recepção Principal',
        locationId: 'loc-1',
        orientation: 'VERTICAL',
        resolution: '1920x1080',
        operationalStatus: 'INACTIVE',
        isPublic: true,
        pairingCode: 'ABC123',
        pairingExpiresAt: new Date(Date.now() + 600000),
        pairedAt: null,
        lastHeartbeat: null,
        createdAt: now,
        location: { id: 'loc-1', name: 'Unidade Centro' },
      });

      const result = await service.update('workspace-1', 'dev-1', {
        name: 'TV Recepção Principal',
        orientation: 'VERTICAL',
        resolution: '1920x1080',
        operationalStatus: 'INACTIVE',
        isPublic: true,
      });

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('TV Recepção Principal');
      expect(result.data.orientation).toBe('VERTICAL');
      expect(result.data.operationalStatus).toBe('INACTIVE');
      expect(result.data.isPublic).toBe(true);
    });
  });
});
