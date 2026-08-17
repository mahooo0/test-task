import type { User } from '@prisma/client';
import type { UserDto } from '@dataroom/types';

/** Maps a Prisma User to the public-facing DTO (only the fields the client needs). */
export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
  };
}
