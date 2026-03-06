type VideoPlaybackCandidate = {
  mediaType: string;
  mimeType: string;
  uploadStatus?: string;
  hlsStatus?: string | null;
};

const SAFE_DIRECT_VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/webm',
]);

export function isSafeDirectVideoMimeType(mimeType: string): boolean {
  return SAFE_DIRECT_VIDEO_MIME_TYPES.has(mimeType.toLowerCase());
}

export function canUseDirectPlaybackSource(media: VideoPlaybackCandidate): boolean {
  return media.mediaType === 'VIDEO'
    && media.uploadStatus === 'READY'
    && isSafeDirectVideoMimeType(media.mimeType);
}

export function hasPlayableVideoVariant(media: VideoPlaybackCandidate): boolean {
  return canUseDirectPlaybackSource(media) || media.hlsStatus === 'READY';
}

export function requiresVideoNormalization(media: Pick<VideoPlaybackCandidate, 'mediaType' | 'mimeType'>): boolean {
  return media.mediaType === 'VIDEO' && !isSafeDirectVideoMimeType(media.mimeType);
}
