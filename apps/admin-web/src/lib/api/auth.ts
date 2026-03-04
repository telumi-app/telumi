export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  message?: string;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export type ForgotPasswordRequest = {
  email: string;
};

export type UpdateMeRequest = {
  name?: string;
  email?: string;
  workspaceName?: string;
};

export type LoginResponseData = {
  accessToken: string;
  onboardingCompleted: boolean;
  onboardingStep: 'WORKSPACE_CREATED' | 'GOAL_SELECTED' | 'SETUP_COMPLETED' | 'FINISHED';
  onboardingNextRoute: string;
};

export type RegisterResponseData = {
  userId: string;
  accessToken: string;
  onboardingCompleted: boolean;
  onboardingStep: 'WORKSPACE_CREATED' | 'GOAL_SELECTED' | 'SETUP_COMPLETED' | 'FINISHED';
  onboardingNextRoute: string;
};

export type MeResponseData = {
  id: string;
  email: string;
  name: string | null;
  role: 'ADMIN' | 'OPERATOR';
  createdAt: string;
  workspace: {
    id: string;
    name: string;
    slug: string;
    goalProfile: 'INTERNAL' | 'ADS_SALES';
    onboardingStep: 'WORKSPACE_CREATED' | 'GOAL_SELECTED' | 'SETUP_COMPLETED' | 'FINISHED';
    onboardingCompleted: boolean;
    onboardingNextRoute: string;
    capabilities: {
      canSellAds: boolean;
      requiresBillingValidation: boolean;
      showCommercialChecklist: boolean;
    };
    activationChecklist: Array<{
      id: string;
      label: string;
      description?: string;
      status: 'pending' | 'in_progress' | 'done';
      actionRoute: string;
    }>;
  };
};

function normalizeApiBaseUrl(rawUrl?: string): string {
  const trimmedUrl = (rawUrl ?? '').trim().replace(/\/$/, '');

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

const API_BASE_URL = normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_URL);

const NETWORK_ERROR_MESSAGE =
  'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.';

function isNetworkError(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    ('message' in error &&
      (error.message === 'Failed to fetch' ||
        error.message === 'Network request failed' ||
        error.message.includes('ERR_CONNECTION_REFUSED')))
  );
}

async function postRequest<TData, TPayload>(
  path: string,
  payload: TPayload,
): Promise<ApiResponse<TData>> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/v1${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
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

async function getRequest<TData>(
  path: string,
  token: string,
): Promise<ApiResponse<TData>> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/v1${path}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
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

async function patchRequest<TData, TPayload>(
  path: string,
  payload: TPayload,
  token: string,
): Promise<ApiResponse<TData>> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/v1${path}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
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

export const authApi = {
  login: (payload: LoginRequest) => postRequest<LoginResponseData, LoginRequest>('/auth/login', payload),
  register: (payload: RegisterRequest) =>
    postRequest<RegisterResponseData, RegisterRequest>('/auth/register', payload),
  forgotPassword: (payload: ForgotPasswordRequest) =>
    postRequest<null, ForgotPasswordRequest>('/auth/forgot-password', payload),
  me: (token: string) => getRequest<MeResponseData>('/auth/me', token),
  updateMe: (payload: UpdateMeRequest, token: string) =>
    patchRequest<MeResponseData, UpdateMeRequest>('/auth/me', payload, token),
};
