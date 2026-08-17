'use client';

import { GripVertical } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type KeyboardEvent, type PointerEvent, useCallback, useRef } from 'react';
import { useSidebar } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Sidebar width lives entirely in a CSS variable on <html> (`--app-sidebar-width`, seeded pre-paint
 * by the no-flash script in `layout.tsx`) plus localStorage — never React state. A resize drag
 * therefore mutates one CSS var per pointer-move and never re-renders the app tree, the same reason
 * the DnD layer keeps its active item out of the per-move render path.
 */
const STORAGE_KEY = 'sidebar-width';
const WIDTH_VAR = '--app-sidebar-width';
const DEFAULT_WIDTH = 256; // 16rem — matches SidebarProvider's built-in default.
const MIN_WIDTH = 208; // 13rem — keep in sync with the clamp in layout.tsx's no-flash script.
const MAX_WIDTH = 480; // 30rem
const KEYBOARD_STEP = 16;
// The sidebar never resizes narrower than MIN_WIDTH — pull the grip left and it holds at the minimum.
// To actually close it you have to keep pulling past that hold; once the cursor is COLLAPSE_OVERPULL
// beyond the minimum the panel snaps straight to the icon rail (labels hidden, icons only) under the
// cursor. Drag back out past COLLAPSE_EXIT and it re-expands to the minimum — the gap between the two
// thresholds is hysteresis so it can't flicker open/closed while you hover the edge.
const COLLAPSE_OVERPULL = 72;
const COLLAPSE_ENTER = MIN_WIDTH - COLLAPSE_OVERPULL; // pull this narrow → snap to the icon rail
const COLLAPSE_EXIT = MIN_WIDTH - 24; // drag back out to here → re-expand to the minimum

/** Widths stay in the usable range: the panel can't resize below MIN or above MAX. */
const clampWidth = (px: number) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(px)));

/** Current width from the live CSS var, falling back to the default when it hasn't been set yet. */
function readWidth(): number {
  const raw = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(WIDTH_VAR));
  return Number.isFinite(raw) ? raw : DEFAULT_WIDTH;
}

/**
 * Grip on the sidebar's right edge: drag it to resize, arrow-keys to nudge, double-click to reset.
 * Dragging holds at the minimum width; pulling past it collapses the sidebar to the icon rail.
 * Hidden when the sidebar is collapsed to icons or on mobile (there it's a full-width sheet).
 */
export function SidebarResizeHandle() {
  const t = useTranslations('common');
  const { state, isMobile, setOpen } = useSidebar();
  const handleRef = useRef<HTMLDivElement | null>(null);

  // Width lives in a CSS var (not React state), so keep the ARIA value in sync imperatively.
  const setWidth = useCallback((px: number, persist: boolean) => {
    const width = clampWidth(px);
    document.documentElement.style.setProperty(WIDTH_VAR, `${width}px`);
    handleRef.current?.setAttribute('aria-valuenow', String(width));
    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, String(width));
      } catch {
        /* private mode / storage disabled — keep the in-session width, just don't persist it. */
      }
    }
  }, []);

  // Reflect the initial (possibly persisted) width for assistive tech; a callback ref re-runs on
  // every mount, including after a collapse → expand, so aria-valuenow is never stale.
  const attachRef = useCallback((node: HTMLDivElement | null) => {
    handleRef.current = node;
    node?.setAttribute('aria-valuenow', String(readWidth()));
  }, []);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return; // primary button / touch only
      event.preventDefault();
      event.stopPropagation();
      const startX = event.clientX;
      const startWidth = readWidth();
      const root = document.documentElement;
      root.dataset.sidebarResizing = 'true';
      // Width to hand back to the sidebar the next time it expands, so a collapse never leaves it
      // stuck at some cramped value. Captured up front from where the drag began.
      const restoreWidth = clampWidth(startWidth);
      // Are we currently previewing the collapsed icon rail? Flipped at the threshold crossings below,
      // not on every move — the per-move path stays a single CSS-var write, no React re-render.
      let collapsing = false;

      const cleanup = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onEnd);
        window.removeEventListener('pointercancel', onEnd);
        delete root.dataset.sidebarResizing;
      };
      // Commit the drag. `raw` is the final cursor-implied width (null when we bailed on a missed
      // pointerup and just keep whatever's on screen). In the collapse preview we stay collapsed and
      // seed a usable width for the next expand; otherwise we persist the resized width.
      const finish = (raw: number | null) => {
        cleanup();
        if (collapsing) {
          setOpen(false);
          setWidth(restoreWidth, true); // width var is inert while collapsed → seeds next expand, no flash
          return;
        }
        setWidth(raw ?? readWidth(), true);
      };
      const onMove = (e: globalThis.PointerEvent) => {
        // Button released off-window and we missed the pointerup: bail out so the document never stays
        // locked in the resizing state.
        if (e.buttons === 0) {
          finish(null);
          return;
        }
        const raw = startWidth + (e.clientX - startX);
        if (collapsing) {
          // Previewing the icon rail; only react when the user pulls back out far enough (hysteresis),
          // then re-expand to the minimum and resume live resizing.
          if (raw >= COLLAPSE_EXIT) {
            collapsing = false;
            setOpen(true);
            setWidth(MIN_WIDTH, false);
          }
          return;
        }
        if (raw <= COLLAPSE_ENTER) {
          // Pulled past the minimum-hold → snap live to the icon rail. Transitions are suppressed
          // mid-drag, so this reads as an instant collapse under the cursor rather than an animation.
          collapsing = true;
          setOpen(false);
          return;
        }
        // Normal resize: follow the cursor, but clampWidth pins it at the minimum — no sub-min sliver.
        setWidth(raw, false);
      };
      const onEnd = (e: globalThis.PointerEvent) => finish(startWidth + (e.clientX - startX));
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onEnd);
      window.addEventListener('pointercancel', onEnd);
    },
    [setWidth, setOpen],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const delta = event.key === 'ArrowLeft' ? -KEYBOARD_STEP : event.key === 'ArrowRight' ? KEYBOARD_STEP : 0;
      if (delta === 0) return;
      event.preventDefault();
      setWidth(readWidth() + delta, true);
    },
    [setWidth],
  );

  const onReset = useCallback(() => setWidth(DEFAULT_WIDTH, true), [setWidth]);

  if (isMobile || state === 'collapsed') return null;

  return (
    <div
      ref={attachRef}
      role="separator"
      aria-orientation="vertical"
      aria-label={t('resizeSidebar')}
      aria-valuemin={MIN_WIDTH}
      aria-valuemax={MAX_WIDTH}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onDoubleClick={onReset}
      className="group/resize absolute inset-y-0 right-[-6px] z-20 w-3 cursor-ew-resize touch-none select-none outline-none"
    >
      {/* Full-height guide line that lights up while hovering/focusing the edge. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors group-hover/resize:bg-sidebar-border group-focus-visible/resize:bg-sidebar-ring"
      />
      {/* Grip sits just below the header (h-14). Absolutely positioned so it stays a perfect circle
          instead of being squeezed to an oval by the thin flex strip. Hovering/focusing it explains
          what the control does. */}
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="absolute top-32 left-1/2 flex size-6 -translate-x-1/2 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-sidebar-foreground/50 shadow-sm transition-colors group-hover/resize:border-sidebar-ring group-hover/resize:text-sidebar-foreground group-focus-visible/resize:border-sidebar-ring group-focus-visible/resize:text-sidebar-foreground">
            <GripVertical className="size-4" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {t('resizeHint')}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
