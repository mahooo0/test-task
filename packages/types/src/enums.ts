/** A node in the Data Room tree is either a folder or a file (Google Drive-style). */
export enum ItemType {
  FOLDER = 'FOLDER',
  FILE = 'FILE',
}

/**
 * Upload lifecycle of an Item. Files are created PENDING before the blob upload and
 * flipped to ACTIVE once it is confirmed; folders are ACTIVE from creation. Server-side
 * only — PENDING rows are never listed, so this never appears in {@link ItemDto}.
 */
export enum ItemStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
}

/** What a share points at: a whole Data Room, or a single Item (folder or file). */
export enum ShareResourceType {
  ROOM = 'ROOM',
  ITEM = 'ITEM',
}

/** Public link (anyone with the link) vs restricted (only invited users). */
export enum ShareMode {
  PUBLIC = 'PUBLIC',
  RESTRICTED = 'RESTRICTED',
}

/**
 * Access level granted by a share. Only VIEWER (read-only) is used in the MVP;
 * EDITOR is reserved so per-user roles can be added without remodeling.
 */
export enum ShareRole {
  VIEWER = 'VIEWER',
  EDITOR = 'EDITOR',
}
