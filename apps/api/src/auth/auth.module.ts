import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { ClerkAuthGuard } from '../common/guards/clerk-auth.guard';
import { AuthController } from './auth.controller';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [ClerkAuthGuard],
  // Feature modules (items, data-rooms) import AuthModule to guard their owner routes.
  // Re-export UsersModule too: the guard is instantiated in the consumer's injector and
  // depends on UsersService, so that dependency must travel with it.
  exports: [ClerkAuthGuard, UsersModule],
})
export class AuthModule {}
