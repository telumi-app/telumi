import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FastifyReply } from 'fastify';

import { DatabaseService } from '@/modules/database';
import { STORAGE_PROVIDER, StorageProvider } from '@/media/storage/storage.interface';

/**
 * Public (no auth) controller that serves HLS manifests and segments.
 *
 * Flow:
 *   1. Player receives a URL like `/v1/hls/{mediaId}/master.m3u8`
 *   2. This controller looks up the media, validates hlsStatus = READY
 *   3. For `.m3u8` files: rewrites internal URLs to point back to this
 *      controller, then serves the content directly.
 *   4. For `.ts` segments: issues a 302 redirect to a presigned GET URL.
 *
 * This avoids exposing presigned URLs in manifest files and keeps
 * the segment delivery transparent to HLS.js.
 */
@ApiTags('HLS')
@Controller('hls')
export class HlsController {
  constructor(
    private readonly db: DatabaseService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  /**
   * Serve the master manifest with rewritten URLs.
   */
  @Get(':mediaId/master.m3u8')
  @ApiOperation({ summary: 'Serve HLS master manifest' })
  async getMasterManifest(
    @Param('mediaId') mediaId: string,
    @Res() reply: FastifyReply,
  ) {
    const media = await this.db.media.findUnique({
      where: { id: mediaId },
      select: {
        hlsStatus: true,
        hlsManifestKey: true,
        workspaceId: true,
      },
    });

    if (!media || media.hlsStatus !== 'READY' || !media.hlsManifestKey) {
      throw new NotFoundException('HLS não disponível para esta mídia.');
    }

    const stream = await this.storage.getObject(media.hlsManifestKey);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    let content = Buffer.concat(chunks).toString('utf-8');

    // Rewrite relative paths (e.g. "v0/prog.m3u8") to point to our proxy
    // HLS master manifests reference variant playlists with relative paths
    content = content.replace(
      /^(v\d+\/prog\.m3u8)$/gm,
      `/v1/hls/${mediaId}/$1`,
    );

    void reply
      .header('Content-Type', 'application/vnd.apple.mpegurl')
      .header('Cache-Control', 'public, max-age=86400')
      .header('Access-Control-Allow-Origin', '*')
      .send(content);
  }

  /**
   * Serve variant playlist with rewritten segment URLs.
   */
  @Get(':mediaId/:variant/prog.m3u8')
  @ApiOperation({ summary: 'Serve HLS variant playlist' })
  async getVariantPlaylist(
    @Param('mediaId') mediaId: string,
    @Param('variant') variant: string,
    @Res() reply: FastifyReply,
  ) {
    // Validate variant format (v0, v1, v2, etc.)
    if (!/^v\d+$/.test(variant)) {
      throw new NotFoundException('Variante HLS inválida.');
    }

    const media = await this.db.media.findUnique({
      where: { id: mediaId },
      select: {
        hlsStatus: true,
        hlsManifestKey: true,
        workspaceId: true,
      },
    });

    if (!media || media.hlsStatus !== 'READY' || !media.hlsManifestKey) {
      throw new NotFoundException('HLS não disponível para esta mídia.');
    }

    // Build the storage key for this variant
    const hlsPrefix = media.hlsManifestKey.replace('/master.m3u8', '');
    const playlistKey = `${hlsPrefix}/${variant}/prog.m3u8`;

    const stream = await this.storage.getObject(playlistKey);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    let content = Buffer.concat(chunks).toString('utf-8');

    // Rewrite segment references (e.g. "seg_000001.ts") to our proxy
    content = content.replace(
      /^(seg_\d+\.ts)$/gm,
      `/v1/hls/${mediaId}/${variant}/$1`,
    );

    void reply
      .header('Content-Type', 'application/vnd.apple.mpegurl')
      .header('Cache-Control', 'public, max-age=86400')
      .header('Access-Control-Allow-Origin', '*')
      .send(content);
  }

  /**
   * Serve HLS segment via 302 redirect to presigned URL.
   * Segments are immutable once created, so we cache aggressively.
   */
  @Get(':mediaId/:variant/:segment')
  @ApiOperation({ summary: 'Redirect to HLS segment' })
  async getSegment(
    @Param('mediaId') mediaId: string,
    @Param('variant') variant: string,
    @Param('segment') segment: string,
    @Res() reply: FastifyReply,
  ) {
    // Validate segment format
    if (!/^v\d+$/.test(variant) || !/^seg_\d+\.ts$/.test(segment)) {
      throw new NotFoundException('Segmento HLS inválido.');
    }

    const media = await this.db.media.findUnique({
      where: { id: mediaId },
      select: {
        hlsStatus: true,
        hlsManifestKey: true,
      },
    });

    if (!media || media.hlsStatus !== 'READY' || !media.hlsManifestKey) {
      throw new NotFoundException('HLS não disponível para esta mídia.');
    }

    const hlsPrefix = media.hlsManifestKey.replace('/master.m3u8', '');
    const segmentKey = `${hlsPrefix}/${variant}/${segment}`;

    // Generate presigned GET URL with 1h expiry
    const url = await this.storage.presignedGetUrl(segmentKey, 3600);

    // 302 redirect — HLS.js follows redirects transparently
    void reply
      .header('Cache-Control', 'public, max-age=86400, immutable')
      .header('Access-Control-Allow-Origin', '*')
      .redirect(302, url);
  }
}
