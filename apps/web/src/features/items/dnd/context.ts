'use client';

import type { ItemDto } from '@dataroom/types';
import { createContext, useContext } from 'react';

/**
 * The shared DnD contract + the lightweight active-drag signal. Kept in this leaf module (rather
 * than in `DriveDndProvider`) so the drop hooks — and the five drag/drop surfaces that use them —
 * don't transitively import the whole provider (DndContext, overlay, dialog, mutation) just for a
 * couple of types and a one-line context read.
 */

/** Attached to a draggable source (`useDraggable({ data })`). */
export interface DragItemData {
  item: ItemDto;
}

/** Attached to a droppable target (`useDroppable({ data })`). `parentId` is the move destination; `name` is its display label (folder name, or "My Drive" for the root) — used in toasts and the clash dialog. */
export interface DropTargetData {
  parentId: string | null;
  name: string;
}

/**
 * The item currently being dragged (or null). Updated only on drag start/end — NOT on every pointer
 * move — so a droppable can compute its "valid target" state without subscribing to the full dnd
 * context (which changes every move and would re-render every droppable on every move).
 */
export const ActiveDragContext = createContext<ItemDto | null>(null);

export function useActiveDragItem(): ItemDto | null {
  return useContext(ActiveDragContext);
}
