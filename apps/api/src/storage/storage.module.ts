import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';

/** Provides the R2/S3 presigning + cleanup wrapper to any feature that stores blobs. */
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
