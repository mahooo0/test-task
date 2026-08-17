'use client';

import { useAuth } from '@clerk/nextjs';
import type { CreateShareBody, ShareDto, SharedResourceView } from '@dataroom/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/query-keys';
import { sharesApi } from './api';

async function requireToken(getToken: () => Promise<string | null>): Promise<string> {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated');
  return token;
}

/** The shares the owner has created for one item (drives the Share dialog's current state). */
export function useItemShares(resourceId: string, enabled = true) {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: qk.itemShares(resourceId),
    enabled: enabled && !!isSignedIn,
    queryFn: async (): Promise<ShareDto[]> =>
      sharesApi.list(await requireToken(getToken), resourceId),
  });
}

/**
 * Resources shared with the signed-in user — the "Доступно мне" feed. Polled (and refetched on tab
 * focus) so a resource shared while the app is open surfaces without a manual reload — this is what
 * drives the {@link NewShareNotifier}'s "shared with you" toast in the absence of a push channel.
 */
export function useSharedWithMe() {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: qk.sharedWithMe,
    enabled: !!isSignedIn,
    queryFn: async (): Promise<SharedResourceView[]> =>
      sharesApi.sharedWithMe(await requireToken(getToken)),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

/** Mutations for managing one resource's shares; each refreshes that resource's share list. */
export function useShareMutations(resourceId: string) {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: qk.itemShares(resourceId) });

  const create = useMutation({
    mutationFn: async (body: CreateShareBody) =>
      sharesApi.create(await requireToken(getToken), body),
    onSuccess: invalidate,
  });
  const revoke = useMutation({
    mutationFn: async (shareId: string) => sharesApi.revoke(await requireToken(getToken), shareId),
    onSuccess: invalidate,
  });
  const addGrants = useMutation({
    mutationFn: async (vars: { shareId: string; emails: string[] }) =>
      sharesApi.addGrants(await requireToken(getToken), vars.shareId, vars.emails),
    onSuccess: invalidate,
  });
  const removeGrant = useMutation({
    mutationFn: async (vars: { shareId: string; grantId: string }) =>
      sharesApi.removeGrant(await requireToken(getToken), vars.shareId, vars.grantId),
    onSuccess: invalidate,
  });
  return { create, revoke, addGrants, removeGrant };
}
