import type { ItemDto, ItemSortField, SortDirection } from '@dataroom/types';

/**
 * A stable client mirror of the drive's ordering: folders always group first (as the server lists
 * them), and within a group the chosen field then id order — both following the sort direction, as
 * the server's `ORDER BY type ASC, <col> <dir>, id <dir>` does. Used to interleave client-merged rows
 * (e.g. resources shared with you) into a server-sorted listing or search result.
 */
export function sortItems(items: ItemDto[], field: ItemSortField, dir: SortDirection): ItemDto[] {
  const factor = dir === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'FOLDER' ? -1 : 1;
    let cmp: number;
    switch (field) {
      case 'modified':
        cmp = a.updatedAt.localeCompare(b.updatedAt);
        break;
      case 'created':
        cmp = a.createdAt.localeCompare(b.createdAt);
        break;
      case 'size':
        cmp = (a.sizeBytes ?? 0) - (b.sizeBytes ?? 0);
        break;
      default:
        cmp = a.name.localeCompare(b.name, undefined, { numeric: true });
    }
    // id tie-break follows the direction too (server tie-breaks `id <dir>`).
    return (cmp || a.id.localeCompare(b.id)) * factor;
  });
}
