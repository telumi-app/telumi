import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DatabaseService } from '@/modules/database';
import { StorageProvider } from '@/media/storage/storage.interface';

import { PlaylistsService } from './playlists.service';

describe('PlaylistsService', () => {
  let service: PlaylistsService;

  const dbMock = {
    playlist: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    playlistItem: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    media: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  } as unknown as DatabaseService;

  const workspaceId = 'ws-1';

  const storageMock: StorageProvider = {
    presignedPutUrl: vi.fn(),
    presignedGetUrl: vi.fn(),
    exists: vi.fn(),
    delete: vi.fn(),
    ensureBucket: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PlaylistsService(dbMock, storageMock);
  });

  // ─── findAll ─────────────────────────────────────────────────────

  describe('findAll', () => {
    it('deve listar playlists do workspace', async () => {
      const now = new Date();
      dbMock.playlist.findMany = vi.fn().mockResolvedValue([
        {
          id: 'pl-1',
          name: 'Playlist 1',
          description: null,
          totalDurationMs: 30000,
          itemCount: 2,
          createdAt: now,
          updatedAt: now,
          items: [],
        },
      ]);

      const result = await service.findAll(workspaceId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Playlist 1');
    });
  });

  // ─── findOne ─────────────────────────────────────────────────────

  describe('findOne', () => {
    it('deve retornar playlist existente', async () => {
      const now = new Date();
      dbMock.playlist.findFirst = vi.fn().mockResolvedValue({
        id: 'pl-1',
        name: 'Playlist 1',
        description: 'desc',
        totalDurationMs: 15000,
        itemCount: 1,
        createdAt: now,
        updatedAt: now,
        items: [],
      });

      const result = await service.findOne(workspaceId, 'pl-1');

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('pl-1');
    });

    it('deve lançar NotFoundException se playlist não existir', async () => {
      dbMock.playlist.findFirst = vi.fn().mockResolvedValue(null);

      await expect(service.findOne(workspaceId, 'pl-999')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ──────────────────────────────────────────────────────

  describe('create', () => {
    it('deve criar playlist sem itens', async () => {
      const now = new Date();
      dbMock.playlist.findUnique = vi.fn().mockResolvedValue(null);
      dbMock.playlist.create = vi.fn().mockResolvedValue({
        id: 'pl-1',
        name: 'Minha Playlist',
        description: null,
        totalDurationMs: 0,
        itemCount: 0,
        createdAt: now,
        updatedAt: now,
        items: [],
      });

      const result = await service.create(workspaceId, {
        name: 'Minha Playlist',
      } as any);

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Minha Playlist');
      expect(result.data.itemCount).toBe(0);
    });

    it('deve lançar ConflictException se nome já existir', async () => {
      dbMock.playlist.findUnique = vi.fn().mockResolvedValue({ id: 'pl-existing' });

      await expect(
        service.create(workspaceId, { name: 'Duplicada' } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('deve lançar NotFoundException se mídia não existir', async () => {
      dbMock.playlist.findUnique = vi.fn().mockResolvedValue(null);
      dbMock.media.findMany = vi.fn().mockResolvedValue([]);

      await expect(
        service.create(workspaceId, {
          name: 'Playlist com mídia',
          items: [{ mediaId: 'media-missing', position: 0 }],
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('deve criar playlist com itens quando mídias existem', async () => {
      const now = new Date();
      dbMock.playlist.findUnique = vi.fn().mockResolvedValue(null);
      dbMock.media.findMany = vi.fn().mockResolvedValue([{ id: 'media-1' }]);
      dbMock.playlist.create = vi.fn().mockResolvedValue({
        id: 'pl-1',
        name: 'Com Itens',
        description: null,
        totalDurationMs: 15000,
        itemCount: 1,
        createdAt: now,
        updatedAt: now,
        items: [
          {
            id: 'pi-1',
            mediaId: 'media-1',
            position: 0,
            durationMs: 15000,
            media: {
              id: 'media-1',
              name: 'Banner',
              originalName: 'banner.jpg',
              mimeType: 'image/jpeg',
              mediaType: 'IMAGE',
              fileSize: 1024,
              durationMs: null,
              width: 1920,
              height: 1080,
            },
          },
        ],
      });

      const result = await service.create(workspaceId, {
        name: 'Com Itens',
        items: [{ mediaId: 'media-1', position: 0 }],
      } as any);

      expect(result.success).toBe(true);
      expect(result.data.itemCount).toBe(1);
      expect(result.data.items).toHaveLength(1);
    });
  });

  // ─── remove ──────────────────────────────────────────────────────

  describe('remove', () => {
    it('deve excluir playlist existente', async () => {
      dbMock.playlist.findFirst = vi.fn().mockResolvedValue({ id: 'pl-1' });
      dbMock.playlist.delete = vi.fn().mockResolvedValue({});

      const result = await service.remove(workspaceId, 'pl-1');

      expect(result.success).toBe(true);
      expect(dbMock.playlist.delete).toHaveBeenCalledWith({ where: { id: 'pl-1' } });
    });

    it('deve lançar NotFoundException se playlist não existir', async () => {
      dbMock.playlist.findFirst = vi.fn().mockResolvedValue(null);

      await expect(service.remove(workspaceId, 'pl-999')).rejects.toThrow(NotFoundException);
    });
  });
});
