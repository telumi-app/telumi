import { Module } from '@nestjs/common';

import { AuthModule } from '@/auth/auth.module';
import { DatabaseModule } from '@/modules/database';

import { CapacityEngineService } from './capacity-engine.service';
import { CampaignSchedulingController, PlayerScreenController } from './campaign-scheduling.controller';
import { CampaignSchedulingService } from './campaign-scheduling.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [CampaignSchedulingController, PlayerScreenController],
  providers: [CampaignSchedulingService, CapacityEngineService],
  exports: [CampaignSchedulingService, CapacityEngineService],
})
export class CampaignSchedulingModule {}
