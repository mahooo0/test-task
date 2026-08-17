/** Page size when the client doesn't send `limit` — shared by every listing surface. */
export const DEFAULT_PAGE_SIZE = 50;

/** `root`/absent ⇒ the root level (null sentinel); any other value is a specific folder id. */
export function normalizeParent(parentId?: string): string | null {
  return !parentId || parentId === 'root' ? null : parentId;
}
