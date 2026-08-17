import { Controller, Get, UseGuards } from '@nestjs/common';
import type { UserDto } from '@dataroom/types';
import { ClerkAuthGuard } from '../common/guards/clerk-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user';
import { UsersService } from '../users/users.service';
import { toUserDto } from '../users/users.mapper';

@Controller('me')
@UseGuards(ClerkAuthGuard)
export class AuthController {
  constructor(private readonly users: UsersService) {}

  /** Hydrates the SPA: returns the current (local) user, provisioned on first hit. */
  @Get()
  async me(@CurrentUser() authUser: AuthUser): Promise<UserDto> {
    const user = await this.users.findByIdOrThrow(authUser.id);
    return toUserDto(user);
  }
}
