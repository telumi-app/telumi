import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LocationsService } from './locations.service';

import { DatabaseService } from '@/modules/database';

describe('LocationsService', () => {
  let service: LocationsService;

  const dbMock = {
    location: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  } as unknown as DatabaseService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LocationsService(dbMock);
  });

  describe('findAll', () => {
    it('deve listar locais do workspace', async () => {
      dbMock.location.findMany = vi.fn().mockResolvedValue([
        {
          id: 'loc-1',
          name: 'Shopping',
          address: 'Rua A',
          city: 'São Paulo',
          state: 'SP',
          latitude: -23.5,
          longitude: -46.6,
          placeId: 'place-1',
          _count: { devices: 2 },
          createdAt: new Date(),
        },
      ]);

      const result = await service.findAll('workspace-1');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]!.name).toBe('Shopping');
      expect(result.data[0]!.deviceCount).toBe(2);
    });
  });

  describe('create', () => {
    it('deve criar um local com sucesso', async () => {
      dbMock.location.findUnique = vi.fn().mockResolvedValue(null);

      const now = new Date();
      dbMock.location.create = vi.fn().mockResolvedValue({
        id: 'loc-1',
        name: 'Shopping Iguatemi',
        address: 'Av. Faria Lima',
        city: 'São Paulo',
        state: 'SP',
        latitude: -23.5,
        longitude: -46.6,
        placeId: 'place-1',
        createdAt: now,
      });

      const result = await service.create('workspace-1', {
        name: 'Shopping Iguatemi',
        address: 'Av. Faria Lima',
        city: 'São Paulo',
        state: 'SP',
        latitude: -23.5,
        longitude: -46.6,
        placeId: 'place-1',
      });

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Shopping Iguatemi');
    });

    it('deve retornar 409 se nome duplicado no workspace', async () => {
      dbMock.location.findUnique = vi.fn().mockResolvedValue({
        id: 'loc-existing',
        name: 'Shopping',
      });

      await expect(
        service.create('workspace-1', { name: 'Shopping' }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
