'use client';

import { useAuth } from '@clerk/nextjs';
import {
  type InfiniteData,
  keepPreviousData,
  type QueryClient,
  type QueryKey,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  BreadcrumbDto,
  DataRoomDto,
  ItemDto,
  ItemSortField,
  Paginated,
  SortDirection,
  SubtreeStatsDto,
} from '@dataroom/types';
import { qk } from '@/lib/query-keys';
import { itemsApi, type UpdateItemBody } from './api';

/** Signed-in but the token isn't minted yet is transient — throw so React Query retries. */
async function requireToken(getToken: () => Promise<string | null>): Promise<string> {
  const token = await getToken();
  if (!token) throw new Error('Session token not ready');
  return token;
}

/** Everything a drive mutation can touch: listings, subtree stats, room stats, breadcrumbs, folder tree. */
export function invalidateDrive(queryClient: QueryClient): void {
  for (const key of [
    ['items'],
    ['subtree-stats'],
    ['room', 'stats'],
    ['breadcrumb'],
    ['folder-picker'],
    ['starred'],
    ['all-folders'],
  ]) {
    void queryClient.invalidateQueries({ queryKey: key });
  }
}

// ── Optimistic-cache plumbing ────────────────────────────────────────────────
// A drive item can appear in three caches at once: the paginated folder listings (`['items']`, one
// variant per sort/dir), the flat Starred list (`['starred']`), and its own details entry
// (`['item', id]`). These helpers apply an edit to all of them so the UI reflects a mutation the
// instant it's fired, and let the mutation snapshot/rollback that state if the PATCH fails.

/** One folder level as React Query caches it — the infinite query's page bag. */
type ItemsListing = InfiniteData<Paginated<ItemDto>>;

/** Cache prefixes an item edit is optimistically reflected into (and rolled back from on error). */
const ITEM_CACHE_PREFIXES: QueryKey[] = [['items'], ['starred'], ['item']];

/** Saved cache entries for the prefixes above, restored verbatim if the mutation fails. */
type DriveSnapshot = Array<[QueryKey, unknown]>;

/** Pause in-flight refetches so they can't overwrite the optimistic edit with stale server data. */
async function cancelItemQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all(ITEM_CACHE_PREFIXES.map((queryKey) => queryClient.cancelQueries({ queryKey })));
}

/** Snapshot every touched cache entry so `onError` can restore the pre-mutation state exactly. */
function snapshotItemQueries(queryClient: QueryClient): DriveSnapshot {
  return ITEM_CACHE_PREFIXES.flatMap((queryKey) => queryClient.getQueriesData({ queryKey }));
}

function restoreItemQueries(queryClient: QueryClient, snapshot: DriveSnapshot): void {
  for (const [queryKey, data] of snapshot) queryClient.setQueryData(queryKey, data);
}

/** The item's cached DTO from wherever it currently lives — used to read its `parentId` for scoped
 *  invalidation and to re-add it to the Starred list when starring. */
function findCachedItem(queryClient: QueryClient, id: string): ItemDto | undefined {
  for (const [, data] of queryClient.getQueriesData<ItemsListing>({ queryKey: ['items'] })) {
    const match = data?.pages.flatMap((page) => page.items).find((item) => item.id === id);
    if (match) return match;
  }
  for (const [, list] of queryClient.getQueriesData<ItemDto[]>({ queryKey: ['starred'] })) {
    const match = list?.find((item) => item.id === id);
    if (match) return match;
  }
  return queryClient.getQueryData<ItemDto>(qk.item(id));
}

/** Map the item across every cached folder listing; return `null` from `edit` to drop it (a move
 *  leaving its source folder). Untouched pages/lists keep their identity so React Query can skip
 *  re-rendering rows that didn't change. */
function mapListings(
  queryClient: QueryClient,
  id: string,
  edit: (item: ItemDto) => ItemDto | null,
): void {
  queryClient.setQueriesData<ItemsListing>({ queryKey: ['items'] }, (data) => {
    if (!data) return data;
    let dataChanged = false;
    const pages = data.pages.map((page) => {
      let pageChanged = false;
      const items = page.items.reduce<ItemDto[]>((acc, item) => {
        if (item.id !== id) {
          acc.push(item);
          return acc;
        }
        pageChanged = true;
        const next = edit(item);
        if (next) acc.push(next);
        return acc;
      }, []);
      if (!pageChanged) return page;
      dataChanged = true;
      return { ...page, items };
    });
    return dataChanged ? { ...data, pages } : data;
  });
}

/** Map the item across the flat Starred list(s); return `null` to remove it (unstar, or a move that
 *  should keep it — moves pass an updater, unstar passes `null`). */
function mapStarred(
  queryClient: QueryClient,
  id: string,
  edit: (item: ItemDto) => ItemDto | null,
): void {
  queryClient.setQueriesData<ItemDto[]>({ queryKey: ['starred'] }, (list) => {
    if (!list) return list;
    let changed = false;
    const next = list.reduce<ItemDto[]>((acc, item) => {
      if (item.id !== id) {
        acc.push(item);
        return acc;
      }
      changed = true;
      const edited = edit(item);
      if (edited) acc.push(edited);
      return acc;
    }, []);
    return changed ? next : list;
  });
}

/** Patch the item's own details entry in place (never removed — the panel just reflects the edit). */
function mapSingle(queryClient: QueryClient, id: string, edit: (item: ItemDto) => ItemDto): void {
  const single = queryClient.getQueryData<ItemDto>(qk.item(id));
  if (single) queryClient.setQueryData(qk.item(id), edit(single));
}

export function useRoom() {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: qk.room,
    enabled: isSignedIn === true,
    queryFn: async (): Promise<DataRoomDto> => itemsApi.getRoom(await requireToken(getToken)),
  });
}

/**
 * One folder level with keyset pagination; `parentId === null` is the room root. `sort`/`dir` are
 * part of the query key, so changing them starts a fresh keyset query from the first page.
 */
export function useDriveItems(
  parentId: string | null,
  sort: ItemSortField = 'name',
  dir: SortDirection = 'asc',
) {
  const { getToken, isSignedIn } = useAuth();
  return useInfiniteQuery({
    queryKey: qk.items(parentId, sort, dir),
    enabled: isSignedIn === true,
    // Keep the previous sort's rows (and the toolbar/sort controls) on screen during a re-sort
    // refetch instead of collapsing the whole view to a skeleton. `isPlaceholderData` can dim them.
    placeholderData: keepPreviousData,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) =>
      itemsApi.listChildren(await requireToken(getToken), parentId, pageParam, 50, sort, dir),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

/**
 * Flat, cross-folder name search for the ⌘K palette. Fires only for a non-empty term; keeps the
 * previous term's results on screen while the next keystroke's query is in flight (`keepPreviousData`),
 * so the list never flashes empty between keystrokes. Debounce the term at the call site.
 */
export function useItemSearch(query: string, limit = 20, enabled?: boolean) {
  const { getToken, isSignedIn } = useAuth();
  const q = query.trim();
  // Palette: fires only for a non-empty term (default). Results page: pass `enabled` explicitly so a
  // filter-only browse (empty term) still fetches the whole room.
  const shouldRun = enabled ?? q.length > 0;
  return useQuery({
    queryKey: qk.search(q, limit),
    enabled: isSignedIn === true && shouldRun,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<ItemDto[]> => itemsApi.search(await requireToken(getToken), q, limit),
  });
}

export function useBreadcrumb(itemId: string | null) {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: qk.breadcrumb(itemId ?? 'root'),
    enabled: isSignedIn === true && itemId !== null,
    queryFn: async (): Promise<BreadcrumbDto[]> =>
      itemsApi.breadcrumb(await requireToken(getToken), itemId as string),
  });
}

export function useSubtreeStats(itemId: string | null, enabled = true) {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: qk.subtreeStats(itemId ?? 'root'),
    enabled: isSignedIn === true && enabled && itemId !== null,
    queryFn: async (): Promise<SubtreeStatsDto> =>
      itemsApi.subtreeStats(await requireToken(getToken), itemId as string),
  });
}

/** A single item's metadata (used by the details panel for the current folder). */
export function useItem(itemId: string | null, enabled = true) {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: qk.item(itemId ?? 'root'),
    enabled: isSignedIn === true && enabled && itemId !== null,
    queryFn: async (): Promise<ItemDto> =>
      itemsApi.getItem(await requireToken(getToken), itemId as string),
  });
}

/** Whole-room file/folder counts + total size (details panel at the room root). */
export function useRoomStats() {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: qk.roomStats,
    enabled: isSignedIn === true,
    queryFn: async (): Promise<SubtreeStatsDto> =>
      itemsApi.getRoomStats(await requireToken(getToken)),
  });
}

/**
 * Folder-only children of a level, shared by the move-destination picker and the
 * sidebar folder tree. Capped at the first 100 children (no pagination yet — server-side
 * folder listing + "load more" is deferred to A6); folders sort ahead of files server-side,
 * so files never displace folders from that window.
 */
export function useFolderPicker(parentId: string | null, enabled: boolean) {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: qk.folderPicker(parentId),
    enabled: enabled && isSignedIn === true,
    queryFn: async (): Promise<ItemDto[]> => {
      const page = await itemsApi.listChildren(await requireToken(getToken), parentId, null, 100);
      return page.items.filter((item) => item.type === 'FOLDER');
    },
  });
}

export function useCreateFolder() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { parentId: string | null; name: string }): Promise<ItemDto> =>
      itemsApi.createFolder(await requireToken(getToken), vars.parentId, vars.name),
    onSuccess: () => invalidateDrive(queryClient),
  });
}

export function useRenameItem() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; name: string }): Promise<ItemDto> =>
      itemsApi.updateItem(await requireToken(getToken), vars.id, { name: vars.name }),
    // Show the new name instantly everywhere the item is listed; roll back if the PATCH is rejected.
    onMutate: async (vars) => {
      await cancelItemQueries(queryClient);
      const snapshot = snapshotItemQueries(queryClient);
      const parentId = findCachedItem(queryClient, vars.id)?.parentId ?? null;
      const rename = (item: ItemDto): ItemDto => ({ ...item, name: vars.name });
      mapListings(queryClient, vars.id, rename);
      mapStarred(queryClient, vars.id, rename);
      mapSingle(queryClient, vars.id, rename);
      return { snapshot, parentId };
    },
    onError: (_err, _vars, context) => {
      if (context) restoreItemQueries(queryClient, context.snapshot);
    },
    // Reconcile with the server: only the item's own folder can re-sort by the new name, so scope the
    // listing refetch to it; the name also surfaces in breadcrumbs, pickers and the home folder row.
    onSettled: (_data, _err, _vars, context) => {
      void queryClient.invalidateQueries({ queryKey: qk.itemsByParent(context?.parentId ?? null) });
      for (const key of [['breadcrumb'], ['folder-picker'], ['all-folders'], ['starred']]) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}

/** Move an item to `parentId`, optionally renaming it in the same PATCH (used to resolve a drop name-clash). */
export function useMoveItem() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      id: string;
      parentId: string | null;
      name?: string;
    }): Promise<ItemDto> => {
      const body: UpdateItemBody = { parentId: vars.parentId };
      if (vars.name !== undefined) body.name = vars.name;
      return itemsApi.updateItem(await requireToken(getToken), vars.id, body);
    },
    // Whisk the row out of its source folder immediately; the destination folder refetches it into
    // its correct sort slot on settle (we can't know that slot client-side). Roll back on failure.
    onMutate: async (vars) => {
      await cancelItemQueries(queryClient);
      const snapshot = snapshotItemQueries(queryClient);
      const sourceParentId = findCachedItem(queryClient, vars.id)?.parentId ?? null;
      const relocate = (item: ItemDto): ItemDto => ({
        ...item,
        parentId: vars.parentId,
        ...(vars.name !== undefined ? { name: vars.name } : {}),
      });
      mapListings(queryClient, vars.id, () => null); // gone from its old folder listing
      mapStarred(queryClient, vars.id, relocate); // still starred, just relocated
      mapSingle(queryClient, vars.id, relocate);
      return { snapshot, sourceParentId };
    },
    onError: (_err, _vars, context) => {
      if (context) restoreItemQueries(queryClient, context.snapshot);
    },
    // Refetch only the two folders whose contents actually changed; the move also shifts subtree
    // sizes, breadcrumb trails and the folder tree, so refresh those aggregates too.
    onSettled: (_data, _err, vars, context) => {
      void queryClient.invalidateQueries({
        queryKey: qk.itemsByParent(context?.sourceParentId ?? null),
      });
      void queryClient.invalidateQueries({ queryKey: qk.itemsByParent(vars.parentId) });
      for (const key of [
        ['subtree-stats'],
        ['breadcrumb'],
        ['folder-picker'],
        ['all-folders'],
        ['starred'],
      ]) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}

/** Move an item to the Trash (soft delete). Refreshes the drive listings and the Trash. */
export function useDeleteItem() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string }): Promise<void> =>
      itemsApi.deleteItem(await requireToken(getToken), vars.id),
    onSuccess: () => {
      invalidateDrive(queryClient);
      void queryClient.invalidateQueries({ queryKey: qk.trash });
    },
  });
}

/** The Trash — trashed roots for the whole room. */
export function useTrash() {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: qk.trash,
    enabled: isSignedIn === true,
    queryFn: async (): Promise<ItemDto[]> => itemsApi.listTrash(await requireToken(getToken)),
  });
}

/** Restore a trashed item back to the drive (returns it, renamed if a name clash was resolved). */
export function useRestoreItem() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string }): Promise<ItemDto> =>
      itemsApi.restoreItem(await requireToken(getToken), vars.id),
    onSuccess: () => {
      invalidateDrive(queryClient);
      void queryClient.invalidateQueries({ queryKey: qk.trash });
    },
  });
}

/** Permanently delete a single trashed item — irreversible. */
export function useDeleteForever() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string }): Promise<void> =>
      itemsApi.deleteForever(await requireToken(getToken), vars.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.trash });
      void queryClient.invalidateQueries({ queryKey: ['room', 'stats'] });
    },
  });
}

/** Empty the Trash — permanently delete everything in it. */
export function useEmptyTrash() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => itemsApi.emptyTrash(await requireToken(getToken)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.trash });
      void queryClient.invalidateQueries({ queryKey: ['room', 'stats'] });
    },
  });
}

/** The "Помеченные" view — every starred item in the room. */
export function useStarred() {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: qk.starred,
    enabled: isSignedIn === true,
    queryFn: async (): Promise<ItemDto[]> => itemsApi.listStarred(await requireToken(getToken)),
  });
}

/**
 * Up to `limit` folders from anywhere in the room — the home "Recommended folders" row. Uses the flat
 * search (empty term ⇒ the whole room, folders sorted first) so a folder stays listed no matter where
 * in the tree it lives; moving it between folders never drops it from the home page.
 */
export function useAllFolders(limit = 6) {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: qk.allFolders(limit),
    enabled: isSignedIn === true,
    queryFn: async (): Promise<{
      folders: ItemDto[];
      nameById: Record<string, string>;
    }> => {
      // Folders sort ahead of files; fetch the max so a shown folder's parent is in the name map too.
      const rows = await itemsApi.search(await requireToken(getToken), '', 50);
      const all = rows.filter((item) => item.type === 'FOLDER');
      // id → name, so each card can label its real parent folder (root ⇒ "My Drive" at the call site).
      const nameById: Record<string, string> = {};
      for (const folder of all) nameById[folder.id] = folder.name;
      return { folders: all.slice(0, limit), nameById };
    },
  });
}

/**
 * Star or unstar an item (via the item PATCH). Optimistic: the star flips instantly in every open
 * listing and in the Starred view — the most frequent micro-action must not wait on the round-trip —
 * and rolls back if the PATCH fails. Only the Starred view (membership changed) and the item's own
 * details entry are refetched on settle; the listings already hold the correct flag, so they aren't.
 */
export function useToggleStar() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; starred: boolean }): Promise<ItemDto> =>
      itemsApi.updateItem(await requireToken(getToken), vars.id, { starred: vars.starred }),
    onMutate: async (vars) => {
      await cancelItemQueries(queryClient);
      const snapshot = snapshotItemQueries(queryClient);
      const current = findCachedItem(queryClient, vars.id);
      const setFlag = (item: ItemDto): ItemDto => ({ ...item, starred: vars.starred });
      mapListings(queryClient, vars.id, setFlag);
      mapSingle(queryClient, vars.id, setFlag);
      // Keep the Starred view's membership in sync: drop the row on unstar, add it on star.
      if (vars.starred) {
        queryClient.setQueriesData<ItemDto[]>({ queryKey: ['starred'] }, (list) => {
          if (!list || !current || list.some((item) => item.id === vars.id)) return list;
          return [setFlag(current), ...list];
        });
      } else {
        mapStarred(queryClient, vars.id, () => null);
      }
      return { snapshot };
    },
    onError: (_err, _vars, context) => {
      if (context) restoreItemQueries(queryClient, context.snapshot);
    },
    onSettled: (_data, _err, vars) => {
      void queryClient.invalidateQueries({ queryKey: qk.starred });
      void queryClient.invalidateQueries({ queryKey: qk.item(vars.id) });
    },
  });
}

/** Download a stored file via a fresh presigned URL. (Opening is the in-app viewer — see usePdfPreview.) */
export function useFileActions() {
  const { getToken } = useAuth();
  return {
    download: async (id: string): Promise<void> => {
      const { url } = await itemsApi.downloadUrl(await requireToken(getToken), id);
      // The presigned URL carries `Content-Disposition: attachment`, so this saves the file.
      const a = document.createElement('a');
      a.href = url;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    },
  };
}
