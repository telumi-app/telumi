import { Body, Controller, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { AuthUser } from '@/auth/types/auth-user.type';

import { UpdateModeDto } from './dto/update-mode.dto';
import { SetupOnboardingDto } from './dto/setup-onboarding.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { OnboardingService } from './onboarding.service';

@ApiTags('Onboarding')
@Controller('onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Patch('workspace')
  @ApiOperation({ summary: 'Atualiza dados básicos do workspace no onboarding' })
  updateWorkspace(@CurrentUser() user: AuthUser, @Body() dto: UpdateWorkspaceDto) {
    return this.onboardingService.updateWorkspace(user.workspaceId, dto);
  }

  @Patch('mode')
  @ApiOperation({ summary: 'Define objetivo da conta no onboarding' })
  updateMode(@CurrentUser() user: AuthUser, @Body() dto: UpdateModeDto) {
    return this.onboardingService.updateMode(user.workspaceId, dto);
  }

  @Patch('setup')
  @ApiOperation({ summary: 'Salva configurações iniciais do workspace no onboarding' })
  setup(@CurrentUser() user: AuthUser, @Body() dto: SetupOnboardingDto) {
    return this.onboardingService.setup(user.workspaceId, dto);
  }

  @Post('complete')
  @ApiOperation({ summary: 'Marca onboarding como concluído' })
  complete(@CurrentUser() user: AuthUser) {
    return this.onboardingService.complete(user.workspaceId);
  }
}
