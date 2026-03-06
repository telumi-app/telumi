export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export const ALLOWED_VIDEO_EXTENSIONS = [
  'mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv', 'wmv', 'flv', 'mpeg', 'mpg', '3gp',
] as const;

export const ACCEPT_STRING = `${ALLOWED_IMAGE_MIME_TYPES.join(',')},video/*,${ALLOWED_VIDEO_EXTENSIONS.map((ext) => `.${ext}`).join(',')}`;

export const MAX_IMAGE_SIZE = 50 * 1024 * 1024;
export const MAX_VIDEO_SIZE = 500 * 1024 * 1024;

export function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

export function isVideoMimeType(mimeType: string): boolean {
  return mimeType.startsWith('video/');
}

export function getFileExtension(fileName: string): string {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? '';
}

export function normalizeMediaMimeType(file: Pick<File, 'type' | 'name'>): string {
  if (file.type) return file.type.toLowerCase();

  const ext = getFileExtension(file.name);
  const byExtension: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    m4v: 'video/x-m4v',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',
    wmv: 'video/x-ms-wmv',
    flv: 'video/x-flv',
    mpeg: 'video/mpeg',
    mpg: 'video/mpeg',
    '3gp': 'video/3gpp',
  };

  return byExtension[ext] ?? '';
}

export function validateMediaUploadFile(file: Pick<File, 'type' | 'name' | 'size'>): {
  mimeType: string;
  error: string | null;
} {
  const mimeType = normalizeMediaMimeType(file);
  const ext = getFileExtension(file.name);
  const isSupportedImage = ALLOWED_IMAGE_MIME_TYPES.includes(mimeType as typeof ALLOWED_IMAGE_MIME_TYPES[number]);
  const isSupportedVideo = isVideoMimeType(mimeType);
  const isSupportedByExt = ALLOWED_VIDEO_EXTENSIONS.includes(ext as typeof ALLOWED_VIDEO_EXTENSIONS[number]);

  if (!isSupportedImage && !isSupportedVideo && !isSupportedByExt) {
    return {
      mimeType,
      error: `Tipo "${mimeType || file.type || 'desconhecido'}" não suportado.`,
    };
  }

  const maxSize = isImageMimeType(mimeType) ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
  if (file.size > maxSize) {
    const maxMb = Math.round(maxSize / (1024 * 1024));
    return {
      mimeType,
      error: `Arquivo excede ${maxMb} MB.`,
    };
  }

  return { mimeType, error: null };
}
