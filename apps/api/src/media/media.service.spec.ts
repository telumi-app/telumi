import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DatabaseService } from '@/modules/database';

import { MediaService } from './media.service';
import { StorageProvider } from './storage/storage.interface';

describe('MediaService', () => {
  let service: MediaService;

  const dbMock = {
    media: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
    },
  } as unknown as DatabaseService;

  const storageMock: StorageProvider = {
    presignedPutUrl: vi.fn(),
    presignedGetUrl: vi.fn(),
    getObject: vi.fn(),
    putObject: vi.fn(),
    listObjects: vi.fn(),
    delete: vi.fn(),
    exists: vi.fn(),
    ensureBucket: vi.fn(),
  };

  const transcodeMock = {
    processTranscodeJob: vi.fn().mockResolvedValue('PENDING'),
  };

  const workspaceId = 'ws-1';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MediaService(dbMock, storageMock, transcodeMock as any);
  });

  // ─── requestUploadUrl ──────────────────────────────────────────────

  describe('requestUploadUrl', () => {
    it('deve criar registro PENDING e retornar presigned URL', async () => {
      const now = new Date();
      dbMock.media.create = vi.fn().mockResolvedValue({
        id: 'media-1',
        workspaceId,
        name: 'Banner',
        originalName: 'banner.jpg',
        mimeType: 'image/jpeg',
        mediaType: 'IMAGE',
        fileSize: 102400,
        storageKey: '',
        uploadStatus: 'PENDING',
        createdAt: now,
        updatedAt: now,
      });

      dbMock.media.update = vi.fn().mockResolvedValue({});
      (storageMock.presignedPutUrl as ReturnType<typeof vi.fn>).mockResolvedValue(
        'https://minio:9000/presigned-put',
      );

      const result = await service.requestUploadUrl(workspaceId, {
        name: 'Banner',
        originalName: 'banner.jpg',
        mimeType: 'image/jpeg',
        fileSize: 102400,
      });

      expect(result.success).toBe(true);
      expect(result.data.mediaId).toBe('media-1');
      expect(result.data.uploadUrl).toBe('https://minio:9000/presigned-put');
      expect(result.data.expiresInSec).toBe(3600);
      expect(dbMock.media.create).toHaveBeenCalledOnce();
      expect(dbMock.media.update).toHaveBeenCalledOnce();
    });

    it('deve rejeitar arquivo de imagem acima de 50 MB', async () => {
      const oversizedFileSize = 51 * 1024 * 1024;

      await expect(
        service.requestUploadUrl(workspaceId, {
          name: 'Huge Image',
          originalName: 'huge.png',
          mimeType: 'image/png',
          fileSize: oversizedFileSize,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve aceitar vídeo de até 500 MB', async () => {
      const now = new Date();
      dbMock.media.create = vi.fn().mockResolvedValue({
        id: 'media-2',
        workspaceId,
        name: 'Video',
        originalName: 'video.mp4',
        mimeType: 'video/mp4',
        mediaType: 'VIDEO',
        fileSize: 400 * 1024 * 1024,
        storageKey: '',
        uploadStatus: 'PENDING',
        createdAt: now,
        updatedAt: now,
      });
      dbMock.media.update = vi.fn().mockResolvedValue({});
      (storageMock.presignedPutUrl as ReturnType<typeof vi.fn>).mockResolvedValue('url');

      const result = await service.requestUploadUrl(workspaceId, {
        name: 'Video',
        originalName: 'video.mp4',
        mimeType: 'video/mp4',
        fileSize: 400 * 1024 * 1024,
        durationMs: 30000,
      });

      expect(result.success).toBe(true);
    });
  });

  // ─── confirmUpload ─────────────────────────────────────────────────

  describe('confirmUpload', () => {
    it('deve confirmar upload quando arquivo existe no storage', async () => {
      const now = new Date();
      const media = {
        id: 'media-1',
        workspaceId,
        name: 'Banner',
        originalName: 'banner.jpg',
        mimeType: 'image/jpeg',
        mediaType: 'IMAGE',
        fileSize: 102400,
        durationMs: null,
        width: null,
        height: null,
        hash: null,
        storageKey: 'ws-1/media-1/banner.jpg',
        thumbnailKey: null,
        uploadStatus: 'PENDING',
        createdAt: now,
        updatedAt: now,
      };

      dbMock.media.findFirst = vi.fn().mockResolvedValue(media);
      (storageMock.exists as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      dbMock.media.update = vi.fn().mockResolvedValue({
        ...media,
        uploadStatus: 'READY',
        hlsStatus: null,
      });

      const result = await service.confirmUpload(workspaceId, 'media-1');

      expect(result.success).toBe(true);
      expect(result.data.uploadStatus).toBe('READY');
      expect(result.data.publicationState).toBe('READY');
    });

    it('deve lançar 404 quando mídia não existe', async () => {
      dbMock.media.findFirst = vi.fn().mockResolvedValue(null);

      await expect(
        service.confirmUpload(workspaceId, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('deve lançar erro quando arquivo não existe no storage', async () => {
      const now = new Date();
      dbMock.media.findFirst = vi.fn().mockResolvedValue({
        id: 'media-1',
        workspaceId,
        storageKey: 'ws-1/media-1/banner.jpg',
        uploadStatus: 'PENDING',
        createdAt: now,
        updatedAt: now,
      });
      (storageMock.exists as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      await expect(
        service.confirmUpload(workspaceId, 'media-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── findAll ──────────────────────────────────────────────────

  describe('findAll', () => {
    it('deve listar mídias READY com URLs presignadas', async () => {
      const now = new Date();
      dbMock.media.findMany = vi.fn().mockResolvedValue([
        {
          id: 'media-1',
          name: 'Banner',
          originalName: 'banner.jpg',
          mimeType: 'image/jpeg',
          mediaType: 'IMAGE',
          fileSize: 102400,
          durationMs: null,
          width: 1920,
          height: 1080,
          hash: null,
          storageKey: 'ws-1/media-1/banner.jpg',
          uploadStatus: 'READY',
          createdAt: now,
          updatedAt: now,
        },
      ]);

      (storageMock.presignedGetUrl as ReturnType<typeof vi.fn>).mockResolvedValue(
        'https://minio:9000/presigned-get',
      );

      const result = await service.findAll(workspaceId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]!.url).toBe('https://minio:9000/presigned-get');
      expect(result.data[0]!.name).toBe('Banner');
      expect(result.data[0]!.publicationState).toBe('READY');
    });

    it('deve expor vídeo em transcoding enquanto HLS é preparado', async () => {
      const now = new Date();
      dbMock.media.findMany = vi.fn().mockResolvedValue([
        {
          id: 'media-2',
          name: 'Lobby Loop',
          originalName: 'loop.mp4',
          mimeType: 'video/mp4',
          mediaType: 'VIDEO',
          fileSize: 8 * 1024 * 1024,
          durationMs: 15000,
          width: 1920,
          height: 1080,
          hash: 'abc',
          storageKey: 'ws-1/media-2/loop.mp4',
          uploadStatus: 'READY',
          hlsStatus: 'PROCESSING',
          createdAt: now,
          updatedAt: now,
        },
      ]);

      (storageMock.presignedGetUrl as ReturnType<typeof vi.fn>).mockResolvedValue('https://minio:9000/video');

      const result = await service.findAll(workspaceId);

      expect(result.data[0]!.publicationState).toBe('TRANSCODING');
      expect(result.data[0]!.playbackReadiness).toBe('READY_WITH_FALLBACK');
      expect(result.data[0]!.deliveryCandidates).toEqual([
        { mode: 'MP4', ready: true, label: 'Fonte direta compatível' },
        { mode: 'HLS', ready: false, label: 'HLS adaptativo' },
      ]);
    });

    it('deve bloquear vídeo mov até a versão segura ficar pronta', async () => {
      const now = new Date();
      dbMock.media.findMany = vi.fn().mockResolvedValue([
        {
          id: 'media-3',
          name: 'Outdoor Reel',
          originalName: 'outdoor.mov',
          mimeType: 'video/quicktime',
          mediaType: 'VIDEO',
          fileSize: 12 * 1024 * 1024,
          durationMs: 20000,
          width: 1920,
          height: 1080,
          hash: 'mov-hash',
          storageKey: 'ws-1/media-3/outdoor.mov',
          uploadStatus: 'READY',
          hlsStatus: 'PROCESSING',
          createdAt: now,
          updatedAt: now,
        },
      ]);

      const result = await service.findAll(workspaceId);

      expect(result.data[0]!.publicationState).toBe('TRANSCODING');
      expect(result.data[0]!.playbackReadiness).toBe('BLOCKED');
      expect(result.data[0]!.url).toBeUndefined();
      expect(result.data[0]!.deliveryCandidates).toEqual([
        { mode: 'MP4', ready: false, label: 'Fonte direta compatível' },
        { mode: 'HLS', ready: false, label: 'HLS adaptativo' },
      ]);
    });
  });

  // ─── findOne ──────────────────────────────────────────────────

  describe('findOne', () => {
    it('deve retornar detalhe da mídia com URL', async () => {
      const now = new Date();
      dbMock.media.findFirst = vi.fn().mockResolvedValue({
        id: 'media-1',
        name: 'Banner',
        originalName: 'banner.jpg',
        mimeType: 'image/jpeg',
        mediaType: 'IMAGE',
        fileSize: 102400,
        durationMs: null,
        width: 1920,
        height: 1080,
        hash: null,
        storageKey: 'ws-1/media-1/banner.jpg',
        uploadStatus: 'READY',
        createdAt: now,
        updatedAt: now,
      });

      (storageMock.presignedGetUrl as ReturnType<typeof vi.fn>).mockResolvedValue(
        'https://minio:9000/get-url',
      );

      const result = await service.findOne(workspaceId, 'media-1');

      expect(result.success).toBe(true);
      expect(result.data.url).toBe('https://minio:9000/get-url');
    });

    it('deve lançar 404 se mídia não existe', async () => {
      dbMock.media.findFirst = vi.fn().mockResolvedValue(null);

      await expect(
        service.findOne(workspaceId, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── rename ──────────────────────────────────────────────────

  describe('rename', () => {
    it('deve renomear uma mídia', async () => {
      const now = new Date();
      dbMock.media.findFirst = vi.fn().mockResolvedValue({
        id: 'media-1',
        workspaceId,
        name: 'Old Name',
        createdAt: now,
        updatedAt: now,
      });

      dbMock.media.update = vi.fn().mockResolvedValue({
        id: 'media-1',
        name: 'New Name',
        originalName: 'banner.jpg',
        mimeType: 'image/jpeg',
        mediaType: 'IMAGE',
        fileSize: 102400,
        durationMs: null,
        width: null,
        height: null,
        hash: null,
        uploadStatus: 'READY',
        createdAt: now,
        updatedAt: now,
      });

      const result = await service.rename(workspaceId, 'media-1', 'New Name');

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('New Name');
    });

    it('deve lançar 404 se mídia não existe', async () => {
      dbMock.media.findFirst = vi.fn().mockResolvedValue(null);

      await expect(
        service.rename(workspaceId, 'nonexistent', 'Name'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── remove ──────────────────────────────────────────────────

  describe('remove', () => {
    it('deve remover mídia do storage e banco', async () => {
      dbMock.media.findFirst = vi.fn().mockResolvedValue({
        id: 'media-1',
        workspaceId,
        storageKey: 'ws-1/media-1/banner.jpg',
        thumbnailKey: null,
      });
      dbMock.media.delete = vi.fn().mockResolvedValue({});
      (storageMock.delete as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const result = await service.remove(workspaceId, 'media-1');

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('media-1');
      expect(storageMock.delete).toHaveBeenCalledWith('ws-1/media-1/banner.jpg');
      expect(dbMock.media.delete).toHaveBeenCalledOnce();
    });

    it('deve lançar 404 se mídia não existe', async () => {
      dbMock.media.findFirst = vi.fn().mockResolvedValue(null);

      await expect(
        service.remove(workspaceId, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
