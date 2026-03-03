import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { DatabaseService } from '@/modules/database';
import { PRESIGNED_GET_EXPIRY_SEC } from '@/media/constants';
import { STORAGE_PROVIDER, StorageProvider } from '@/media/storage/storage.interface';

import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';

const DEFAULT_ITEM_DURATION_MS = 15000; // 15 seconds (1 slot)

@Injectable()
export class PlaylistsService {
  constructor(
    private readonly db: DatabaseService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  /**
   * Calcula duração total e conta itens.
   */
  private computeAggregates(items: { durationMs: number }[]) {
    return {
      totalDurationMs: items.reduce((sum, item) => sum + item.durationMs, 0),
      itemCount: items.length,
    };
  }

  /**
   * Mapeia a resposta da playlist com itens.
   */
  private async mapPlaylistResponse(
    playlist: {
    id: string;
    name: string;
    description: string | null;
    totalDurationMs: number;
    itemCount: number;
    createdAt: Date;
    updatedAt: Date;
    items?: {
      id: string;
      mediaId: string;
      position: number;
      durationMs: number;
      media?: {
        id: string;
        name: string;
        originalName: string;
        mimeType: string;
        mediaType: string;
        fileSize: number;
        durationMs: number | null;
        width: number | null;
        height: number | null;
        storageKey: string;
      };
    }[];
    },
    includeMediaUrls = false,
  ) {
    const items = await Promise.all(
      (playlist.items ?? []).map(async (item) => {
        if (!item.media) {
          return {
            id: item.id,
            mediaId: item.mediaId,
            position: item.position,
            durationMs: item.durationMs,
            media: undefined,
          };
        }

        let url: string | undefined;
        if (includeMediaUrls) {
          try {
            url = await this.storage.presignedGetUrl(
              item.media.storageKey,
              PRESIGNED_GET_EXPIRY_SEC,
            );
          } catch {
            url = undefined;
          }
        }

        return {
          id: item.id,
          mediaId: item.mediaId,
          position: item.position,
          durationMs: item.durationMs,
          media: {
            id: item.media.id,
            name: item.media.name,
            originalName: item.media.originalName,
            mimeType: item.media.mimeType,
            mediaType: item.media.mediaType,
            fileSize: item.media.fileSize,
            durationMs: item.media.durationMs,
            width: item.media.width,
            height: item.media.height,
            url,
          },
        };
      }),
    );

    return {
      id: playlist.id,
      name: playlist.name,
      description: playlist.description,
      totalDurationMs: playlist.totalDurationMs,
      itemCount: playlist.itemCount,
      createdAt: playlist.createdAt,
      updatedAt: playlist.updatedAt,
      items,
    };
  }

  /**
   * Lista todas as playlists do workspace.
   */
  async findAll(workspaceId: string) {
    const playlists = await this.db.playlist.findMany({
      where: { workspaceId },
      include: {
        items: {
          orderBy: { position: 'asc' },
          include: {
            media: {
              select: {
                id: true,
                name: true,
                originalName: true,
                mimeType: true,
                mediaType: true,
                fileSize: true,
                durationMs: true,
                width: true,
                height: true,
                storageKey: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: await Promise.all(playlists.map((p) => this.mapPlaylistResponse(p))),
    };
  }

  /**
   * Retorna detalhe de uma playlist.
   */
  async findOne(workspaceId: string, playlistId: string) {
    const playlist = await this.db.playlist.findFirst({
      where: { id: playlistId, workspaceId },
      include: {
        items: {
          orderBy: { position: 'asc' },
          include: {
            media: {
              select: {
                id: true,
                name: true,
                originalName: true,
                mimeType: true,
                mediaType: true,
                fileSize: true,
                durationMs: true,
                width: true,
                height: true,
                storageKey: true,
              },
            },
          },
        },
      },
    });

    if (!playlist) {
      throw new NotFoundException('Playlist não encontrada.');
    }

    return {
      success: true,
      data: await this.mapPlaylistResponse(playlist, true),
    };
  }

  /**
   * Cria uma nova playlist (opcionalmente com itens).
   */
  async create(workspaceId: string, dto: CreatePlaylistDto) {
    // Verificar unicidade de nome no workspace
    const nameExists = await this.db.playlist.findUnique({
      where: { workspaceId_name: { workspaceId, name: dto.name.trim() } },
    });

    if (nameExists) {
      throw new ConflictException('Já existe uma playlist com esse nome.');
    }

    const items = dto.items ?? [];
    const aggregates = this.computeAggregates(
      items.map((i) => ({ durationMs: i.durationMs ?? DEFAULT_ITEM_DURATION_MS })),
    );

    // Validar que todas as mídias existem e pertencem ao workspace
    if (items.length > 0) {
      const mediaIds = [...new Set(items.map((i) => i.mediaId))];
      const existingMedia = await this.db.media.findMany({
        where: { id: { in: mediaIds }, workspaceId, uploadStatus: 'READY' },
        select: { id: true },
      });

      const existingIds = new Set(existingMedia.map((m) => m.id));
      const missing = mediaIds.filter((id) => !existingIds.has(id));

      if (missing.length > 0) {
        throw new NotFoundException(
          `Mídias não encontradas ou não estão prontas: ${missing.join(', ')}`,
        );
      }
    }

    const playlist = await this.db.playlist.create({
      data: {
        workspaceId,
        name: dto.name.trim(),
        description: dto.description?.trim() ?? null,
        totalDurationMs: aggregates.totalDurationMs,
        itemCount: aggregates.itemCount,
        items:
          items.length > 0
            ? {
                create: items.map((item) => ({
                  mediaId: item.mediaId,
                  position: item.position,
                  durationMs: item.durationMs ?? DEFAULT_ITEM_DURATION_MS,
                })),
              }
            : undefined,
      },
      include: {
        items: {
          orderBy: { position: 'asc' },
          include: {
            media: {
              select: {
                id: true,
                name: true,
                originalName: true,
                mimeType: true,
                mediaType: true,
                fileSize: true,
                durationMs: true,
                width: true,
                height: true,
                storageKey: true,
              },
            },
          },
        },
      },
    });

    return {
      success: true,
      data: await this.mapPlaylistResponse(playlist, true),
    };
  }

  /**
   * Atualiza uma playlist (nome, descrição e/ou itens).
   * Se `items` é fornecido, faz replace completo (delete all + create).
   */
  async update(workspaceId: string, playlistId: string, dto: UpdatePlaylistDto) {
    const playlist = await this.db.playlist.findFirst({
      where: { id: playlistId, workspaceId },
    });

    if (!playlist) {
      throw new NotFoundException('Playlist não encontrada.');
    }

    // Verificar unicidade de nome (se mudando)
    if (dto.name && dto.name.trim() !== playlist.name) {
      const nameExists = await this.db.playlist.findUnique({
        where: { workspaceId_name: { workspaceId, name: dto.name.trim() } },
      });

      if (nameExists) {
        throw new ConflictException('Já existe uma playlist com esse nome.');
      }
    }

    // Validar mídias se itens fornecidos
    if (dto.items && dto.items.length > 0) {
      const mediaIds = [...new Set(dto.items.map((i) => i.mediaId))];
      const existingMedia = await this.db.media.findMany({
        where: { id: { in: mediaIds }, workspaceId, uploadStatus: 'READY' },
        select: { id: true },
      });

      const existingIds = new Set(existingMedia.map((m) => m.id));
      const missing = mediaIds.filter((id) => !existingIds.has(id));

      if (missing.length > 0) {
        throw new NotFoundException(
          `Mídias não encontradas ou não estão prontas: ${missing.join(', ')}`,
        );
      }
    }

    // Transação: atualizar playlist + replace itens se fornecidos
    const updated = await this.db.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = {};

      if (dto.name !== undefined) updateData.name = dto.name.trim();
      if (dto.description !== undefined) updateData.description = dto.description?.trim() ?? null;

      if (dto.items !== undefined) {
        // Delete existing items
        await tx.playlistItem.deleteMany({ where: { playlistId } });

        // Create new items
        if (dto.items.length > 0) {
          await tx.playlistItem.createMany({
            data: dto.items.map((item) => ({
              playlistId,
              mediaId: item.mediaId,
              position: item.position,
              durationMs: item.durationMs ?? DEFAULT_ITEM_DURATION_MS,
            })),
          });
        }

        // Recalculate aggregates
        const aggregates = this.computeAggregates(
          dto.items.map((i) => ({ durationMs: i.durationMs ?? DEFAULT_ITEM_DURATION_MS })),
        );
        updateData.totalDurationMs = aggregates.totalDurationMs;
        updateData.itemCount = aggregates.itemCount;
      }

      return tx.playlist.update({
        where: { id: playlistId },
        data: updateData,
        include: {
          items: {
            orderBy: { position: 'asc' },
            include: {
              media: {
                select: {
                  id: true,
                  name: true,
                  originalName: true,
                  mimeType: true,
                  mediaType: true,
                  fileSize: true,
                  durationMs: true,
                  width: true,
                  height: true,
                  storageKey: true,
                },
              },
            },
          },
        },
      });
    });

    return {
      success: true,
      data: await this.mapPlaylistResponse(updated, true),
    };
  }

  /**
   * Remove uma playlist.
   */
  async remove(workspaceId: string, playlistId: string) {
    const playlist = await this.db.playlist.findFirst({
      where: { id: playlistId, workspaceId },
    });

    if (!playlist) {
      throw new NotFoundException('Playlist não encontrada.');
    }

    await this.db.playlist.delete({ where: { id: playlistId } });

    return { success: true, data: { id: playlistId } };
  }
}
