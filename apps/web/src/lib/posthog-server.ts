import { PostHog } from 'posthog-node';

let posthogClient: PostHog | null = null;

export function getPostHogClient(): PostHog {
  if (!posthogClient) {
    const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    if (!token) {
      if (process.env.NODE_ENV !== 'production') {
        console.error(
          'NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, ' +
            'this causes events to be silently missed. ' +
            'This error stops appearing once NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured',
        );
      }
      // Return a no-op placeholder so callers don't need to guard every usage.
      return {
        capture: () => {},
        identify: () => {},
        flush: async () => {},
        shutdown: async () => {},
      } as unknown as PostHog;
    }
    posthogClient = new PostHog(token, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return posthogClient;
}
