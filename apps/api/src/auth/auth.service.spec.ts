import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes, scryptSync } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from './auth.service';

import { DatabaseService } from '@/modules/database';

vi.mock('bcrypt', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
  compare: vi.fn(),
  hash: vi.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;

  const dbMock = {
    user: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    workspace: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  } as unknown as DatabaseService;

  const jwtServiceMock = {
    signAsync: vi.fn(),
  } as unknown as JwtService;

  const configServiceMock = {
    get: vi.fn((key: string, fallback?: string) => {
      if (key === 'JWT_SECRET') {
        return 'test-secret';
      }
      if (key === 'JWT_EXPIRES_IN') {
        return '7d';
      }
      return fallback;
    }),
  } as unknown as ConfigService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(dbMock, jwtServiceMock, configServiceMock);
  });

  it('deve autenticar com sucesso e retornar token', async () => {
    dbMock.user.findFirst = vi.fn().mockResolvedValue({
      id: 'user-1',
      workspaceId: 'workspace-1',
      email: 'admin@telumi.dev',
      passwordHash: 'hashed-password',
      role: 'ADMIN',
      workspace: {
        id: 'workspace-1',
        name: 'Workspace Teste',
        slug: 'workspace-teste',
        goalProfile: 'INTERNAL',
        onboardingStep: 'WORKSPACE_CREATED',
        onboardingCompleted: false,
      },
    });

    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
    (jwtServiceMock.signAsync as ReturnType<typeof vi.fn>).mockResolvedValue('jwt-token');

    const response = await service.login({
      email: 'admin@telumi.dev',
      password: '12345678',
    });

    expect(response).toEqual({
      success: true,
      data: {
        accessToken: 'jwt-token',
        onboardingCompleted: false,
        onboardingStep: 'WORKSPACE_CREATED',
        onboardingNextRoute: '/onboarding/workspace',
      },
    });
  });

  it('deve falhar no login quando usuário não existir', async () => {
    dbMock.user.findFirst = vi.fn().mockResolvedValue(null);

    await expect(
      service.login({ email: 'invalido@telumi.dev', password: '12345678' }),
    ).rejects.toThrow(new UnauthorizedException('E-mail ou senha inválidos.'));
  });

  it('deve falhar no login quando senha for inválida', async () => {
    dbMock.user.findFirst = vi.fn().mockResolvedValue({
      id: 'user-1',
      workspaceId: 'workspace-1',
      email: 'admin@telumi.dev',
      passwordHash: 'hashed-password',
      role: 'ADMIN',
      workspace: {
        id: 'workspace-1',
        name: 'Workspace Teste',
        slug: 'workspace-teste',
        goalProfile: 'INTERNAL',
        onboardingStep: 'WORKSPACE_CREATED',
        onboardingCompleted: false,
      },
    });

    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

    await expect(
      service.login({ email: 'admin@telumi.dev', password: 'senha-errada' }),
    ).rejects.toThrow(new UnauthorizedException('E-mail ou senha inválidos.'));
  });

  it('deve autenticar hash legado scrypt e migrar para bcrypt', async () => {
    const salt = randomBytes(16).toString('hex');
    const password = '12345678';
    const legacyHash = `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;

    dbMock.user.findFirst = vi.fn().mockResolvedValue({
      id: 'user-legacy',
      workspaceId: 'workspace-1',
      email: 'legacy@telumi.dev',
      passwordHash: legacyHash,
      role: 'ADMIN',
      workspace: {
        id: 'workspace-1',
        name: 'Workspace Teste',
        slug: 'workspace-teste',
        goalProfile: 'INTERNAL',
        onboardingStep: 'WORKSPACE_CREATED',
        onboardingCompleted: false,
      },
    });

    dbMock.user.update = vi.fn().mockResolvedValue(undefined);
    vi.mocked(bcrypt.hash).mockResolvedValue('rehashed-bcrypt' as never);
    (jwtServiceMock.signAsync as ReturnType<typeof vi.fn>).mockResolvedValue('jwt-token');

    const response = await service.login({
      email: 'legacy@telumi.dev',
      password,
    });

    expect(response.success).toBe(true);
    expect(dbMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-legacy' },
      data: { passwordHash: 'rehashed-bcrypt' },
    });
  });

  it('deve validar confirmação de senha no cadastro', async () => {
    await expect(
      service.register({
        name: 'Administrador',
        email: 'admin@telumi.dev',
        password: '12345678',
        confirmPassword: '87654321',
      }),
    ).rejects.toThrow(new BadRequestException('As senhas não conferem.'));
  });

  it('deve cadastrar conta com sucesso', async () => {
    dbMock.user.findFirst = vi.fn().mockResolvedValue(null);
    (dbMock.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (callback: (tx: { workspace: { create: ReturnType<typeof vi.fn> }; user: { create: ReturnType<typeof vi.fn> } }) => Promise<unknown>) =>
        callback({
          workspace: {
            create: vi.fn().mockResolvedValue({ id: 'workspace-1' }),
          },
          user: {
            create: vi.fn().mockResolvedValue({
              id: 'user-1',
              email: 'admin@telumi.dev',
              role: 'ADMIN',
              workspaceId: 'workspace-1',
              workspace: {
                onboardingCompleted: false,
                onboardingStep: 'WORKSPACE_CREATED',
              },
            }),
          },
        }),
    );

    vi.mocked(bcrypt.hash).mockResolvedValue('hashed-password' as never);
    (jwtServiceMock.signAsync as ReturnType<typeof vi.fn>).mockResolvedValue('jwt-token');

    const response = await service.register({
      name: 'Administrador',
      email: 'admin@telumi.dev',
      password: '12345678',
      confirmPassword: '12345678',
    });

    expect(response.success).toBe(true);
    expect(response.message).toBe('Conta criada com sucesso.');
    expect(response.data).toEqual({
      userId: 'user-1',
      accessToken: 'jwt-token',
      onboardingCompleted: false,
      onboardingStep: 'WORKSPACE_CREATED',
      onboardingNextRoute: '/onboarding/workspace',
    });
  });

  it('deve responder sucesso no forgot password sem expor existência da conta', async () => {
    const response = await service.forgotPassword({ email: 'admin@telumi.dev' });

    expect(response).toEqual({
      success: true,
      message:
        'Se existir uma conta com este e-mail, enviaremos as instruções para redefinir sua senha.',
    });
  });
});
