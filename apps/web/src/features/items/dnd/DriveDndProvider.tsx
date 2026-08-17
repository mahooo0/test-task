'use client';

import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { ItemDto } from '@dataroom/types';
import { useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';
import { toast } from 'sonner';
import { conflictSuggestion, errorMessage } from '../errors';
import { useMoveItem } from '../hooks';
import { ActiveDragContext, type DragItemData, type DropTargetData } from './context';
import { DragGhost } from './DragGhost';
import { snapToCursor } from './modifiers';
import { type MoveConflict, MoveConflictDialog } from './MoveConflictDialog';

/**
 * Owns the single DnD context for the whole app so a drive item can be dragged onto a
 * sidebar-tree node (they live in separate subtrees; this wraps both). Sources register with
 * `useDraggable`, targets with `useDroppable`; the drop → move logic lands in W6, the name-clash
 * dialog in W7. A distance constraint on the mouse sensor keeps a plain click from starting a drag.
 */
export function DriveDndProvider({ children }: { children: ReactNode }) {
  const t = useTranslations('dialogs');
  // Mouse keeps the click-vs-drag distance threshold; a separate touch sensor with an activation
  // delay lets a tap or scroll through before a drag starts (a single Pointer sensor can't give touch
  // its own delay, and Pointer + Touch together would double-fire). Keyboard makes a drag reachable
  // without a pointer. Draggables also set `touch-action: none` (use-drop.ts) so the browser doesn't
  // steal a touch-drag as a scroll.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const [activeItem, setActiveItem] = useState<ItemDto | null>(null);
  const [conflict, setConflict] = useState<MoveConflict | null>(null);
  const move = useMoveItem();

  function onDragStart(event: DragStartEvent) {
    const data = event.active.data.current as DragItemData | undefined;
    setActiveItem(data?.item ?? null);
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveItem(null);
    const item = (event.active.data.current as DragItemData | undefined)?.item;
    const target = event.over?.data.current as DropTargetData | undefined;
    if (!item || !target) return;
    const { parentId, name: destName } = target;
    // Skip no-ops: dropping onto its current folder, or a folder onto itself.
    if (parentId === item.parentId || parentId === item.id) return;

    move.mutate(
      { id: item.id, parentId },
      {
        onSuccess: () =>
          toast.success(t('moved', { name: item.name, destination: destName }), {
            // The item's pre-move parent is still captured here — offer a one-tap move back.
            action: {
              label: t('undo'),
              onClick: () =>
                move.mutate(
                  { id: item.id, parentId: item.parentId },
                  { onError: (err) => toast.error(errorMessage(err, t('moveFailed'))) },
                ),
            },
          }),
        onError: (err) => {
          // Name clash → resolve via a rename dialog; the 400 folder-cycle guard just toasts its message.
          const suggestion = conflictSuggestion(err);
          if (suggestion) setConflict({ item, parentId, destName, suggestedName: suggestion });
          else toast.error(errorMessage(err, t('moveFailed')));
        },
      },
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveItem(null)}
    >
      <ActiveDragContext.Provider value={activeItem}>{children}</ActiveDragContext.Provider>
      <DragOverlay dropAnimation={null} modifiers={[snapToCursor]}>
        {activeItem ? <DragGhost item={activeItem} /> : null}
      </DragOverlay>
      <MoveConflictDialog conflict={conflict} onClose={() => setConflict(null)} />
    </DndContext>
  );
}
