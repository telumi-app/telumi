import { getSessionToken } from '@/lib/auth/session';

// ─── Types ─────────────────────────────────────────────────────────

export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'FINISHED' | 'CANCELLED';

export type CampaignAssetMedia = {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  mediaType: 'IMAGE' | 'VIDEO';
  fileSize: number;
  durationMs: number | null;
  width: number | null;
  height: number | null;
};

export type CampaignAsset = {
  id: string;
  mediaId: string;
  position: number;
  durationMs: number;
  media?: CampaignAssetMedia;
};

export type Campaign = {
  id: string;
  name: string;
  objective: string | null;
  description: string | null;
  status: CampaignStatus;
  startDate: string | null;
  endDate: string | null;
  assetCount: number;
  scheduleCount: number;
  activeTargetCount: number;
  createdAt: string;
  updatedAt: string;
  assets?: CampaignAsset[];
};

export type CreateCampaignPayload = {
  name: string;
  objective?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  assets?: { mediaId: string; position: number; durationMs?: number }[];
};

export type UpdateCampaignPayload = {
  name?: string;
  objective?: string;
  description?: string;
  status?: CampaignStatus;
  startDate?: string;
  endDate?: string;
  assets?: { mediaId: string; position: number; durationMs?: number }[];
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

// ─── API ───────────────────────────────────────────────────────────

export const campaignsApi = {
  list: () => authenticatedRequest<Campaign[]>('/campaigns', 'GET'),

  get: (id: string) => authenticatedRequest<Campaign>(`/campaigns/${id}`, 'GET'),

  create: (payload: CreateCampaignPayload) =>
    authenticatedRequest<Campaign>(
      '/campaigns',
      'POST',
      payload as unknown as Record<string, unknown>,
    ),

  update: (id: string, payload: UpdateCampaignPayload) =>
    authenticatedRequest<Campaign>(
      `/campaigns/${id}`,
      'PATCH',
      payload as unknown as Record<string, unknown>,
    ),

  remove: (id: string) => authenticatedRequest(`/campaigns/${id}`, 'DELETE'),
};
