import { getSessionToken } from '@/lib/auth/session';

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

// ─── Types ─────────────────────────────────────────────────────────

export type Location = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
  deviceCount: number;
  createdAt: string;
};

export type CreateLocationPayload = {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
};

// ─── API ───────────────────────────────────────────────────────────

export const locationsApi = {
  list: () => authenticatedRequest<Location[]>('/locations', 'GET'),
  create: (payload: CreateLocationPayload) =>
    authenticatedRequest<Location>('/locations', 'POST', payload as Record<string, unknown>),
};
