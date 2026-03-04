import { Module } from '@nestjs/common';

import { AuthModule } from '@/auth/auth.module';
import { DatabaseModule } from '@/modules/database';

import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { StorageModule } from './storage/storage.module';
import { TranscodeModule } from './transcode';

@Module({
  imports: [DatabaseModule, AuthModule, StorageModule, TranscodeModule],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
