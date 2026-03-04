/**
 * HLS Transcoding pipeline constants.
 *
 * These define the ladder of adaptive-bitrate renditions the
 * platform will generate when a video is uploaded.
 *
 * The pipeline is designed to run asynchronously (queue-based)
 * after the upload is confirmed, so it does not block the admin UI.
 */

export interface HlsRendition {
  /** Human-readable label */
  label: string;
  /** Output width in pixels (height is proportional) */
  width: number;
  /** Target video bitrate in kbps */
  videoBitrateKbps: number;
  /** Max video bitrate in kbps (VBV cap) */
  maxVideoBitrateKbps: number;
  /** Buffer size = 1.5× target (VBV) */
  bufSizeKbps: number;
}

export const HLS_RENDITIONS: HlsRendition[] = [
  {
    label: '240p',
    width: 426,
    videoBitrateKbps: 500,
    maxVideoBitrateKbps: 535,
    bufSizeKbps: 750,
  },
  {
    label: '360p',
    width: 640,
    videoBitrateKbps: 800,
    maxVideoBitrateKbps: 856,
    bufSizeKbps: 1200,
  },
  {
    label: '480p',
    width: 854,
    videoBitrateKbps: 1500,
    maxVideoBitrateKbps: 1605,
    bufSizeKbps: 2250,
  },
  {
    label: '720p',
    width: 1280,
    videoBitrateKbps: 2800,
    maxVideoBitrateKbps: 2996,
    bufSizeKbps: 4200,
  },
  {
    label: '1080p',
    width: 1920,
    videoBitrateKbps: 5000,
    maxVideoBitrateKbps: 5350,
    bufSizeKbps: 7500,
  },
];

/** Audio configuration shared across all renditions */
export const HLS_AUDIO = {
  codec: 'aac',
  bitrateKbps: 128,
  sampleRate: 48000,
} as const;

/** GOP / keyframe interval */
export const HLS_KEYFRAME_INTERVAL_SEC = 2;

/** HLS segment duration in seconds */
export const HLS_SEGMENT_DURATION_SEC = 4;

/** Directory name for HLS output in storage: {workspaceId}/{mediaId}/hls/ */
export const HLS_OUTPUT_PREFIX = 'hls';

/** Status values for the transcoding pipeline */
export type TranscodeStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
