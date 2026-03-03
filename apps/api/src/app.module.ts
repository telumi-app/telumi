import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

import { AuthModule } from './auth/auth.module';
import { CampaignSchedulingModule } from './campaign-scheduling/campaign-scheduling.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { DevicesModule } from './devices/devices.module';
import { LocationsModule } from './locations/locations.module';
import { MediaModule } from './media/media.module';
import { DatabaseModule } from './modules/database';
import { HealthModule } from './modules/health/health.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { PlaylistsModule } from './playlists/playlists.module';
import { SchedulesModule } from './schedules/schedules.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 60,   // 1 minuto
        limit: 20,     // max 20 requests/min (default global)
      },
      {
        name: 'long',
        ttl: 600,  // 10 minutos
        limit: 100,    // max 100 requests/10min
      },
    ]),
    AuthModule,
    CampaignSchedulingModule,
    CampaignsModule,
    DatabaseModule,
    DevicesModule,
    HealthModule,
    LocationsModule,
    MediaModule,
    OnboardingModule,
    PlaylistsModule,
    SchedulesModule,
  ],
})
export class AppModule {}
