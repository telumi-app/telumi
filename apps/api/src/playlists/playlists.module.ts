import { Module } from '@nestjs/common';

import { AuthModule } from '@/auth/auth.module';
import { StorageModule } from '@/media/storage/storage.module';
import { DatabaseModule } from '@/modules/database';

import { PlaylistsController } from './playlists.controller';
import { PlaylistsService } from './playlists.service';

@Module({
  imports: [DatabaseModule, AuthModule, StorageModule],
  controllers: [PlaylistsController],
  providers: [PlaylistsService],
  exports: [PlaylistsService],
})
export class PlaylistsModule {}
