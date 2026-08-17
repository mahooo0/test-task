import type { ItemType } from './enums';

/**
 * Fields a drive listing can be sorted by. Folders always group first regardless of the field;
 * the chosen field orders within each group. `modified` = `updatedAt`, `created` = `createdAt`,
 * `size` = `sizeBytes`.
 */
export type ItemSortField = 'name' | 'modified' | 'created' | 'size';

/** Sort direction for a drive listing. */
export type SortDirection = 'asc' | 'desc';

/** A folder or file node in the tree. File-only fields are null for folders. */
export interface ItemDto {
  id: string;
  dataRoomId: string;
  parentId: string | null;
  type: ItemType;
  name: string;
  /** File size in bytes; null for folders. */
  sizeBytes: number | null;
  /** MIME type; null for folders. */
  mimeType: string | null;
  createdAt: string;
  updatedAt: string;
  /** ISO timestamp of when the item was moved to Trash; null unless it's a trashed item. */
  deletedAt: string | null;
  /** Whether the item is starred (Google Drive "Помеченные"). */
  starred: boolean;
  /**
   * Whether this folder has at least one ACTIVE subfolder — lets the sidebar tree show an expand
   * affordance only for folders that can actually expand. Populated by folder-listing endpoints
   * (`false` for files there); `undefined` on endpoints that don't compute it.
   */
  hasSubfolders?: boolean;
}

/** A single hop in the breadcrumb trail from the room root down to an item. */
export interface BreadcrumbDto {
  id: string;
  name: string;
}

/**
 * Returned by the presign endpoint: the freshly-created PENDING file row plus a
 * time-limited URL the browser PUTs the bytes to directly (the API never proxies them).
 * The client uploads to `uploadUrl`, then calls finalize to flip the row to ACTIVE.
 */
export interface UploadTicketDto {
  item: ItemDto;
  uploadUrl: string;
  storageKey: string;
  /** ISO timestamp after which `uploadUrl` is no longer valid. */
  expiresAt: string;
}

/** A short-lived presigned URL for reading a stored file (inline preview or download). */
export interface ContentUrlDto {
  url: string;
  /** ISO timestamp after which `url` is no longer valid. */
  expiresAt: string;
}
