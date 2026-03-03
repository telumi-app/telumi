import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { AuthUser } from '@/auth/types/auth-user.type';

import { CampaignSchedulingService } from './campaign-scheduling.service';
import { ConfirmScheduleDto } from './dto/confirm-schedule.dto';
import { ValidateScheduleDto } from './dto/validate-schedule.dto';

@ApiTags('Campaign Scheduling (Internal)')
@Controller('internal/campaigns')
@UseGuards(JwtAuthGuard)
export class CampaignSchedulingController {
  constructor(
    private readonly schedulingService: CampaignSchedulingService,
  ) {}

  @Post(':id/schedule/validate')
  @ApiOperation({
    summary: 'Valida agendamento e reserva capacidade (hold)',
    description:
      'Expande occurrences, verifica capacidade por tela e retorna ' +
      'status + sugestões. Se OK/PARCIAL, cria hold de 5 min.',
  })
  validate(
    @CurrentUser() user: AuthUser,
    @Param('id') campaignId: string,
    @Body() dto: ValidateScheduleDto,
  ) {
    return this.schedulingService.validate(user.workspaceId, campaignId, dto);
  }

  @Post(':id/schedule/confirm')
  @ApiOperation({
    summary: 'Confirma agendamento usando hold válido',
    description:
      'Re-valida capacidade, insere ScheduleRule + ScheduleOccurrences, ' +
      'consome o hold. Transacional e idempotente.',
  })
  confirm(
    @CurrentUser() user: AuthUser,
    @Param('id') campaignId: string,
    @Body() dto: ConfirmScheduleDto,
  ) {
    return this.schedulingService.confirm(user.workspaceId, campaignId, dto);
  }
}

@ApiTags('Player')
@Controller('player/screens')
export class PlayerScreenController {
  constructor(
    private readonly schedulingService: CampaignSchedulingService,
  ) {}

  @Get(':screenId/now')
  @ApiOperation({
    summary: 'Retorna conteúdo atual para uma tela',
    description:
      'Retorna campanhas ativas + fallback playlist para o timestamp atual (ou ?at=ISO).',
  })
  getScreenContent(
    @Param('screenId') screenId: string,
    @Query('at') at?: string,
  ) {
    const atDate = at ? new Date(at) : undefined;
    return this.schedulingService.getScreenContent(screenId, atDate);
  }
}
