import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { AuthUser } from '@/auth/types/auth-user.type';

import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { DevicesService } from './devices.service';

@ApiTags('Devices')
@Controller('devices')
@UseGuards(JwtAuthGuard)
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista telas do workspace' })
  findAll(@CurrentUser() user: AuthUser) {
    return this.devicesService.findAll(user.workspaceId);
  }

  @Post()
  @ApiOperation({ summary: 'Cria uma nova tela no workspace' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDeviceDto) {
    return this.devicesService.create(user.workspaceId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza dados de uma tela no workspace' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateDeviceDto,
  ) {
    return this.devicesService.update(user.workspaceId, id, dto);
  }

  @Post(':id/regenerate-code')
  @ApiOperation({ summary: 'Regenera código de pareamento de uma tela' })
  regenerateCode(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.devicesService.regenerateCode(user.workspaceId, id);
  }

  @Get(':id/recovery-link')
  @ApiOperation({ summary: 'Obtém o link de recuperação de pareamento da tela' })
  getRecoveryLink(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.devicesService.getRecoveryLink(user.workspaceId, id);
  }

  @Post(':id/repair')
  @ApiOperation({ summary: 'Rotaciona o link de recuperação (reparear) da tela' })
  rotateRecoveryLink(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.devicesService.rotateRecoveryLink(user.workspaceId, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove uma tela do workspace' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.devicesService.remove(user.workspaceId, id);
  }
}
