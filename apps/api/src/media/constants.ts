/** MIME types permitidos para upload */
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export function isSupportedMimeType(mimeType: string): boolean {
  if (!mimeType) return false;
  const normalized = mimeType.toLowerCase();
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(normalized) || normalized.startsWith('video/');
}

/** Limites de tamanho de arquivo (em bytes) */
export const MAX_IMAGE_SIZE = 50 * 1024 * 1024;   // 50 MB
export const MAX_VIDEO_SIZE = 500 * 1024 * 1024;   // 500 MB

/** Tempo de expiração da URL presignada (PUT) */
export const PRESIGNED_PUT_EXPIRY_SEC = 3600; // 1 hora

/** Tempo de expiração da URL presignada (GET) */
export const PRESIGNED_GET_EXPIRY_SEC = 3600; // 1 hora

/** Tempo máximo antes de considerar um upload PENDING como expirado */
export const PENDING_UPLOAD_EXPIRY_MS = 60 * 60 * 1000; // 1 hora
