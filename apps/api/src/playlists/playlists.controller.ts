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

import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';
import { PlaylistsService } from './playlists.service';

@ApiTags('Playlists')
@Controller('playlists')
@UseGuards(JwtAuthGuard)
export class PlaylistsController {
  constructor(private readonly playlistsService: PlaylistsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista playlists do workspace' })
  findAll(@CurrentUser() user: AuthUser) {
    return this.playlistsService.findAll(user.workspaceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe de uma playlist' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.playlistsService.findOne(user.workspaceId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Cria uma nova playlist' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePlaylistDto) {
    return this.playlistsService.create(user.workspaceId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza uma playlist' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdatePlaylistDto,
  ) {
    return this.playlistsService.update(user.workspaceId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove uma playlist' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.playlistsService.remove(user.workspaceId, id);
  }
}
