import type { Modifier } from '@dnd-kit/core';

/** How far below the pointer the chip's top edge sits, so it reads as "hanging" from the cursor. */
const CURSOR_GAP_Y = 8;

/**
 * Re-anchors the DragOverlay so the drag chip sits directly under the cursor — horizontally centred
 * on the pointer and hanging just below it — instead of staying pinned to the grabbed element's
 * top-left. dnd-kit's default keeps the overlay at the source's initial rect, so grabbing a tall
 * grid card near its bottom left the chip floating ~200px above the pointer.
 *
 * `draggingNodeRect` is the overlay's own (chip) rect: its width/height are the chip's, its left/top
 * are the source's initial top-left. `activatorEvent` is the pointer position at drag start and
 * `transform` the delta since, so the live pointer is `activator + transform`. Centring x on the
 * pointer (`- width/2`, as in dnd-kit's snapCenterToCursor) and offsetting y just below it makes the
 * chip track the cursor regardless of where inside the source the drag began.
 */
export const snapToCursor: Modifier = ({ activatorEvent, draggingNodeRect, transform }) => {
  if (!draggingNodeRect || !(activatorEvent instanceof MouseEvent)) return transform;
  return {
    ...transform,
    x: transform.x + activatorEvent.clientX - draggingNodeRect.left - draggingNodeRect.width / 2,
    y: transform.y + activatorEvent.clientY - draggingNodeRect.top + CURSOR_GAP_Y,
  };
};
