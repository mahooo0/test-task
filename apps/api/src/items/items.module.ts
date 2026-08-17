import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';

@Module({
  imports: [AuthModule, StorageModule], // ClerkAuthGuard + R2 presigning
  controllers: [ItemsController],
  providers: [ItemsService],
  // Exported so DataRoomsModule can reuse the subtree-stats CTE for room-root stats.
  exports: [ItemsService],
})
export class ItemsModule {}
