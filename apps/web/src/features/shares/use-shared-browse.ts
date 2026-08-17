'use client';

import { useAuth } from '@clerk/nextjs';
import type { ItemDto, Paginated, SharedResourceView } from '@dataroom/types';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import type { PreviewSource } from '@/features/items/preview/pdf-preview';
import { displayPersonName } from '@/lib/utils';
import { sharesApi } from './api';

/** Where a shared browse reads from: an anonymous public link, or an invited grantee's share. */
export type SharedSource =
  | { kind: 'public'; token: string }
  | { kind: 'grantee'; shareId: string };

/** One level of the in-scope folder stack; `id: null` is the shared root. */
export interface SharedCrumb {
  id: string | null;
  name: string;
}

/**
 * The read-only browse over a shared resource, shared by the public `/s/[token]` page and the
 * signed-in inline "Доступно мне" drive. Owns the resolve + listing queries, the in-scope folder
 * stack, and a {@link PreviewSource} that reads a file's bytes through the same public/grantee
 * endpoints — so a shared file opens in the exact same in-app viewer as an owned one. All reads are
 * confined server-side to the share's scope, so callers never guard ids themselves.
 */
export function useSharedBrowse(source: SharedSource) {
  const { getToken } = useAuth();
  const key = source.kind === 'public' ? source.token : source.shareId;

  const resolve = useQuery({
    queryKey: ['shared-resolve', source.kind, key],
    queryFn: async (): Promise<SharedResourceView> =>
      source.kind === 'public'
        ? sharesApi.resolvePublic(source.token)
        : sharesApi.resolveGrantee(await getToken(), source.shareId),
    retry: false,
  });

  // Folder navigation stack (root = the shared root). Empty ⇒ at the shared root.
  const [stack, setStack] = useState<SharedCrumb[]>([]);
  const currentParent = stack.length > 0 ? stack[stack.length - 1].id : null;

  const list = useQuery({
    queryKey: ['shared-list', source.kind, key, currentParent],
    enabled: resolve.isSuccess,
    queryFn: async (): Promise<Paginated<ItemDto>> =>
      source.kind === 'public'
        ? sharesApi.publicList(source.token, currentParent, null, 100)
        : sharesApi.granteeList(await getToken(), source.shareId, currentParent, null, 100),
  });

  const view = resolve.data;
  const owner = view?.owner;
  const ownerName = owner ? displayPersonName(owner.name, owner.email) : '';

  const previewSource = useMemo<PreviewSource>(
    () => ({
      previewUrl: async (id) =>
        source.kind === 'public'
          ? (await sharesApi.publicPreviewUrl(source.token, id)).url
          : (await sharesApi.granteePreviewUrl(await getToken(), source.shareId, id)).url,
      downloadUrl: async (id) =>
        source.kind === 'public'
          ? (await sharesApi.publicDownloadUrl(source.token, id)).url
          : (await sharesApi.granteeDownloadUrl(await getToken(), source.shareId, id)).url,
      owner: owner ? { name: ownerName, avatarUrl: owner.avatarUrl } : undefined,
    }),
    [source, getToken, owner, ownerName],
  );

  // A file share has no listing — surface the single shared file as its own row.
  const isFileShare = view?.root?.type === 'FILE';
  const rows = isFileShare && view?.root ? [view.root] : (list.data?.items ?? []);

  return {
    resolve,
    list,
    view,
    ownerName,
    isFileShare,
    rows,
    stack,
    currentParent,
    previewSource,
    openFolder: (item: ItemDto) => setStack((prev) => [...prev, { id: item.id, name: item.name }]),
    goToRoot: () => setStack([]),
    goToCrumb: (index: number) => setStack((prev) => prev.slice(0, index + 1)),
  };
}
