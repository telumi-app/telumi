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

import { RequestUploadUrlDto } from './dto/request-upload-url.dto';
import { RenameMediaDto } from './dto/rename-media.dto';
import { MediaService } from './media.service';

@ApiTags('Media')
@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload-url')
  @ApiOperation({ summary: 'Solicita URL presignada para upload direto' })
  requestUploadUrl(@CurrentUser() user: AuthUser, @Body() dto: RequestUploadUrlDto) {
    return this.mediaService.requestUploadUrl(user.workspaceId, dto);
  }

  @Post(':id/confirm')
  @ApiOperation({ summary: 'Confirma upload verificando existência no storage' })
  confirmUpload(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.mediaService.confirmUpload(user.workspaceId, id);
  }

  @Get()
  @ApiOperation({ summary: 'Lista todas as mídias do workspace' })
  findAll(@CurrentUser() user: AuthUser) {
    return this.mediaService.findAll(user.workspaceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe de uma mídia' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.mediaService.findOne(user.workspaceId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Renomeia uma mídia' })
  rename(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RenameMediaDto,
  ) {
    return this.mediaService.rename(user.workspaceId, id, dto.name!);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove uma mídia do workspace e storage' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.mediaService.remove(user.workspaceId, id);
  }
}
