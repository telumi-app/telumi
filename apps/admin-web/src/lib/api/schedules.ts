import { getSessionToken } from '@/lib/auth/session';

// ─── Types ─────────────────────────────────────────────────────────

export type ScheduleStatus = 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'FINISHED';
export type ScheduleSourceType = 'PLAYLIST' | 'CAMPAIGN';

export type ScheduleTarget = {
  id: string;
  deviceId: string;
  deviceName: string | null;
};

export type Schedule = {
  id: string;
  name: string;
  sourceType: ScheduleSourceType;
  playlistId: string | null;
  campaignId: string | null;
  status: ScheduleStatus;
  startDate: string;
  endDate: string | null;
  startTime: string;
  endTime: string;
  frequencyPerHour: number;
  daysOfWeek: number[];
  priority: number;
  sourceName: string | null;
  targetCount: number;
  targets?: ScheduleTarget[];
  createdAt: string;
  updatedAt: string;
};

export type CreateSchedulePayload = {
  name: string;
  sourceType: ScheduleSourceType;
  playlistId?: string;
  campaignId?: string;
  startDate: string;
  endDate?: string;
  startTime: string;
  endTime: string;
  frequencyPerHour?: number;
  daysOfWeek: number[];
  priority?: number;
  deviceIds: string[];
};

export type UpdateSchedulePayload = {
  name?: string;
  status?: ScheduleStatus;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  frequencyPerHour?: number;
  daysOfWeek?: number[];
  priority?: number;
  deviceIds?: string[];
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

export const schedulesApi = {
  list: () => authenticatedRequest<Schedule[]>('/schedules', 'GET'),

  get: (id: string) => authenticatedRequest<Schedule>(`/schedules/${id}`, 'GET'),

  create: (payload: CreateSchedulePayload) =>
    authenticatedRequest<Schedule>(
      '/schedules',
      'POST',
      payload as unknown as Record<string, unknown>,
    ),

  update: (id: string, payload: UpdateSchedulePayload) =>
    authenticatedRequest<Schedule>(
      `/schedules/${id}`,
      'PATCH',
      payload as unknown as Record<string, unknown>,
    ),

  publish: (id: string) =>
    authenticatedRequest<Schedule>(`/schedules/${id}/publish`, 'POST'),

  remove: (id: string) => authenticatedRequest<void>(`/schedules/${id}`, 'DELETE'),
};
