/** The authenticated user as exposed by the API (never includes secrets). */
export interface UserDto {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  createdAt: string;
}
