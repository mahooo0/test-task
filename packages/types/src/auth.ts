import type { UserDto } from './user';

/**
 * Response for register/login. The JWT itself lives only in the httpOnly
 * session cookie and is never returned in the body.
 */
export interface AuthResponseDto {
  user: UserDto;
}
