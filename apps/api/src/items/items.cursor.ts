import type { ItemSortField, SortDirection } from '@dataroom/types';
import type { ItemType } from '@prisma/client';
import { AppException } from '../common/exceptions/app.exception';

/**
 * A keyset cursor for a drive listing. It carries the sort context (`sort`/`dir`) so a stale
 * cursor can't be replayed under a different order, plus the last row's position in the sort:
 * `(type, sortVal, id)`. `type` is always the leading key (folders first); `sortVal` is the
 * chosen column's value — the name (string), the `updatedAt` ISO string, or the size in bytes
 * (number) — and `id` is the tiebreak.
 */
export interface ItemCursor {
  sort: ItemSortField;
  dir: SortDirection;
  type: ItemType;
  sortVal: string | number;
  id: string;
}

/** Opaque, base64url-encoded cursor handed to the client. */
export function encodeCursor(cursor: ItemCursor): string {
  return Buffer.from(
    JSON.stringify([
      cursor.sort,
      cursor.dir,
      cursor.type,
      cursor.sortVal,
      cursor.id,
    ]),
  ).toString('base64url');
}

export function decodeCursor(raw: string): ItemCursor {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(raw, 'base64url').toString('utf8'),
    );
    if (!Array.isArray(parsed) || parsed.length !== 5) {
      throw new Error('bad shape');
    }
    const [sort, dir, type, sortVal, id] = parsed as unknown[];
    if (
      (sort !== 'name' &&
        sort !== 'modified' &&
        sort !== 'created' &&
        sort !== 'size') ||
      (dir !== 'asc' && dir !== 'desc') ||
      (type !== 'FOLDER' && type !== 'FILE') ||
      typeof id !== 'string' ||
      // Correlate sortVal's type/format with the field so a tampered cursor fails HERE (→ 400)
      // rather than exploding later in the query builder (BigInt()/::timestamp/enum cast → 500).
      !isValidSortVal(sort, sortVal)
    ) {
      throw new Error('bad types');
    }
    return { sort, dir, type, sortVal: sortVal as string | number, id };
  } catch {
    throw new AppException('cursor.invalid');
  }
}

/** The sort value must match its column: a finite number for size, a valid date for modified/created, a string for name. */
function isValidSortVal(sort: ItemSortField, val: unknown): boolean {
  if (sort === 'size') return typeof val === 'number' && Number.isFinite(val);
  if (sort === 'modified' || sort === 'created')
    return typeof val === 'string' && !Number.isNaN(Date.parse(val));
  return typeof val === 'string';
}
