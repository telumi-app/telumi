export type GoalProfile = 'INTERNAL' | 'ADS_SALES';
export type OnboardingStep =
  | 'WORKSPACE_CREATED'
  | 'GOAL_SELECTED'
  | 'SETUP_COMPLETED'
  | 'FINISHED';

export type WorkspaceCapabilities = {
  canSellAds: boolean;
  requiresBillingValidation: boolean;
  showCommercialChecklist: boolean;
};

export type ActivationChecklistItem = {
  id: string;
  label: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'done';
  actionRoute: string;
};

export type ChecklistContext = {
  hasLocation: boolean;
  hasDevice: boolean;
  hasLocationWithCoordinates: boolean;
};

const DEFAULT_ITEM_STATUS: ActivationChecklistItem['status'] = 'pending';

function resolveItemStatus(
  id: string,
  ctx: ChecklistContext,
): ActivationChecklistItem['status'] {
  switch (id) {
    case 'add-first-location':
      return ctx.hasLocation ? 'done' : DEFAULT_ITEM_STATUS;
    case 'add-first-screen':
      return ctx.hasDevice ? 'done' : ctx.hasLocation ? 'in_progress' : DEFAULT_ITEM_STATUS;
    case 'add-location-address':
      return ctx.hasLocationWithCoordinates ? 'done' : ctx.hasLocation ? 'in_progress' : DEFAULT_ITEM_STATUS;
    default:
      return DEFAULT_ITEM_STATUS;
  }
}

const checklistByGoalProfile: Record<
  GoalProfile,
  Omit<ActivationChecklistItem, 'status'>[]
> = {
  INTERNAL: [
    {
      id: 'add-first-location',
      label: 'Criar primeiro local',
      description: 'Cadastre o local onde suas telas serão instaladas.',
      actionRoute: '/telas',
    },
    {
      id: 'add-first-screen',
      label: 'Adicionar primeira tela',
      description: 'Cadastre e conecte a primeira tela da sua operação.',
      actionRoute: '/telas',
    },
    {
      id: 'add-location-address',
      label: 'Adicionar endereço ao local',
      description: 'Recomendado para organizar suas telas e visualizar no mapa.',
      actionRoute: '/telas',
    },
    {
      id: 'create-first-content',
      label: 'Criar primeiro conteúdo',
      description: 'Envie um conteúdo para começar sua programação.',
      actionRoute: '/media/new',
    },
    {
      id: 'publish-to-tv',
      label: 'Publicar na TV',
      description: 'Associe o conteúdo a uma tela e publique a exibição.',
      actionRoute: '/schedule/new',
    },
  ],
  ADS_SALES: [
    {
      id: 'add-first-location',
      label: 'Criar primeiro local',
      description: 'Cadastre o local onde suas telas serão instaladas.',
      actionRoute: '/telas',
    },
    {
      id: 'add-first-screen',
      label: 'Adicionar primeira tela',
      description: 'Cadastre e conecte a primeira tela da sua operação.',
      actionRoute: '/telas',
    },
    {
      id: 'add-location-address',
      label: 'Adicionar endereço ao local',
      description: 'Recomendado para organizar suas telas e visualizar no mapa.',
      actionRoute: '/telas',
    },
    {
      id: 'create-first-campaign',
      label: 'Criar primeira campanha',
      description: 'Prepare sua primeira campanha para anunciantes.',
      actionRoute: '/campaigns/new',
    },
    {
      id: 'setup-billing',
      label: 'Configurar cobrança',
      description: 'Defina as configurações de cobrança para começar a vender.',
      actionRoute: '/billing/setup',
    },
    {
      id: 'validate-account',
      label: 'Validar conta',
      description: 'Finalize a validação da conta para liberar as vendas.',
      actionRoute: '/billing/validation',
    },
  ],
};

export function deriveCapabilities(goalProfile: GoalProfile): WorkspaceCapabilities {
  if (goalProfile === 'ADS_SALES') {
    return {
      canSellAds: true,
      requiresBillingValidation: true,
      showCommercialChecklist: true,
    };
  }

  return {
    canSellAds: false,
    requiresBillingValidation: false,
    showCommercialChecklist: false,
  };
}

export function resolveOnboardingRoute(step: OnboardingStep): string {
  if (step === 'WORKSPACE_CREATED') {
    return '/onboarding/workspace';
  }

  if (step === 'GOAL_SELECTED') {
    return '/onboarding/mode';
  }

  if (step === 'SETUP_COMPLETED') {
    return '/onboarding/setup';
  }

  return '/dashboard';
}

export function buildActivationChecklist(
  goalProfile: GoalProfile,
  ctx: ChecklistContext = { hasLocation: false, hasDevice: false, hasLocationWithCoordinates: false },
): ActivationChecklistItem[] {
  const items = checklistByGoalProfile[goalProfile];
  return items.map((item) => ({
    ...item,
    status: resolveItemStatus(item.id, ctx),
  }));
}

export function isOnboardingFinished(step: OnboardingStep): boolean {
  return step === 'FINISHED';
}
