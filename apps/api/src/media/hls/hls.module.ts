import { Module } from '@nestjs/common';

import { DatabaseModule } from '@/modules/database';
import { StorageModule } from '@/media/storage/storage.module';

import { HlsController } from './hls.controller';

@Module({
  imports: [DatabaseModule, StorageModule],
  controllers: [HlsController],
})
export class HlsModule {}
