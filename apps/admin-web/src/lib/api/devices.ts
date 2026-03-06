import { getSessionToken } from '@/lib/auth/session';

type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  message?: string;
};

function normalizeApiBaseUrl(rawUrl: string): string {
  const trimmedUrl = rawUrl.trim().replace(/\/$/, '');

  if (!trimmedUrl) {
    return 'http://localhost:3001';
  }

  if (trimmedUrl.includes('telumi-api-production.up.railway.app')) {
    return trimmedUrl.replace(
      'telumi-api-production.up.railway.app',
      'telumiapi-production.up.railway.app',
    );
  }

  return trimmedUrl;
}

const API_BASE_URL = normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001');

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

export type DeviceStatus = 'PENDING' | 'ONLINE' | 'UNSTABLE' | 'OFFLINE';
export type DeviceOrientation = 'HORIZONTAL' | 'VERTICAL';
export type DeviceOperationalStatus = 'ACTIVE' | 'INACTIVE';

export type Device = {
  id: string;
  name: string;
  locationId: string;
  locationName: string;
  orientation: DeviceOrientation;
  resolution: string;
  operationalStatus: DeviceOperationalStatus;
  isPublic: boolean;
  isPartnerTv: boolean;
  partnerName: string | null;
  partnerRevenueSharePct: number | null;
  pairingCode: string | null;
  pairingExpiresAt: string | null;
  pairedAt: string | null;
  lastHeartbeat: string | null;
  status: DeviceStatus;
  operationalAlerts?: string[];
  telemetry?: {
    lastHeartbeatAgeSeconds: number | null;
    heartbeatWindow?: 'UNKNOWN' | 'FRESH' | 'DELAYED' | 'STALE';
    cacheStrategy?: 'OFFLINE_FIRST';
    resolutionClass?: 'AUTO' | 'SD' | 'HD' | 'FHD' | 'UHD';
    capabilityTier?: 'ENTRY' | 'STANDARD' | 'SIGNAGE_PLUS';
    playbackReadiness?: 'PENDING_PAIRING' | 'SYNCED' | 'DEGRADED' | 'RECOVERY_ONLY' | 'PAUSED';
    recentEvents7d?: number;
    warningEvents7d?: number;
    criticalEvents7d?: number;
    lastEventType?: string | null;
    lastEventSeverity?: string | null;
    lastEventAt?: string | null;
  };
  createdAt: string;
};

export type CreateDevicePayload = {
  name: string;
  locationId: string;
  orientation: DeviceOrientation;
  resolution: string;
  operationalStatus: DeviceOperationalStatus;
  isPublic: boolean;
  isPartnerTv?: boolean;
  partnerName?: string;
  partnerRevenueSharePct?: number;
};

export type UpdateDevicePayload = {
  name?: string;
  locationId?: string;
  orientation?: DeviceOrientation;
  resolution?: string;
  operationalStatus?: DeviceOperationalStatus;
  isPublic?: boolean;
  isPartnerTv?: boolean;
  partnerName?: string;
  partnerRevenueSharePct?: number;
};

export type RegenerateCodeResponse = {
  id: string;
  pairingCode: string;
  pairingExpiresAt: string;
};

export type RecoveryLinkResponse = {
  deviceId: string;
  recoveryLink: string;
};

// ─── API ───────────────────────────────────────────────────────────

export const devicesApi = {
  list: () => authenticatedRequest<Device[]>('/devices', 'GET'),
  create: (payload: CreateDevicePayload) =>
    authenticatedRequest<Device>('/devices', 'POST', payload as Record<string, unknown>),
  update: (deviceId: string, payload: UpdateDevicePayload) =>
    authenticatedRequest<Device>(`/devices/${deviceId}`, 'PATCH', payload as Record<string, unknown>),
  regenerateCode: (deviceId: string) =>
    authenticatedRequest<RegenerateCodeResponse>(
      `/devices/${deviceId}/regenerate-code`,
      'POST',
    ),
  getRecoveryLink: (deviceId: string) =>
    authenticatedRequest<RecoveryLinkResponse>(`/devices/${deviceId}/recovery-link`, 'GET'),
  rotateRecoveryLink: (deviceId: string) =>
    authenticatedRequest<RecoveryLinkResponse>(`/devices/${deviceId}/repair`, 'POST'),
  remove: (deviceId: string) =>
    authenticatedRequest(`/devices/${deviceId}`, 'DELETE'),
};
