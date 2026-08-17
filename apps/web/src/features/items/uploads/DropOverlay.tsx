'use client';

import { usePathname } from 'next/navigation';
import { EmptyState } from '../EmptyState';
import { useDropZone } from './drop-zone';

/** Current folder id from the route (`/folders/:id` → id; anything else → root). */
function useCurrentParentId(): string | null {
  const pathname = usePathname();
  const match = /^\/folders\/([^/]+)/.exec(pathname);
  return match ? match[1] : null;
}

/**
 * Full-screen drop target for pages that are *showing files*: while a file is dragged over the window
 * it covers the screen with the very same {@link EmptyState} (blue-highlighted, since a drag is
 * active). Suppressed when the page already renders an inline empty state — that one highlights in
 * place, so there's nothing to add. Purely visual: `pointer-events-none` lets the drop fall through
 * to the window handler in {@link import('./drop-zone').DropZoneProvider}.
 */
export function DropOverlay() {
  const { dragActive, hasEmptyState } = useDropZone();
  const parentId = useCurrentParentId();

  if (!dragActive || hasEmptyState) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-40 bg-background p-6 sm:p-10">
      <EmptyState parentId={parentId} onNewFolder={() => {}} asOverlay />
    </div>
  );
}
