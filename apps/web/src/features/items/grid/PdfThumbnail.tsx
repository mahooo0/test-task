'use client';

import type { ItemDto } from '@dataroom/types';
import { useEffect, useRef, useState } from 'react';
import { PdfGlyph } from '../icons';
import { usePdfThumbnail } from './use-pdf-thumbnail';

/** Shared framed preview box — the folder tile and file thumbnail use the same shell. */
export const previewFrameClass =
  'relative flex aspect-[4/3] items-center justify-center overflow-hidden border-b bg-muted/30';

/**
 * File preview area: lazily renders the PDF page-1 thumbnail once scrolled near
 * the viewport, with a shimmer while it loads and a PDF icon on skip/error.
 */
export function PdfThumbnail({ item }: { item: ItemDto }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '250px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [inView]);

  const thumb = usePdfThumbnail(item, inView);

  return (
    <div ref={ref} className={previewFrameClass}>
      {thumb.status === 'ready' ? (
        // Decorative — the filename is announced in the card footer. `draggable={false}` so
        // grabbing the thumbnail starts the card's item-drag, not a native image drag.
        <img
          src={thumb.dataUrl}
          alt=""
          draggable={false}
          className="h-full w-full bg-white object-contain object-top"
        />
      ) : thumb.status === 'idle' || thumb.status === 'loading' ? (
        <div className="h-full w-full animate-pulse bg-muted-foreground/10" />
      ) : (
        <PdfGlyph className="size-10 text-[#EA4335]" />
      )}
    </div>
  );
}
