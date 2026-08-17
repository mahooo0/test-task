import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ItemsModule } from '../items/items.module';
import { PublicSharesController } from './public-shares.controller';
import { SharedController } from './shared.controller';
import { SharesController } from './shares.controller';
import { SharesService } from './shares.service';

@Module({
  // ClerkAuthGuard for owner/grantee routes; ItemsService (room-scoped reads) for the shared surface.
  imports: [AuthModule, ItemsModule],
  controllers: [SharesController, SharedController, PublicSharesController],
  providers: [SharesService],
  exports: [SharesService],
})
export class SharesModule {}
