'use client';

import { usePathname } from 'next/navigation';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { pickedFromDataTransfer } from './upload-helpers';
import { useUploads } from './uploads-context';

interface DropZoneContextValue {
  /** A file/folder is currently being dragged over the window. */
  dragActive: boolean;
  /** An inline <EmptyState/> is on the page, so the full-screen overlay stays hidden (it highlights). */
  hasEmptyState: boolean;
  /** An inline <EmptyState/> announces itself on mount; returns its unregister callback. */
  registerEmptyState: () => () => void;
}

const DropZoneContext = createContext<DropZoneContextValue | null>(null);

/** Current folder id from the route (`/folders/:id` → id; anything else → root). */
function useCurrentParentId(): string | null {
  const pathname = usePathname();
  const match = /^\/folders\/([^/]+)/.exec(pathname);
  return match ? match[1] : null;
}

/**
 * App-wide file-drop coordinator. Tracks whether files are being dragged over the window and routes
 * the drop into the current folder's upload queue. Pages showing an inline {@link
 * import('../EmptyState').EmptyState} register through here, so the full-screen {@link
 * import('./DropOverlay').DropOverlay} knows to stay hidden and let that inline state highlight in
 * place instead.
 */
export function DropZoneProvider({ children }: { children: ReactNode }) {
  const { enqueue } = useUploads();
  const parentId = useCurrentParentId();
  const parentRef = useRef(parentId);
  parentRef.current = parentId;

  const [dragActive, setDragActive] = useState(false);
  // dragenter/dragleave fire for every nested element; count them so leaving a child doesn't clear.
  const depth = useRef(0);

  const [emptyStateCount, setEmptyStateCount] = useState(0);
  const registerEmptyState = useCallback(() => {
    setEmptyStateCount((n) => n + 1);
    return () => setEmptyStateCount((n) => Math.max(0, n - 1));
  }, []);

  useEffect(() => {
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');

    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current += 1;
      setDragActive(true);
    };
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault(); // required for `drop` to fire
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth.current -= 1;
      if (depth.current <= 0) {
        depth.current = 0;
        setDragActive(false);
      }
    };
    const onDrop = (e: DragEvent) => {
      if (!e.dataTransfer) return;
      e.preventDefault();
      depth.current = 0;
      setDragActive(false);
      void pickedFromDataTransfer(e.dataTransfer).then((picked) =>
        enqueue(picked, parentRef.current),
      );
    };

    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragover', onOver);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [enqueue]);

  const value = useMemo<DropZoneContextValue>(
    () => ({ dragActive, hasEmptyState: emptyStateCount > 0, registerEmptyState }),
    [dragActive, emptyStateCount, registerEmptyState],
  );

  return <DropZoneContext.Provider value={value}>{children}</DropZoneContext.Provider>;
}

export function useDropZone(): DropZoneContextValue {
  const ctx = useContext(DropZoneContext);
  if (!ctx) throw new Error('useDropZone must be used within a DropZoneProvider');
  return ctx;
}
