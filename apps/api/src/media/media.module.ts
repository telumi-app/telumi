import { Module } from '@nestjs/common';

import { AuthModule } from '@/auth/auth.module';
import { DatabaseModule } from '@/modules/database';

import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [DatabaseModule, AuthModule, StorageModule],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
