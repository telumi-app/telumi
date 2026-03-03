import { getSessionToken } from '@/lib/auth/session';

// ─── Types ─────────────────────────────────────────────────────────

export type MediaType = 'IMAGE' | 'VIDEO';
export type UploadStatus = 'PENDING' | 'READY' | 'FAILED';

export type Media = {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  mediaType: MediaType;
  fileSize: number;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  hash: string | null;
  uploadStatus: UploadStatus;
  url?: string;
  createdAt: string;
  updatedAt: string;
};

export type RequestUploadUrlPayload = {
  name: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  hash?: string;
  durationMs?: number;
  width?: number;
  height?: number;
};

export type UploadUrlResponse = {
  mediaId: string;
  uploadUrl: string;
  storageKey: string;
  expiresInSec: number;
};

// ─── Helpers ───────────────────────────────────────────────────────

type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  message?: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const NETWORK_ERROR_MESSAGE =
  'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.';

function isNetworkError(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    'message' in error &&
    (error.message === 'Failed to fetch' ||
      error.message === 'Network request failed' ||
      error.message.includes('ERR_CONNECTION_REFUSED'))
  );
}

async function authenticatedRequest<TData>(
  path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  payload?: Record<string, unknown>,
): Promise<ApiResponse<TData>> {
  const token = getSessionToken();

  if (!token) {
    throw new Error('Sessão inválida. Faça login novamente.');
  }

  let response: Response;

  try {
    const headers: HeadersInit = {
      Authorization: `Bearer ${token}`,
    };

    if (payload) {
      headers['Content-Type'] = 'application/json';
    }

    response = await fetch(`${API_BASE_URL}/v1${path}`, {
      method,
      headers,
      body: payload ? JSON.stringify(payload) : undefined,
    });
  } catch (error) {
    throw new Error(
      isNetworkError(error) ? NETWORK_ERROR_MESSAGE : 'Ocorreu um erro inesperado.',
    );
  }

  const result = (await response.json()) as ApiResponse<TData>;

  if (!response.ok || !result.success) {
    throw new Error(result.message ?? 'Não foi possível concluir a solicitação.');
  }

  return result;
}

// ─── Upload direto via presigned URL ─────────────────────────────

export type UploadProgressCallback = (percent: number) => void;

/**
 * Faz upload direto para o storage via URL presignada,
 * reportando progresso.
 */
export function uploadToPresignedUrl(
  url: string,
  file: File,
  contentType?: string,
  onProgress?: UploadProgressCallback,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload falhou com status ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Erro de rede durante o upload.'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload cancelado.'));
    });

    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', contentType || file.type || 'application/octet-stream');
    xhr.send(file);
  });
}

// ─── API ───────────────────────────────────────────────────────────

export const mediaApi = {
  /** Solicita URL presignada para upload */
  requestUploadUrl: (payload: RequestUploadUrlPayload) =>
    authenticatedRequest<UploadUrlResponse>(
      '/media/upload-url',
      'POST',
      payload as Record<string, unknown>,
    ),

  /** Confirma que o upload foi concluído */
  confirmUpload: (mediaId: string) =>
    authenticatedRequest<Media>(`/media/${mediaId}/confirm`, 'POST'),

  /** Lista mídias READY do workspace */
  list: () => authenticatedRequest<Media[]>('/media', 'GET'),

  /** Detalhe de uma mídia */
  get: (mediaId: string) =>
    authenticatedRequest<Media>(`/media/${mediaId}`, 'GET'),

  /** Renomeia uma mídia */
  rename: (mediaId: string, name: string) =>
    authenticatedRequest<Media>(
      `/media/${mediaId}`,
      'PATCH',
      { name } as Record<string, unknown>,
    ),

  /** Remove uma mídia */
  remove: (mediaId: string) =>
    authenticatedRequest(`/media/${mediaId}`, 'DELETE'),
};
