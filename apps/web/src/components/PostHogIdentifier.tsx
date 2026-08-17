'use client';

import { useUser } from '@clerk/nextjs';
import { useEffect } from 'react';
import posthog from 'posthog-js';

/**
 * Identifies the currently signed-in Clerk user in PostHog on every authenticated
 * page load. Placed in the authenticated app layout so returning visitors are
 * linked to their profile without requiring a fresh login.
 *
 * useEffect here is intentional: this is external-system synchronisation
 * (PostHog), the one accepted use of useEffect per the framework commandments.
 */
export function PostHogIdentifier() {
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (!isLoaded) return;

    if (user) {
      posthog.identify(user.id, {
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName ?? undefined,
      });
    } else {
      posthog.reset();
    }
  }, [isLoaded, user]);

  return null;
}
