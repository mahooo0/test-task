/** The identity attached to `req.user` by ClerkAuthGuard after a verified request. */
export interface AuthUser {
  /** Local (our DB) user id — used for ownership. */
  id: string;
  email: string;
  /** Clerk user id. */
  clerkId: string;
}
