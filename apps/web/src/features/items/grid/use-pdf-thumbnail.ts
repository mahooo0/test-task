'use client';

import { useAuth } from '@clerk/nextjs';
import type { ItemDto } from '@dataroom/types';
import { useEffect, useState } from 'react';
import { getCachedThumbnail, loadThumbnail } from './pdf-thumbnail-cache';

/** PDFs larger than this skip a real thumbnail — rendering would download the whole file. */
const MAX_THUMBNAIL_BYTES = 20 * 1024 * 1024;

export type PdfThumbnail =
  | { status: 'idle' | 'loading' | 'error' | 'skipped' }
  | { status: 'ready'; dataUrl: string };

function isThumbnailable(item: ItemDto): boolean {
  return (
    item.type === 'FILE' &&
    item.mimeType === 'application/pdf' &&
    (item.sizeBytes ?? 0) <= MAX_THUMBNAIL_BYTES
  );
}

/**
 * Page-1 thumbnail for a file. Rendering starts only once `enabled` (the card is
 * near the viewport). Folders, non-PDFs, and oversize PDFs resolve to `skipped`;
 * an already-cached thumbnail is returned immediately regardless of `enabled`.
 */
export function usePdfThumbnail(item: ItemDto, enabled: boolean): PdfThumbnail {
  const { getToken } = useAuth();
  const thumbnailable = isThumbnailable(item);

  const [state, setState] = useState<PdfThumbnail>(() =>
    thumbnailable ? (getCachedThumbnail(item.id) ?? { status: 'idle' }) : { status: 'skipped' },
  );

  useEffect(() => {
    if (!thumbnailable) {
      setState({ status: 'skipped' });
      return;
    }
    const cached = getCachedThumbnail(item.id);
    if (cached && cached.status !== 'loading') {
      setState(cached);
      return;
    }
    if (!enabled) {
      setState({ status: 'idle' });
      return;
    }

    let alive = true;
    setState({ status: 'loading' });
    loadThumbnail(item.id, getToken).then((result) => {
      if (alive) setState(result);
    });
    return () => {
      alive = false;
    };
  }, [item.id, thumbnailable, enabled, getToken]);

  return state;
}
