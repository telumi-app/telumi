import { Injectable, Logger } from '@nestjs/common';

import {
  HLS_RENDITIONS,
  HLS_AUDIO,
  HLS_KEYFRAME_INTERVAL_SEC,
  HLS_SEGMENT_DURATION_SEC,
  HLS_OUTPUT_PREFIX,
  type TranscodeStatus,
} from './transcode.constants';

/**
 * Service responsible for generating HLS multi-bitrate output
 * from uploaded video files.
 *
 * Architecture:
 *   1. After `confirmUpload`, the media service enqueues a transcode job.
 *   2. This service picks up the job, downloads the source from storage,
 *      runs FFmpeg locally (or delegates to a worker), and uploads
 *      the resulting segments + playlists back to storage.
 *   3. The media record is updated with `hlsStatus = 'READY'` and the
 *      `hlsManifestKey` pointing to the master.m3u8.
 *
 * For v1: this runs in-process. For scale, move to a BullMQ worker.
 */
@Injectable()
export class TranscodeService {
  private readonly logger = new Logger(TranscodeService.name);

  /**
   * Build the FFmpeg CLI arguments for HLS ABR transcoding.
   *
   * This is a pure function that returns the arguments array.
   * Execution happens in `processTranscodeJob`.
   */
  buildFfmpegArgs(input: {
    inputPath: string;
    outputDir: string;
    fps: number;
  }): string[] {
    const { inputPath, outputDir, fps } = input;
    const gopSize = Math.round(fps * HLS_KEYFRAME_INTERVAL_SEC);

    // Build complex filter for multi-rendition output
    const splitCount = HLS_RENDITIONS.length;
    const splitOutputs = HLS_RENDITIONS.map((_, i) => `[v${i}]`).join('');
    const filterParts = [
      `[0:v]split=${splitCount}${splitOutputs}`,
    ];

    const maps: string[] = [];
    const codecArgs: string[] = [];

    HLS_RENDITIONS.forEach((r, i) => {
      filterParts.push(
        `[v${i}]scale=w=${r.width}:h=-2[v${i}out]`,
      );
      maps.push(`-map`, `[v${i}out]`);
      codecArgs.push(
        `-c:v:${i}`, 'libx264',
        `-b:v:${i}`, `${r.videoBitrateKbps}k`,
        `-maxrate:v:${i}`, `${r.maxVideoBitrateKbps}k`,
        `-bufsize:v:${i}`, `${r.bufSizeKbps}k`,
      );
    });

    // Audio: map once, applied to all variants
    const audioArgs = [
      '-map', 'a:0?',
      '-c:a', HLS_AUDIO.codec,
      '-b:a', `${HLS_AUDIO.bitrateKbps}k`,
      '-ar', `${HLS_AUDIO.sampleRate}`,
    ];

    // Var stream map for HLS muxer
    const varStreamMap = HLS_RENDITIONS
      .map((_, i) => `v:${i},a:0`)
      .join(' ');

    return [
      '-i', inputPath,
      '-filter_complex', filterParts.join('; '),
      ...maps,
      ...codecArgs,
      ...audioArgs,
      // Keyframe alignment
      '-g', `${gopSize}`,
      '-keyint_min', `${gopSize}`,
      '-sc_threshold', '0',
      // HLS muxer
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

  /**
   * Build the storage key prefix for HLS output.
   */
  hlsKeyPrefix(workspaceId: string, mediaId: string): string {
    return `${workspaceId}/${mediaId}/${HLS_OUTPUT_PREFIX}`;
  }

  /**
   * Master manifest storage key.
   */
  hlsManifestKey(workspaceId: string, mediaId: string): string {
    return `${this.hlsKeyPrefix(workspaceId, mediaId)}/master.m3u8`;
  }

  /**
   * Determine transcoding status from media record.
   * Used by the manifest builder to decide whether to serve
   * the HLS manifest or fall back to direct mp4 URL.
   */
  resolvePlaybackUrl(media: {
    hlsStatus: TranscodeStatus | null;
    hlsManifestKey: string | null;
    storageKey: string;
  }): { type: 'hls' | 'direct'; key: string } {
    if (media.hlsStatus === 'READY' && media.hlsManifestKey) {
      return { type: 'hls', key: media.hlsManifestKey };
    }
    // Fallback: serve original mp4 directly
    return { type: 'direct', key: media.storageKey };
  }

  /**
   * Placeholder for the actual FFmpeg execution.
   *
   * TODO: implement with child_process.spawn or BullMQ worker.
   * For now this logs the intent so the pipeline can be wired up
   * end-to-end without blocking the rest of the improvements.
   */
  async processTranscodeJob(params: {
    workspaceId: string;
    mediaId: string;
    storageKey: string;
    fps?: number;
  }): Promise<TranscodeStatus> {
    this.logger.log(
      `[Transcode] Queued job for media ${params.mediaId} ` +
      `(workspace: ${params.workspaceId})`,
    );

    const args = this.buildFfmpegArgs({
      inputPath: `/tmp/${params.mediaId}-source`,
      outputDir: `/tmp/${params.mediaId}-hls`,
      fps: params.fps ?? 30,
    });

    this.logger.debug(`[Transcode] FFmpeg args: ffmpeg ${args.join(' ')}`);

    // TODO: Execute FFmpeg, upload segments to storage, update DB
    // For now, return PENDING to signal the job was accepted
    return 'PENDING';
  }
}
