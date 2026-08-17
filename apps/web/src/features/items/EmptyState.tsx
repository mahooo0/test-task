'use client';

import { ChevronDown, FolderPlus, FolderUp, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ChangeEvent, type MouseEvent, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useDropZone } from './uploads/drop-zone';
import { UploadMenu } from './uploads/UploadMenu';
import { pickedFromFileList } from './uploads/upload-helpers';
import { useUploads } from './uploads/uploads-context';
import { UploadArt } from './UploadArt';

/**
 * Drive empty state: a full dashed drop zone (its border brightens on hover) with
 * the floating upload art, a "drag something here to Upload ▾" line, and a row of
 * real starter actions. Every control is wired — no placeholder buttons.
 *
 * While a file is dragged over the window the whole zone highlights blue. The inline copy also
 * registers with the {@link useDropZone} coordinator so the app-wide full-screen overlay stays
 * hidden; the overlay renders its own copy with `asOverlay` (no registration, purely visual).
 */
export function EmptyState({
  parentId,
  onNewFolder,
  asOverlay = false,
}: {
  parentId: string | null;
  onNewFolder: () => void;
  asOverlay?: boolean;
}) {
  const t = useTranslations('items');
  const { enqueue } = useUploads();
  const { dragActive, registerEmptyState } = useDropZone();
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  // Cursor-anchored "quick actions" menu: a left-click on the empty canvas drops a
  // small menu right under the pointer. `null` = closed; otherwise viewport coords.
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);

  // Announce this inline empty state so the full-screen overlay knows to stay hidden — it highlights
  // in place instead. The overlay's own copy passes `asOverlay` and must not register.
  useEffect(() => {
    if (asOverlay) return;
    return registerEmptyState();
  }, [asOverlay, registerEmptyState]);

  const onPicked = (e: ChangeEvent<HTMLInputElement>) => {
    enqueue(pickedFromFileList(e.target.files), parentId);
    e.target.value = '';
  };
  const open = (input: HTMLInputElement | null) => input?.click();
  // `onSelect` closes the menu synchronously; defer the picker so the click isn't swallowed.
  const openLater = (input: HTMLInputElement | null) => setTimeout(() => input?.click(), 0);

  // Open the quick-actions menu on a plain left-click of the empty canvas — but never when the
  // click lands on a real control (the Upload ▾ link or the starter buttons handle their own).
  const openMenuAt = (e: MouseEvent<HTMLDivElement>) => {
    if (asOverlay) return; // the overlay copy is purely visual — no interactions
    if ((e.target as HTMLElement).closest('button, a, input')) return;
    setMenuAt({ x: e.clientX, y: e.clientY });
  };

  return (
    <div
      onClick={openMenuAt}
      className={cn(
        'group relative flex h-full min-h-[440px] w-full flex-col overflow-hidden rounded-2xl border-2 border-dashed p-6 transition-colors duration-300 sm:p-10',
        dragActive
          ? 'border-primary bg-primary/20 ring-4 ring-primary/25' // a file is over → blue highlight
          : 'border-primary/30 hover:border-primary/70 focus-within:border-primary/70',
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[40%] -z-10 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
      />

      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <UploadArt />
        {dragActive ? (
          // A file is over the zone → drop mode: just the prompt, no dropdown, no buttons.
          <p className="text-base font-medium text-foreground">{t('dropActive')}</p>
        ) : (
          <p className="text-base text-muted-foreground">
            {t('dropHintPrefix')}{' '}
            <UploadMenu
              parentId={parentId}
              align="center"
              filesLabel={t('files')}
              folderLabel={t('folder')}
              contentClassName="w-40"
              trigger={
                <button
                  type="button"
                  className="inline-flex items-center gap-1 font-semibold text-foreground underline decoration-primary/60 decoration-2 underline-offset-4 outline-none transition-colors hover:decoration-primary focus-visible:decoration-primary"
                >
                  {t('upload')}
                  <ChevronDown className="size-4 opacity-70" />
                </button>
              }
            />
          </p>
        )}
      </div>

      {!dragActive && (
        <div className="flex flex-col items-start gap-3">
          <span className="text-sm text-muted-foreground">{t('otherWays')}</span>
          <div className="flex flex-wrap gap-2.5">
            <Button variant="secondary" size="sm" className="rounded-full" onClick={onNewFolder}>
              <FolderPlus />
              {t('createFolder')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="rounded-full"
              onClick={() => open(fileInput.current)}
            >
              <Upload />
              {t('uploadFiles')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="rounded-full"
              onClick={() => open(folderInput.current)}
            >
              <FolderUp />
              {t('uploadFolder')}
            </Button>
          </div>
        </div>
      )}

      {/* Cursor-anchored quick actions. The trigger is a zero-size element pinned to the click
          point (viewport coords → `fixed`); Radix drops the menu right beneath it. */}
      <DropdownMenu open={menuAt !== null} onOpenChange={(o) => !o && setMenuAt(null)}>
        <DropdownMenuTrigger asChild>
          <span
            aria-hidden
            className="pointer-events-none fixed size-0"
            style={{ left: menuAt?.x ?? 0, top: menuAt?.y ?? 0 }}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={2} className="w-52">
          <DropdownMenuItem onSelect={onNewFolder}>
            <FolderPlus />
            {t('createFolder')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openLater(fileInput.current)}>
            <Upload />
            {t('uploadFiles')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openLater(folderInput.current)}>
            <FolderUp />
            {t('uploadFolder')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        ref={fileInput}
        type="file"
        accept="application/pdf"
        multiple
        hidden
        onChange={onPicked}
      />
      {/* `webkitdirectory` isn't a typed React prop — set it on the DOM node directly. */}
      <input
        ref={(el) => {
          folderInput.current = el;
          if (el) {
            el.setAttribute('webkitdirectory', '');
            el.setAttribute('directory', '');
          }
        }}
        type="file"
        hidden
        onChange={onPicked}
      />
    </div>
  );
}
