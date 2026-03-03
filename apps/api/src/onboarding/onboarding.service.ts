import { BadRequestException, Injectable } from '@nestjs/common';
import { ScreenCountRange } from '@prisma/client';

import {
  type GoalProfile,
  type OnboardingStep,
  buildActivationChecklist,
  deriveCapabilities,
  resolveOnboardingRoute,
} from './capabilities/capabilities';
import { SetupOnboardingDto, ScreenCountDto } from './dto/setup-onboarding.dto';
import { UpdateModeDto } from './dto/update-mode.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';

import { DatabaseService } from '@/modules/database';

type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  message?: string;
};

const ONBOARDING_STEP = {
  WORKSPACE_CREATED: 'WORKSPACE_CREATED' as OnboardingStep,
  GOAL_SELECTED: 'GOAL_SELECTED' as OnboardingStep,
  SETUP_COMPLETED: 'SETUP_COMPLETED' as OnboardingStep,
  FINISHED: 'FINISHED' as OnboardingStep,
};

@Injectable()
export class OnboardingService {
  constructor(private readonly db: DatabaseService) {}

  private assertStep(currentStep: OnboardingStep, requiredStep: OnboardingStep): void {
    if (currentStep !== requiredStep) {
      throw new BadRequestException(
        `Etapa inválida. Continue em: ${resolveOnboardingRoute(currentStep)}`,
      );
    }
  }

  private toScreenCountRange(value: ScreenCountDto): ScreenCountRange {
    return value as unknown as ScreenCountRange;
  }

  private sanitizeCnpj(value?: string): string | null {
    if (!value) {
      return null;
    }

    const digits = value.replace(/\D/g, '');
    return digits.length ? digits : null;
  }

  async updateWorkspace(
    workspaceId: string,
    dto: UpdateWorkspaceDto,
  ): Promise<
    ApiResponse<{
      id: string;
      name: string;
      slug: string;
      onboardingStep: OnboardingStep;
      onboardingNextRoute: string;
    }>
  > {
    const current = await this.db.workspace.findUnique({
      where: { id: workspaceId },
      select: { onboardingStep: true },
    });

    if (!current) {
      throw new BadRequestException('Workspace não encontrado.');
    }

    this.assertStep(current.onboardingStep as OnboardingStep, ONBOARDING_STEP.WORKSPACE_CREATED);

    const slug = dto.slug.trim().toLowerCase();
    const conflict = await this.db.workspace.findFirst({
      where: {
        slug,
        id: { not: workspaceId },
      },
      select: { id: true },
    });

    if (conflict) {
      throw new BadRequestException('Este slug já está em uso.');
    }

    const workspace = await this.db.workspace.update({
      where: { id: workspaceId },
      data: {
        name: dto.name.trim(),
        slug,
        onboardingStep: ONBOARDING_STEP.GOAL_SELECTED,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        onboardingStep: true,
      },
    });

    return {
      success: true,
      data: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        onboardingStep: workspace.onboardingStep as OnboardingStep,
        onboardingNextRoute: resolveOnboardingRoute(workspace.onboardingStep as OnboardingStep),
      },
      message: 'Workspace atualizado com sucesso.',
    };
  }

  async updateMode(
    workspaceId: string,
    dto: UpdateModeDto,
  ): Promise<
    ApiResponse<{
      goalProfile: GoalProfile;
      onboardingStep: OnboardingStep;
      onboardingNextRoute: string;
    }>
  > {
    const current = await this.db.workspace.findUnique({
      where: { id: workspaceId },
      select: { onboardingStep: true },
    });

    if (!current) {
      throw new BadRequestException('Workspace não encontrado.');
    }

    this.assertStep(current.onboardingStep as OnboardingStep, ONBOARDING_STEP.GOAL_SELECTED);

    const workspace = await this.db.workspace.update({
      where: { id: workspaceId },
      data: {
        goalProfile: dto.goalProfile,
        onboardingStep: ONBOARDING_STEP.SETUP_COMPLETED,
      },
      select: {
        goalProfile: true,
        onboardingStep: true,
      },
    });

    return {
      success: true,
      data: {
        goalProfile: workspace.goalProfile as GoalProfile,
        onboardingStep: workspace.onboardingStep as OnboardingStep,
        onboardingNextRoute: resolveOnboardingRoute(workspace.onboardingStep as OnboardingStep),
      },
      message: 'Objetivo da conta atualizado com sucesso.',
    };
  }

  async setup(
    workspaceId: string,
    dto: SetupOnboardingDto,
  ): Promise<
    ApiResponse<{
      onboardingStep: OnboardingStep;
      onboardingNextRoute: string;
      capabilities: ReturnType<typeof deriveCapabilities>;
      activationChecklist: ReturnType<typeof buildActivationChecklist>;
    }>
  > {
    const current = await this.db.workspace.findUnique({
      where: { id: workspaceId },
      select: { onboardingStep: true },
    });

    if (!current) {
      throw new BadRequestException('Workspace não encontrado.');
    }

    this.assertStep(current.onboardingStep as OnboardingStep, ONBOARDING_STEP.SETUP_COMPLETED);

    const goalProfile = dto.goalProfile as GoalProfile;
    const wantsToSellImmediately =
      goalProfile === 'ADS_SALES' ? dto.wantsToSellImmediately ?? null : null;
    const hasCnpj = goalProfile === 'ADS_SALES' ? dto.hasCnpj ?? null : null;
    const cnpj =
      goalProfile === 'ADS_SALES' && dto.hasCnpj
        ? this.sanitizeCnpj(dto.cnpj)
        : null;

    await this.db.$transaction(async (tx: Pick<DatabaseService, 'workspace' | 'workspaceSettings'>) => {
      await tx.workspace.update({
        where: { id: workspaceId },
        data: {
          goalProfile,
        },
      });

      await tx.workspaceSettings.upsert({
        where: { workspaceId },
        create: {
          workspaceId,
          companyName: dto.companyName.trim(),
          city: dto.city.trim(),
          state: dto.state.trim().toUpperCase(),
          screenCount: this.toScreenCountRange(dto.screenCount),
          wantsToSellImmediately,
          hasCnpj,
          cnpj,
        },
        update: {
          companyName: dto.companyName.trim(),
          city: dto.city.trim(),
          state: dto.state.trim().toUpperCase(),
          screenCount: this.toScreenCountRange(dto.screenCount),
          wantsToSellImmediately,
          hasCnpj,
          cnpj,
        },
      });
    });

    const capabilities = deriveCapabilities(goalProfile);
    const activationChecklist = buildActivationChecklist(goalProfile);

    return {
      success: true,
      data: {
        onboardingStep: ONBOARDING_STEP.SETUP_COMPLETED,
        onboardingNextRoute: resolveOnboardingRoute(ONBOARDING_STEP.SETUP_COMPLETED),
        capabilities,
        activationChecklist,
      },
      message: 'Configurações iniciais salvas com sucesso.',
    };
  }

  async complete(
    workspaceId: string,
  ): Promise<
    ApiResponse<{
      onboardingStep: OnboardingStep;
      onboardingNextRoute: string;
    }>
  > {
    const current = await this.db.workspace.findUnique({
      where: { id: workspaceId },
      select: { onboardingStep: true },
    });

    if (!current) {
      throw new BadRequestException('Workspace não encontrado.');
    }

    this.assertStep(current.onboardingStep as OnboardingStep, ONBOARDING_STEP.SETUP_COMPLETED);

    const workspace = await this.db.workspace.update({
      where: { id: workspaceId },
      data: {
        onboardingStep: ONBOARDING_STEP.FINISHED,
        onboardingCompleted: true,
      },
      select: {
        onboardingStep: true,
      },
    });

    return {
      success: true,
      data: {
        onboardingStep: workspace.onboardingStep as OnboardingStep,
        onboardingNextRoute: resolveOnboardingRoute(workspace.onboardingStep as OnboardingStep),
      },
      message: 'Onboarding concluído com sucesso.',
    };
  }
}
