import type { ItemSortField, SortDirection } from '@dataroom/types';

/** Centralized React Query key factory — one source of truth for cache keys. */
export const qk = {
  room: ['room'] as const,
  roomStats: ['room', 'stats'] as const,
  /**
   * One folder level; `null` parent is the room root. The sort field + direction are part of the
   * key so re-sorting starts a fresh keyset query (cursor resets); `invalidateDrive` still matches
   * every variant via the `['items']` prefix.
   */
  items: (parentId: string | null, sort: ItemSortField = 'name', dir: SortDirection = 'asc') =>
    ['items', parentId ?? 'root', sort, dir] as const,
  /**
   * Prefix matching every sort/dir variant of one folder's listing — lets a mutation invalidate (or
   * refetch) just the folders it touched instead of the whole `['items']` tree. Same head as
   * {@link items}, so `invalidateDrive`'s broad `['items']` match still covers it too.
   */
  itemsByParent: (parentId: string | null) => ['items', parentId ?? 'root'] as const,
  /** Flat, cross-folder name search; keyed by the trimmed term + result cap (palette vs results page). */
  search: (query: string, limit = 20) => ['search', query, limit] as const,
  breadcrumb: (itemId: string) => ['breadcrumb', itemId] as const,
  subtreeStats: (itemId: string) => ['subtree-stats', itemId] as const,
  /** A single item's metadata (details panel). */
  item: (itemId: string) => ['item', itemId] as const,
  /** Folder-only children of a level; `null` parent is the room root. */
  folderPicker: (parentId: string | null) => ['folder-picker', parentId ?? 'root'] as const,
  /** The Trash — trashed roots for the whole room. */
  trash: ['trash'] as const,
  /** The "Помеченные" view — starred items for the whole room. */
  starred: ['starred'] as const,
  /** Up to `limit` folders from anywhere in the room — the home "Recommended folders" row. */
  allFolders: (limit: number) => ['all-folders', limit] as const,
  /** Shares the owner has created for one resource (item or room). */
  itemShares: (resourceId: string) => ['shares', resourceId] as const,
  /** Every active share the owner has created — drives the per-row "shared" badge. */
  myShares: ['my-shares'] as const,
  /** Resources shared with the current user ("Доступно мне"). */
  sharedWithMe: ['shared-with-me'] as const,
};
