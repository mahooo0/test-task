'use client';

import { useAuth } from '@clerk/nextjs';
import type { ItemDto } from '@dataroom/types';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { usePdfPreview } from '@/features/items/preview/pdf-preview';
import { ownerKeyFromShare } from '@/features/search/filters';
import { displayPersonName } from '@/lib/utils';
import { sharesApi } from './api';
import { useSharedWithMe } from './hooks';
import type { SharedEntryMeta } from './SharedDriveRows';

/** A resource shared with the caller, shaped to sit as a read-only row inside their own drive. */
export interface SharedDriveEntry {
  item: ItemDto;
  meta: SharedEntryMeta;
  /** Stable key identifying the owner (for the People filter). */
  ownerKey: string;
}

/**
 * Surfaces the resources shared *with* the caller as read-only drive entries — so they can be mixed
 * into their own drive listing and search results with the sharer shown as owner. Only ITEM shares
 * (a shared file/folder, `root != null`) map to a row; a whole-room share has no single item and is
 * left to the "Доступно мне" browse. {@link openEntry} opens one the same way as elsewhere: a folder
 * navigates to its inline browse, a file opens in the PDF viewer via the grantee endpoints.
 */
export function useSharedDrive() {
  const { data, isLoading } = useSharedWithMe();
  const { getToken } = useAuth();
  const preview = usePdfPreview();
  const router = useRouter();

  const entries = useMemo<SharedDriveEntry[]>(() => {
    return (data ?? [])
      .filter((share) => share.root != null)
      .map((share) => ({
        item: share.root as ItemDto,
        meta: {
          shareId: share.shareId,
          owner: {
            name: displayPersonName(share.owner.name, share.owner.email),
            avatarUrl: share.owner.avatarUrl,
          },
        },
        ownerKey: ownerKeyFromShare(share.owner),
      }));
  }, [data]);

  const sharedItems = useMemo(() => entries.map((e) => e.item), [entries]);
  const sharedMeta = useMemo(
    () => new Map(entries.map((e) => [e.item.id, e.meta] as const)),
    [entries],
  );
  const ownerKeyById = useMemo(
    () => new Map(entries.map((e) => [e.item.id, e.ownerKey] as const)),
    [entries],
  );

  const openEntry = useCallback(
    (item: ItemDto, meta: SharedEntryMeta) => {
      if (item.type === 'FOLDER') {
        router.push(`/personal?share=${encodeURIComponent(meta.shareId)}`);
        return;
      }
      preview.open(item, {
        previewUrl: async (id) =>
          (await sharesApi.granteePreviewUrl(await getToken(), meta.shareId, id)).url,
        downloadUrl: async (id) =>
          (await sharesApi.granteeDownloadUrl(await getToken(), meta.shareId, id)).url,
        owner: meta.owner,
      });
    },
    [router, preview, getToken],
  );

  return { entries, sharedItems, sharedMeta, ownerKeyById, openEntry, isLoading };
}
