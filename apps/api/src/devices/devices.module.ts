import { Module } from '@nestjs/common';

import { AuthModule } from '@/auth/auth.module';
import { StorageModule } from '@/media/storage/storage.module';
import { DatabaseModule } from '@/modules/database';

import { DevicesController } from './devices.controller';
import { DevicesPublicController } from './devices-public.controller';
import { DevicesStreamController } from './devices-stream.controller';
import { DevicesService } from './devices.service';

@Module({
  imports: [DatabaseModule, AuthModule, StorageModule],
  controllers: [DevicesController, DevicesPublicController, DevicesStreamController],
  providers: [DevicesService],
  exports: [DevicesService],
})
export class DevicesModule { }
