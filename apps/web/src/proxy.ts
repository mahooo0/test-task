import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Next 16 "proxy" convention (formerly middleware). Everything except the auth
// screens requires a session. `auth.protect()` redirects anonymous users to
// NEXT_PUBLIC_CLERK_SIGN_IN_URL (/sign-in).
// `/s/:token` is the anonymous public-share page — it must stay reachable without a session.
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/sso-callback(.*)',
  '/s/(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next internals, the PostHog /ingest reverse-proxy (telemetry needs no session —
    // and protect() would swallow the POSTs into an HTML 404), and static files.
    '/((?!_next|ingest|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API/tRPC routes (none yet, but keeps the guard total).
    '/(api|trpc)(.*)',
  ],
};
