import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { AuthUser } from '@/auth/types/auth-user.type';

import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { SchedulesService } from './schedules.service';

@ApiTags('Schedules')
@Controller('schedules')
@UseGuards(JwtAuthGuard)
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista programações do workspace' })
  findAll(@CurrentUser() user: AuthUser) {
    return this.schedulesService.findAll(user.workspaceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe de uma programação' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.schedulesService.findOne(user.workspaceId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Cria uma nova programação' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateScheduleDto) {
    return this.schedulesService.create(user.workspaceId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza uma programação' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.schedulesService.update(user.workspaceId, id, dto);
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publica uma programação (ativa a exibição)' })
  publish(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.schedulesService.publish(user.workspaceId, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove uma programação' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.schedulesService.remove(user.workspaceId, id);
  }
}
