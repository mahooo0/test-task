import type { SVGProps } from 'react';
import { cn } from '@/lib/utils';

/**
 * Google-Drive item glyphs (filled, single-path). Size with `size-*` and color with `text-*` —
 * both paths use `fill="currentColor"`, so the color follows the text color like a lucide icon.
 */

/**
 * Filled folder (Google Drive style). Defaults to Drive's neutral folder gray (`#5f6368`, identical
 * in light and dark); pass a `text-*` class to override. A parent that recolors its icons wins by
 * specificity (e.g. the sidebar tree's `[&>svg]` rule, and the active-nav pill).
 */
export function FolderGlyph({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={cn('shrink-0 text-[#5f6368]', className)}
      {...props}
    >
      <path d="M10,4H4C2.9,4,2.01,4.9,2.01,6L2,18c0,1.1,0.9,2,2,2h16c1.1,0,2-0.9,2-2V8c0-1.1-0.9-2-2-2h-8L10,4z" />
    </svg>
  );
}

/** PDF badge (Google Drive style) — the "PDF" letters are knocked out via even-odd fill. */
export function PdfGlyph({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
      className={cn('shrink-0', className)}
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M1.778 0h12.444C15.2 0 16 .8 16 1.778v12.444C16 15.2 15.2 16 14.222 16H1.778C.8 16 0 15.2 0 14.222V1.778C0 .8.8 0 1.778 0zm2.666 7.556h-.888v-.89h.888v.89zm1.334 0c0 .737-.596 1.333-1.334 1.333h-.888v1.778H2.222V5.333h2.222c.738 0 1.334.596 1.334 1.334v.889zm6.666-.89h2.223V5.334H11.11v5.334h1.333V8.889h1.334V7.556h-1.334v-.89zm-2.222 2.667c0 .738-.595 1.334-1.333 1.334H6.667V5.333h2.222c.738 0 1.333.596 1.333 1.334v2.666zm-1.333 0H8V6.667h.889v2.666z"
      />
    </svg>
  );
}
