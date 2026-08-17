'use client';

import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { ItemDto } from '@dataroom/types';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { type DragItemData, type DropTargetData, useActiveDragItem } from './context';

/**
 * Tailwind classes for a valid drop target hovered by a drag. `ring-inset` (not an outset ring) so
 * the highlight is never clipped by an `overflow-hidden` ancestor (e.g. the grid card) and stays
 * consistent across every surface — rows, cards, breadcrumbs, tree nodes, the sidebar root.
 */
export const DROP_HIGHLIGHT = 'bg-primary/10 ring-2 ring-primary ring-inset';

/**
 * A folder id → its `parentId`, harvested from the sidebar folder-tree data cached under the
 * `folder-picker` query key (each level is a flat `ItemDto[]`, and the tree is the only surface where
 * a folder's own descendants render as drop targets). Lets {@link useDropValidity} walk a
 * destination's ancestry. Rebuilt once per drag (keyed on the dragged id), not on every pointer move.
 */
function useFolderParents(draggedId: string | undefined): Map<string, string | null> {
  const queryClient = useQueryClient();
  return useMemo(() => {
    const parentOf = new Map<string, string | null>();
    if (!draggedId) return parentOf;
    for (const [, folders] of queryClient.getQueriesData<ItemDto[]>({ queryKey: ['folder-picker'] })) {
      if (!folders) continue;
      for (const folder of folders) parentOf.set(folder.id, folder.parentId);
    }
    return parentOf;
  }, [queryClient, draggedId]);
}

/**
 * True when the item currently being dragged can validly move into `parentId` — i.e. not onto itself,
 * not into the folder it already lives in (a no-op), and — for a folder — not into any folder within
 * its own subtree (a cycle). The server also rejects the cycle with a 400 on drop, but checking it
 * here stops the hover highlight from flashing green on a target that will be refused. Reads the
 * lightweight active-drag context (stable during a drag), not the full dnd context.
 */
function useDropValidity(parentId: string | null): boolean {
  const dragged = useActiveDragItem();
  const parentOf = useFolderParents(dragged?.id);
  if (!dragged) return false;
  if (dragged.id === parentId || dragged.parentId === parentId) return false;
  // Folder-into-own-descendant: walk the destination up to the root; if the dragged folder is on
  // that path, the destination lives inside it and the move would create a cycle.
  if (dragged.type === 'FOLDER') {
    for (let ancestor = parentId; ancestor != null; ancestor = parentOf.get(ancestor) ?? null) {
      if (ancestor === dragged.id) return false;
    }
  }
  return true;
}

/**
 * A droppable move destination that is NOT itself a drive item — a breadcrumb crumb or a sidebar
 * tree node. `highlight` is true only while a *valid* drag hovers it. `id` must be unique across the
 * whole DnD context (namespace it, e.g. `crumb:<id>` / `tree:<id>`); `parentId` is the destination
 * and `name` its display label (used in the move toast + clash dialog).
 */
export function useDropTarget(id: string, parentId: string | null, name: string) {
  const valid = useDropValidity(parentId);
  const { setNodeRef, isOver } = useDroppable({ id, data: { parentId, name } satisfies DropTargetData });
  return { setNodeRef, highlight: isOver && valid };
}

/**
 * A drive item (list row / grid card): always a drag source, and — for folders only — also a drop
 * destination. Merges the draggable + droppable refs onto one node. `highlight` is true while a valid
 * drag hovers this folder; `isDragging` dims the source.
 */
export function useItemDnd(item: ItemDto) {
  const isFolder = item.type === 'FOLDER';
  const { setNodeRef: setDragRef, listeners, isDragging } = useDraggable({
    id: item.id,
    data: { item } satisfies DragItemData,
  });
  const valid = useDropValidity(item.id);
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `item:${item.id}`,
    data: { parentId: item.id, name: item.name } satisfies DropTargetData,
    disabled: !isFolder,
  });
  // The same node is both the drag source and (for folders) the drop target — merge the two refs.
  const setNodeRef = useCallback(
    (node: HTMLElement | null) => {
      // Let the sensors own the gesture instead of the browser scrolling the touch away.
      if (node) node.style.touchAction = 'none';
      setDragRef(node);
      setDropRef(node);
    },
    [setDragRef, setDropRef],
  );
  return { setNodeRef, listeners, isDragging, highlight: isFolder && isOver && valid };
}

/**
 * A sidebar folder-tree node: both a drag source (so a folder can be moved straight from the tree)
 * and a drop destination (drop another item onto it to move it inside). Its draggable and droppable
 * share one `tree:<id>` id — dnd-kit keeps those in separate registries, the standard sortable
 * pattern — kept namespaced apart from the same folder's drive-row ids (`<id>` / `item:<id>`) so the
 * folder can register as a source in both places at once without an id collision.
 */
export function useSidebarFolderDnd(item: ItemDto) {
  const id = `tree:${item.id}`;
  const { setNodeRef: setDragRef, listeners, isDragging } = useDraggable({
    id,
    data: { item } satisfies DragItemData,
  });
  const valid = useDropValidity(item.id);
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id,
    data: { parentId: item.id, name: item.name } satisfies DropTargetData,
  });
  const setNodeRef = useCallback(
    (node: HTMLElement | null) => {
      // Let the sensors own the gesture instead of the browser scrolling the touch away.
      if (node) node.style.touchAction = 'none';
      setDragRef(node);
      setDropRef(node);
    },
    [setDragRef, setDropRef],
  );
  return { setNodeRef, listeners, isDragging, highlight: isOver && valid };
}
