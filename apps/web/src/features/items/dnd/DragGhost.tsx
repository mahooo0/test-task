'use client';

import type { ItemDto } from '@dataroom/types';
import { ItemIcon } from '../presentation';

/** The element that follows the cursor during a drag (rendered in dnd-kit's DragOverlay). */
export function DragGhost({ item }: { item: ItemDto }) {
  return (
    <div className="flex w-fit max-w-64 items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm shadow-lg">
      <ItemIcon item={item} className="size-4" />
      <span className="truncate">{item.name}</span>
    </div>
  );
}
