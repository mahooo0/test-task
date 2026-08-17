'use client';

import { useAuth } from '@clerk/nextjs';
import type { CreateShareBody, ShareDto, SharedResourceView } from '@dataroom/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { qk } from '@/lib/query-keys';
import { requireToken } from '@/lib/require-token';
import { sharesApi } from './api';

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
 * Ids of the resources the owner currently shares (active shares only — the API filters revoked).
 * Drives the "shared" badge on list rows / grid cards; one cached query for the whole drive.
 */
export function useMySharedResourceIds(): ReadonlySet<string> {
  const { getToken, isSignedIn } = useAuth();
  const { data } = useQuery({
    queryKey: qk.myShares,
    enabled: !!isSignedIn,
    queryFn: async (): Promise<ShareDto[]> => sharesApi.list(await requireToken(getToken)),
  });
  return useMemo(() => new Set((data ?? []).map((share) => share.resourceId)), [data]);
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
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: qk.itemShares(resourceId) });
    void qc.invalidateQueries({ queryKey: qk.myShares });
  };

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
