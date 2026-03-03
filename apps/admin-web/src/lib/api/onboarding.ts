import { getSessionToken } from '@/lib/auth/session';

type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  message?: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type GoalProfile = 'INTERNAL' | 'ADS_SALES';
export type OnboardingStep =
  | 'WORKSPACE_CREATED'
  | 'GOAL_SELECTED'
  | 'SETUP_COMPLETED'
  | 'FINISHED';

export type ScreenCount = 'ONE_TO_TWO' | 'THREE_TO_FIVE' | 'SIX_TO_TEN' | 'TEN_PLUS';

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

async function authenticatedRequest<TData>(
  path: string,
  method: 'PATCH' | 'POST',
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

export const onboardingApi = {
  updateWorkspace: (payload: { name: string; slug: string }) =>
    authenticatedRequest<{ id: string; name: string; slug: string; onboardingStep: OnboardingStep; onboardingNextRoute: string }>(
      '/onboarding/workspace',
      'PATCH',
      payload,
    ),
  updateMode: (goalProfile: GoalProfile) =>
    authenticatedRequest<{ goalProfile: GoalProfile; onboardingStep: OnboardingStep; onboardingNextRoute: string }>('/onboarding/mode', 'PATCH', {
      goalProfile,
    }),
  setup: (payload: {
    companyName: string;
    city: string;
    state: string;
    screenCount: ScreenCount;
    goalProfile: GoalProfile;
    wantsToSellImmediately?: boolean;
    hasCnpj?: boolean;
    cnpj?: string;
  }) =>
    authenticatedRequest<{
      onboardingStep: OnboardingStep;
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
    }>('/onboarding/setup', 'PATCH', payload),
  complete: () => authenticatedRequest<{ onboardingStep: OnboardingStep; onboardingNextRoute: string }>('/onboarding/complete', 'POST'),
};
