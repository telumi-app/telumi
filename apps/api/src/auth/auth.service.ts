import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { scryptSync, timingSafeEqual } from 'crypto';

import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateMeDto } from './dto/update-me.dto';

import { DatabaseService } from '@/modules/database';
import {
  type GoalProfile,
  type OnboardingStep,
  buildActivationChecklist,
  deriveCapabilities,
  isOnboardingFinished,
  resolveOnboardingRoute,
} from '@/onboarding/capabilities/capabilities';

type UserRole = 'ADMIN' | 'OPERATOR';

type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  message?: string;
};

type AuthUserData = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  createdAt: string;
  workspace: {
    id: string;
    name: string;
    slug: string;
    goalProfile: GoalProfile;
    onboardingStep: OnboardingStep;
    onboardingCompleted: boolean;
    onboardingNextRoute: string;
    capabilities: ReturnType<typeof deriveCapabilities>;
    activationChecklist: ReturnType<typeof buildActivationChecklist>;
  };
};

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginDto): Promise<
    ApiResponse<{
      accessToken: string;
      onboardingCompleted: boolean;
      onboardingStep: OnboardingStep;
      onboardingNextRoute: string;
    }>
  > {
    const user = await this.db.user.findFirst({
      where: { email: dto.email.toLowerCase().trim() },
      include: {
        workspace: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }

    const isValidPassword = await this.validatePassword(
      dto.password,
      user.passwordHash,
      user.id,
    );

    if (!isValidPassword) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      workspaceId: user.workspaceId,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '7d'),
    });

    return {
      success: true,
      data: {
        accessToken,
        onboardingCompleted: isOnboardingFinished(user.workspace.onboardingStep),
        onboardingStep: user.workspace.onboardingStep,
        onboardingNextRoute: resolveOnboardingRoute(user.workspace.onboardingStep),
      },
    };
  }

  async register(dto: RegisterDto): Promise<
    ApiResponse<{
      userId: string;
      accessToken: string;
      onboardingCompleted: boolean;
      onboardingStep: OnboardingStep;
      onboardingNextRoute: string;
    }>
  > {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('As senhas não conferem.');
    }

    const email = dto.email.toLowerCase().trim();

    try {
      const existingUser = await this.db.user.findFirst({ where: { email } });
      if (existingUser) {
        throw new BadRequestException('Este e-mail já está cadastrado. Faça login ou redefina sua senha.');
      }

      const passwordHash = await bcrypt.hash(dto.password, 12);
      const workspaceSlug = this.generateWorkspaceSlug(dto.name);

      const user = await this.db.$transaction(async (tx: any) => {
        const workspace = await tx.workspace.create({
          data: {
            name: `${dto.name} Workspace`,
            slug: workspaceSlug,
            goalProfile: 'INTERNAL',
            onboardingStep: 'WORKSPACE_CREATED',
            onboardingCompleted: false,
          },
        });

        return tx.user.create({
          data: {
            workspaceId: workspace.id,
            email,
            name: dto.name,
            passwordHash,
            role: 'ADMIN',
          },
          include: {
            workspace: true,
          },
        });
      });

      const payload = {
        sub: user.id,
        email: user.email,
        role: user.role,
        workspaceId: user.workspaceId,
      };

      const accessToken = await this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '7d'),
      });

      return {
        success: true,
        data: {
          userId: user.id,
          accessToken,
          onboardingCompleted: isOnboardingFinished(user.workspace.onboardingStep),
          onboardingStep: user.workspace.onboardingStep,
          onboardingNextRoute: resolveOnboardingRoute(user.workspace.onboardingStep),
        },
        message: 'Conta criada com sucesso.',
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Não foi possível criar sua conta.');
    }
  }

  async forgotPassword(_dto: ForgotPasswordDto): Promise<ApiResponse<null>> {
    return {
      success: true,
      message:
        'Se existir uma conta com este e-mail, enviaremos as instruções para redefinir sua senha.',
    };
  }

  async me(authUser: { sub: string }): Promise<ApiResponse<AuthUserData>> {
    const user = await this.db.user.findUnique({
      where: { id: authUser.sub },
      include: {
        workspace: {
          include: {
            _count: { select: { locations: true, devices: true } },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuário não autenticado.');
    }

    const geocodedLocationCount = await this.db.location.count({
      where: {
        workspaceId: user.workspace.id,
        latitude: { not: null },
        longitude: { not: null },
      },
    });

    const checklistCtx = {
      hasLocation: user.workspace._count.locations > 0,
      hasDevice: user.workspace._count.devices > 0,
      hasLocationWithCoordinates: geocodedLocationCount > 0,
    };

    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        workspace: {
          id: user.workspace.id,
          name: user.workspace.name,
          slug: user.workspace.slug,
          goalProfile: user.workspace.goalProfile,
          onboardingStep: user.workspace.onboardingStep,
          onboardingCompleted: isOnboardingFinished(user.workspace.onboardingStep),
          onboardingNextRoute: resolveOnboardingRoute(user.workspace.onboardingStep),
          capabilities: deriveCapabilities(user.workspace.goalProfile),
          activationChecklist: buildActivationChecklist(
            user.workspace.goalProfile,
            checklistCtx,
          ),
        },
      },
    };
  }

  async updateMe(
    authUser: { sub: string },
    dto: UpdateMeDto,
  ): Promise<ApiResponse<AuthUserData>> {
    const user = await this.db.user.findUnique({
      where: { id: authUser.sub },
      select: {
        id: true,
        workspaceId: true,
        email: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuário não autenticado.');
    }

    const normalizedEmail = dto.email?.toLowerCase().trim();
    const normalizedName = dto.name?.trim();
    const normalizedWorkspaceName = dto.workspaceName?.trim();

    if (normalizedEmail && normalizedEmail !== user.email) {
      const existingUser = await this.db.user.findFirst({
        where: {
          email: normalizedEmail,
          id: { not: user.id },
        },
        select: { id: true },
      });

      if (existingUser) {
        throw new BadRequestException('Este e-mail já está em uso por outra conta.');
      }
    }

    await this.db.$transaction(async (tx: any) => {
      if (normalizedName || normalizedEmail) {
        await tx.user.update({
          where: { id: user.id },
          data: {
            ...(normalizedName ? { name: normalizedName } : {}),
            ...(normalizedEmail ? { email: normalizedEmail } : {}),
          },
        });
      }

      if (normalizedWorkspaceName) {
        await tx.workspace.update({
          where: { id: user.workspaceId },
          data: { name: normalizedWorkspaceName },
        });
      }
    });

    return this.me(authUser);
  }

  private generateWorkspaceSlug(name: string): string {
    const base = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 36);

    const suffix = Math.random().toString(36).slice(2, 8);
    return `${base || 'workspace'}-${suffix}`;
  }

  private async validatePassword(
    plainPassword: string,
    storedHash: string,
    userId: string,
  ): Promise<boolean> {
    if (this.isLegacyScryptHash(storedHash)) {
      const isLegacyValid = this.validateLegacyScryptPassword(plainPassword, storedHash);

      if (isLegacyValid) {
        await this.migratePasswordHashToBcrypt(userId, plainPassword);
      }

      return isLegacyValid;
    }

    return bcrypt.compare(plainPassword, storedHash);
  }

  private isLegacyScryptHash(hash: string): boolean {
    const parts = hash.split(':');

    if (parts.length !== 2) {
      return false;
    }

    const [salt, derivedHash] = parts;

    return salt.length === 32 && derivedHash.length === 128;
  }

  private validateLegacyScryptPassword(plainPassword: string, hash: string): boolean {
    const [salt, expectedHash] = hash.split(':');

    const computedHash = scryptSync(plainPassword, salt, 64).toString('hex');

    return timingSafeEqual(
      Buffer.from(computedHash, 'hex'),
      Buffer.from(expectedHash, 'hex'),
    );
  }

  private async migratePasswordHashToBcrypt(
    userId: string,
    plainPassword: string,
  ): Promise<void> {
    try {
      const bcryptHash = await bcrypt.hash(plainPassword, 12);

      await this.db.user.update({
        where: { id: userId },
        data: { passwordHash: bcryptHash },
      });
    } catch {
      return;
    }
  }
}
