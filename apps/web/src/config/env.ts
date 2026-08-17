/**
 * Client-visible config. `NEXT_PUBLIC_*` vars are inlined by Next at build time.
 * The Clerk publishable key is read directly by `@clerk/nextjs` from
 * `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, so it isn't re-exported here.
 */
export const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000',
};
