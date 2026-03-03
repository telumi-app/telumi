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

import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { CampaignsService } from './campaigns.service';

@ApiTags('Campaigns')
@Controller('campaigns')
@UseGuards(JwtAuthGuard)
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista campanhas do workspace' })
  findAll(@CurrentUser() user: AuthUser) {
    return this.campaignsService.findAll(user.workspaceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe de uma campanha' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.campaignsService.findOne(user.workspaceId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Cria uma nova campanha' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCampaignDto) {
    return this.campaignsService.create(user.workspaceId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza uma campanha' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.campaignsService.update(user.workspaceId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove uma campanha' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.campaignsService.remove(user.workspaceId, id);
  }
}
