import { Module } from '@nestjs/common';

import { TranscodeService } from './transcode.service';

@Module({
  providers: [TranscodeService],
  exports: [TranscodeService],
})
export class TranscodeModule {}
