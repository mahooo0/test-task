/** Keyset (cursor) paginated response — scales to very large folders. */
export interface Paginated<T> {
  items: T[];
  /** Opaque cursor to fetch the next page, or null when there are no more items. */
  nextCursor: string | null;
}
