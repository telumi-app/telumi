import { Module, OnModuleInit, Inject, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { S3StorageProvider } from './s3-storage.provider';
import { STORAGE_PROVIDER, StorageProvider } from './storage.interface';

@Module({
  imports: [ConfigModule],
  providers: [
    S3StorageProvider,
    {
      provide: STORAGE_PROVIDER,
      useExisting: S3StorageProvider,
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule implements OnModuleInit {
  private readonly logger = new Logger(StorageModule.name);

  constructor(
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  async onModuleInit() {
    try {
      await this.storage.ensureBucket();
    } catch (err) {
      this.logger.warn(
        'Could not connect to object storage. Media uploads will fail until storage is available.',
      );
      this.logger.warn(err instanceof Error ? err.message : String(err));
    }
  }
}
