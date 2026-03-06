import { Inject, Injectable, Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import { createReadStream, createWriteStream } from 'fs';
import { mkdir, readdir, rm, stat } from 'fs/promises';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { promisify } from 'util';

import { DatabaseService } from '@/modules/database';
import { STORAGE_PROVIDER, StorageProvider } from '@/media/storage/storage.interface';
import { canUseDirectPlaybackSource } from '@/media/playback-policy';

import {
  HLS_RENDITIONS,
  HLS_AUDIO,
  HLS_KEYFRAME_INTERVAL_SEC,
  HLS_SEGMENT_DURATION_SEC,
  HLS_OUTPUT_PREFIX,
  type TranscodeStatus,
} from './transcode.constants';

const execFileAsync = promisify(execFile);

type InputCapabilities = {
  hasAudio: boolean;
  width: number | null;
  height: number | null;
};

/** Mime-type lookup for HLS output files */
function hlsContentType(filename: string): string {
  if (filename.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl';
  if (filename.endsWith('.ts')) return 'video/mp2t';
  return 'application/octet-stream';
}

function toEven(value: number): number {
  return Math.max(2, Math.floor(value / 2) * 2);
}

/**
 * Service responsible for generating HLS multi-bitrate output
 * from uploaded video files.
 *
 * Architecture:
 *   1. After `confirmUpload`, the media service enqueues a transcode job.
 *   2. This service picks up the job, downloads the source from storage,
 *      runs FFmpeg locally, and uploads the resulting segments + playlists
 *      back to storage.
 *   3. The media record is updated with `hlsStatus = 'READY'` and the
 *      `hlsManifestKey` pointing to the master.m3u8.
 *
 * For v1: this runs in-process (fire-and-forget after confirmUpload).
 * For scale: move to a BullMQ worker.
 */
@Injectable()
export class TranscodeService {
  private readonly logger = new Logger(TranscodeService.name);

  constructor(
    private readonly db: DatabaseService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  // ── Public API ──────────────────────────────────────────────────

  /**
   * Entry point: download source → transcode → upload segments → update DB.
   *
   * Designed to run fire-and-forget (does NOT throw to caller on failure).
   * All errors are caught, logged, and reflected in `hlsStatus = 'FAILED'`.
   */
  async processTranscodeJob(params: {
    workspaceId: string;
    mediaId: string;
    storageKey: string;
    fps?: number;
  }): Promise<TranscodeStatus> {
    const { workspaceId, mediaId, storageKey } = params;
    const fps = params.fps ?? 30;

    const tmpDir = join('/tmp', `telumi-transcode-${mediaId}`);
    const inputPath = join(tmpDir, 'source');
    const outputDir = join(tmpDir, 'hls');

    try {
      // 1. Mark as PROCESSING
      await this.db.media.update({
        where: { id: mediaId },
        data: { hlsStatus: 'PROCESSING' },
      });

      this.logger.log(`[Transcode] Starting job for media ${mediaId}`);

      // 2. Prepare temp directories
      await mkdir(tmpDir, { recursive: true });
      await mkdir(outputDir, { recursive: true });

      // Create subdirectories for each rendition
      for (let i = 0; i < HLS_RENDITIONS.length; i++) {
        await mkdir(join(outputDir, `v${i}`), { recursive: true });
      }

      // 3. Download source from storage
      this.logger.log(`[Transcode] Downloading source: ${storageKey}`);
      const sourceStream = await this.storage.getObject(storageKey);
      const writeStream = createWriteStream(inputPath);
      await pipeline(sourceStream, writeStream);

      const sourceStats = await stat(inputPath);
      this.logger.log(
        `[Transcode] Source downloaded: ${(sourceStats.size / 1024 / 1024).toFixed(1)} MB`,
      );

      const inputCapabilities = await this.probeInputCapabilities(inputPath);
      this.logger.log(
        `[Transcode] Input capabilities for ${mediaId}: hasAudio=${inputCapabilities.hasAudio}, width=${inputCapabilities.width ?? 'unknown'}, height=${inputCapabilities.height ?? 'unknown'}`,
      );

      // 4. Run FFmpeg
      const args = this.buildFfmpegArgs({
        inputPath,
        outputDir,
        fps,
        hasAudio: inputCapabilities.hasAudio,
        sourceWidth: inputCapabilities.width,
        sourceHeight: inputCapabilities.height,
      });
      this.logger.log(`[Transcode] Running FFmpeg with ${HLS_RENDITIONS.length} renditions`);

      const { stderr } = await execFileAsync('ffmpeg', args, {
        timeout: 10 * 60 * 1000, // 10 min timeout
        maxBuffer: 10 * 1024 * 1024, // 10 MB stderr buffer
      });

      if (stderr) {
        this.logger.debug(
          `[Transcode] FFmpeg stderr (last 500 chars): ${stderr.slice(-500)}`,
        );
      }

      // 5. Upload all output files to storage
      const hlsPrefix = this.hlsKeyPrefix(workspaceId, mediaId);
      await this.uploadOutputDirectory(outputDir, hlsPrefix);

      // 6. Update DB with READY status
      const manifestKey = this.hlsManifestKey(workspaceId, mediaId);
      await this.db.media.update({
        where: { id: mediaId },
        data: {
          hlsStatus: 'READY',
          hlsManifestKey: manifestKey,
        },
      });

      this.logger.log(`[Transcode] ✓ Completed for media ${mediaId}`);
      return 'READY';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[Transcode] ✗ Failed for media ${mediaId}: ${message}`);

      if (error && typeof error === 'object' && 'stderr' in error) {
        const stderr = typeof error.stderr === 'string' ? error.stderr : null;
        if (stderr) {
          this.logger.error(`[Transcode] FFmpeg stderr (last 1200 chars): ${stderr.slice(-1200)}`);
        }
      }

      try {
        await this.db.media.update({
          where: { id: mediaId },
          data: { hlsStatus: 'FAILED' },
        });
      } catch {
        this.logger.error(`[Transcode] Could not mark media ${mediaId} as FAILED`);
      }

      return 'FAILED';
    } finally {
      // 7. Cleanup temp files
      try {
        await rm(tmpDir, { recursive: true, force: true });
      } catch {
        // Cleanup is best-effort
      }
    }
  }

  /**
   * Determine transcoding status from media record.
   * Used by the manifest builder to decide whether to serve
   * the HLS manifest or fall back to direct mp4 URL.
   */
  resolvePlaybackUrl(media: {
    mediaType: string;
    mimeType: string;
    hlsStatus: string | null;
    hlsManifestKey: string | null;
    uploadStatus: string;
    storageKey: string;
  }): { type: 'hls' | 'direct'; key: string } | null {
    if (media.hlsStatus === 'READY' && media.hlsManifestKey) {
      return { type: 'hls', key: media.hlsManifestKey };
    }
    if (media.mediaType !== 'VIDEO' || canUseDirectPlaybackSource(media)) {
      return { type: 'direct', key: media.storageKey };
    }
    return null;
  }

  // ── FFmpeg args builder ──────────────────────────────────────────

  /**
   * Build the FFmpeg CLI arguments for HLS ABR transcoding.
   */
  buildFfmpegArgs(input: {
    inputPath: string;
    outputDir: string;
    fps: number;
    hasAudio: boolean;
    sourceWidth: number | null;
    sourceHeight: number | null;
  }): string[] {
    const {
      inputPath,
      outputDir,
      fps,
      hasAudio,
      sourceWidth,
      sourceHeight,
    } = input;
    const gopSize = Math.round(fps * HLS_KEYFRAME_INTERVAL_SEC);

    const splitCount = HLS_RENDITIONS.length;
    const splitOutputs = HLS_RENDITIONS.map((_, i) => `[v${i}]`).join('');
    const filterParts = [
      `[0:v]split=${splitCount}${splitOutputs}`,
    ];

    const maps: string[] = [];
    const codecArgs: string[] = [];
    const audioMaps: string[] = [];
    const audioCodecArgs: string[] = [];

    HLS_RENDITIONS.forEach((r, i) => {
      const targetDimensions = sourceWidth !== null && sourceHeight !== null
        ? this.resolveTargetDimensions(sourceWidth, sourceHeight, r.width)
        : { width: r.width, height: -2 };

      filterParts.push(
        `[v${i}]scale=w=${targetDimensions.width}:h=${targetDimensions.height}[v${i}out]`,
      );
      maps.push('-map', `[v${i}out]`);
      codecArgs.push(
        `-c:v:${i}`, 'libx264',
        `-b:v:${i}`, `${r.videoBitrateKbps}k`,
        `-maxrate:v:${i}`, `${r.maxVideoBitrateKbps}k`,
        `-bufsize:v:${i}`, `${r.bufSizeKbps}k`,
        '-preset', 'fast',
        `-profile:v:${i}`, 'main',
      );

      if (hasAudio) {
        audioMaps.push('-map', '0:a:0?');
        audioCodecArgs.push(
          `-c:a:${i}`, HLS_AUDIO.codec,
          `-b:a:${i}`, `${HLS_AUDIO.bitrateKbps}k`,
          `-ar:a:${i}`, `${HLS_AUDIO.sampleRate}`,
        );
      }
    });

    const audioArgs = hasAudio ? [...audioMaps, ...audioCodecArgs] : [];

    const varStreamMap = HLS_RENDITIONS
      .map((_, i) => (hasAudio ? `v:${i},a:${i}` : `v:${i}`))
      .join(' ');

    return [
      '-y',
      '-hide_banner',
      '-loglevel', 'error',
      '-i', inputPath,
      '-filter_complex', filterParts.join('; '),
      ...maps,
      ...codecArgs,
      ...audioArgs,
      '-g', `${gopSize}`,
      '-keyint_min', `${gopSize}`,
      '-sc_threshold', '0',
      '-pix_fmt', 'yuv420p',
      '-sws_flags', 'lanczos',
      '-f', 'hls',
      '-hls_time', `${HLS_SEGMENT_DURATION_SEC}`,
      '-hls_playlist_type', 'vod',
      '-hls_flags', 'independent_segments',
      '-master_pl_name', 'master.m3u8',
      '-hls_segment_filename', `${outputDir}/v%v/seg_%06d.ts`,
      '-var_stream_map', varStreamMap,
      `${outputDir}/v%v/prog.m3u8`,
    ];
  }

  private resolveTargetDimensions(
    sourceWidth: number,
    sourceHeight: number,
    targetLongEdge: number,
  ): { width: number; height: number } {
    const isPortrait = sourceHeight > sourceWidth;
    const maxWidth = isPortrait ? sourceWidth : targetLongEdge;
    const maxHeight = isPortrait ? targetLongEdge : sourceHeight;
    const scaleFactor = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight, 1);

    return {
      width: toEven(sourceWidth * scaleFactor),
      height: toEven(sourceHeight * scaleFactor),
    };
  }

  private async probeInputCapabilities(inputPath: string): Promise<InputCapabilities> {
    try {
      const { stdout } = await execFileAsync(
        'ffprobe',
        [
          '-v', 'error',
          '-show_entries', 'stream=codec_type,width,height',
          '-of', 'json',
          inputPath,
        ],
        {
          timeout: 30 * 1000,
          maxBuffer: 1024 * 1024,
        },
      );

      const parsed = JSON.parse(stdout) as {
        streams?: Array<{
          codec_type?: string;
          width?: number;
          height?: number;
        }>;
      };
      const videoStream = parsed.streams?.find((stream) => stream.codec_type === 'video');
      const hasAudio = parsed.streams?.some((stream) => stream.codec_type === 'audio') ?? false;

      return {
        hasAudio,
        width: videoStream?.width ?? null,
        height: videoStream?.height ?? null,
      };
    } catch (error) {
      this.logger.warn(
        `[Transcode] Could not probe input capabilities, falling back to audio-enabled pipeline: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        hasAudio: true,
        width: null,
        height: null,
      };
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────

  hlsKeyPrefix(workspaceId: string, mediaId: string): string {
    return `${workspaceId}/${mediaId}/${HLS_OUTPUT_PREFIX}`;
  }

  hlsManifestKey(workspaceId: string, mediaId: string): string {
    return `${this.hlsKeyPrefix(workspaceId, mediaId)}/master.m3u8`;
  }

  /**
   * Recursively upload all files from outputDir to storage under the
   * given prefix, preserving relative directory structure.
   */
  private async uploadOutputDirectory(
    localDir: string,
    storagePrefix: string,
  ): Promise<void> {
    const entries = await readdir(localDir, { withFileTypes: true });
    let uploadedCount = 0;

    for (const entry of entries) {
      const localPath = join(localDir, entry.name);

      if (entry.isDirectory()) {
        await this.uploadOutputDirectory(localPath, `${storagePrefix}/${entry.name}`);
      } else {
        const storageKey = `${storagePrefix}/${entry.name}`;
        const contentType = hlsContentType(entry.name);
        const stream = createReadStream(localPath);

        await this.storage.putObject(storageKey, stream, contentType);
        uploadedCount++;
      }
    }

    if (uploadedCount > 0) {
      this.logger.debug(`[Transcode] Uploaded ${uploadedCount} files to ${storagePrefix}/`);
    }
  }
}
