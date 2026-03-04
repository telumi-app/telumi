import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { DatabaseService } from '@/modules/database';

import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_SIZE,
  MAX_VIDEO_SIZE,
  PENDING_UPLOAD_EXPIRY_MS,
  PRESIGNED_GET_EXPIRY_SEC,
  PRESIGNED_PUT_EXPIRY_SEC,
  isSupportedMimeType,
} from './constants';
import { RequestUploadUrlDto } from './dto/request-upload-url.dto';
import { StorageProvider, STORAGE_PROVIDER } from './storage/storage.interface';
import { TranscodeService } from './transcode';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly db: DatabaseService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    private readonly transcodeService: TranscodeService,
  ) {}

  /**
   * Resolve o tipo de mídia baseado no MIME type.
   */
  private resolveMediaType(mimeType: string): 'IMAGE' | 'VIDEO' {
    return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(mimeType.toLowerCase()) ? 'IMAGE' : 'VIDEO';
  }

  private validateMimeType(mimeType: string): void {
    if (!isSupportedMimeType(mimeType)) {
      throw new BadRequestException('Tipo de arquivo não suportado.');
    }
  }

  /**
   * Gera a storage key no formato: workspaceId/mediaId/originalName
   */
  private buildStorageKey(workspaceId: string, mediaId: string, originalName: string): string {
    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `${workspaceId}/${mediaId}/${safeName}`;
  }

  /**
   * Valida o tamanho do arquivo de acordo com o tipo.
   */
  private validateFileSize(mimeType: string, fileSize: number): void {
    const isImage = (ALLOWED_IMAGE_TYPES as readonly string[]).includes(mimeType.toLowerCase());
    const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;

    if (fileSize > maxSize) {
      const maxMb = Math.round(maxSize / (1024 * 1024));
      throw new BadRequestException(
        `O arquivo excede o tamanho máximo de ${maxMb} MB para este tipo.`,
      );
    }
  }

  /**
   * Step 1: Cria registro PENDING + retorna presigned PUT URL.
   */
  async requestUploadUrl(workspaceId: string, dto: RequestUploadUrlDto) {
    this.validateMimeType(dto.mimeType);
    this.validateFileSize(dto.mimeType, dto.fileSize);

    const mediaType = this.resolveMediaType(dto.mimeType);

    // Criar registro no banco com status PENDING
    const media = await this.db.media.create({
      data: {
        workspaceId,
        name: dto.name.trim(),
        originalName: dto.originalName.trim(),
        mimeType: dto.mimeType,
        mediaType,
        fileSize: dto.fileSize,
        durationMs: dto.durationMs ?? null,
        width: dto.width ?? null,
        height: dto.height ?? null,
        hash: dto.hash ?? null,
        storageKey: '', // será preenchido abaixo
        uploadStatus: 'PENDING',
      },
    });

    // Gerar storage key com o ID real
    const storageKey = this.buildStorageKey(workspaceId, media.id, dto.originalName);

    // Atualizar o registro com a key
    await this.db.media.update({
      where: { id: media.id },
      data: { storageKey },
    });

    // Gerar URL presignada para upload direto
    const uploadUrl = await this.storage.presignedPutUrl(
      storageKey,
      dto.mimeType,
      PRESIGNED_PUT_EXPIRY_SEC,
    );

    return {
      success: true,
      data: {
        mediaId: media.id,
        uploadUrl,
        storageKey,
        expiresInSec: PRESIGNED_PUT_EXPIRY_SEC,
      },
    };
  }

  /**
   * Step 2: Confirma upload verificando existência no storage.
   */
  async confirmUpload(workspaceId: string, mediaId: string) {
    const media = await this.db.media.findFirst({
      where: { id: mediaId, workspaceId },
    });

    if (!media) {
      throw new NotFoundException('Mídia não encontrada.');
    }

    if (media.uploadStatus === 'READY') {
      return {
        success: true,
        data: this.mapMediaResponse(media),
      };
    }

    if (media.uploadStatus !== 'PENDING') {
      throw new BadRequestException('Esta mídia não está aguardando confirmação.');
    }

    // Verificar se o arquivo existe no storage
    const fileExists = await this.storage.exists(media.storageKey);

    if (!fileExists) {
      throw new BadRequestException('O arquivo ainda não foi enviado ao storage.');
    }

    // Atualizar status para READY
    const updated = await this.db.media.update({
      where: { id: mediaId },
      data: { uploadStatus: 'READY' },
    });

    // Fire-and-forget: enqueue HLS transcode for video files
    if (updated.mediaType === 'VIDEO') {
      this.logger.log(`[Media] Enqueuing HLS transcode for video ${mediaId}`);
      void this.transcodeService.processTranscodeJob({
        workspaceId,
        mediaId,
        storageKey: updated.storageKey,
      }).catch((err) => {
        this.logger.error(
          `[Media] Transcode enqueue failed for ${mediaId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    }

    return {
      success: true,
      data: this.mapMediaResponse(updated),
    };
  }

  /**
   * Lista mídias READY do workspace (com url temporária).
   */
  async findAll(workspaceId: string) {
    const media = await this.db.media.findMany({
      where: {
        workspaceId,
        uploadStatus: 'READY',
      },
      orderBy: { createdAt: 'desc' },
    });

    // Gerar URLs presignadas para cada mídia
    const data = await Promise.all(
      media.map(async (m) => {
        const url = await this.storage.presignedGetUrl(m.storageKey, PRESIGNED_GET_EXPIRY_SEC);
        return {
          ...this.mapMediaResponse(m),
          url,
        };
      }),
    );

    return { success: true, data };
  }

  /**
   * Retorna detalhe de uma mídia.
   */
  async findOne(workspaceId: string, mediaId: string) {
    const media = await this.db.media.findFirst({
      where: { id: mediaId, workspaceId, uploadStatus: 'READY' },
    });

    if (!media) {
      throw new NotFoundException('Mídia não encontrada.');
    }

    const url = await this.storage.presignedGetUrl(media.storageKey, PRESIGNED_GET_EXPIRY_SEC);

    return {
      success: true,
      data: {
        ...this.mapMediaResponse(media),
        url,
      },
    };
  }

  /**
   * Renomeia uma mídia.
   */
  async rename(workspaceId: string, mediaId: string, name: string) {
    const media = await this.db.media.findFirst({
      where: { id: mediaId, workspaceId },
    });

    if (!media) {
      throw new NotFoundException('Mídia não encontrada.');
    }

    const updated = await this.db.media.update({
      where: { id: mediaId },
      data: { name: name.trim() },
    });

    return {
      success: true,
      data: this.mapMediaResponse(updated),
    };
  }

  /**
   * Remove mídia do DB e storage.
   */
  async remove(workspaceId: string, mediaId: string) {
    const media = await this.db.media.findFirst({
      where: { id: mediaId, workspaceId },
    });

    if (!media) {
      throw new NotFoundException('Mídia não encontrada.');
    }

    // Deletar do storage (ignora erros — pode já não existir)
    try {
      await this.storage.delete(media.storageKey);
      if (media.thumbnailKey) {
        await this.storage.delete(media.thumbnailKey);
      }
    } catch {
      // Silencioso: o importante é remover do DB
    }

    await this.db.media.delete({ where: { id: mediaId } });

    return { success: true, data: { id: mediaId } };
  }

  /**
   * Mapeia registro do Prisma para response.
   */
  private mapMediaResponse(media: {
    id: string;
    name: string;
    originalName: string;
    mimeType: string;
    mediaType: string;
    fileSize: number;
    durationMs: number | null;
    width: number | null;
    height: number | null;
    hash: string | null;
    uploadStatus: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: media.id,
      name: media.name,
      originalName: media.originalName,
      mimeType: media.mimeType,
      mediaType: media.mediaType,
      fileSize: media.fileSize,
      durationMs: media.durationMs,
      width: media.width,
      height: media.height,
      hash: media.hash,
      uploadStatus: media.uploadStatus,
      createdAt: media.createdAt,
      updatedAt: media.updatedAt,
    };
  }
}
