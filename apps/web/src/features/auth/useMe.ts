'use client';

import { useAuth } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import type { UserDto } from '@dataroom/types';
import { api } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';

/** Loads the local user (provisioned on first hit by the API's Clerk guard). */
export function useMe() {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: qk.me,
    enabled: isSignedIn === true,
    queryFn: async (): Promise<UserDto> => {
      const token = await getToken();
      if (!token) {
        // Signed in, but Clerk hasn't minted the token yet — transient. Throw a
        // non-ApiError so React Query retries instead of hitting the API with no
        // auth and surfacing a spurious 401.
        throw new Error('Session token not ready');
      }
      return api.get<UserDto>('/api/me', token);
    },
  });
}
