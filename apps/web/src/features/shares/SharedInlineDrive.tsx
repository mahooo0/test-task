'use client';

import type { ItemDto } from '@dataroom/types';
import { ChevronRight, Eye } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { useTheme } from '@/app/ThemeProvider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ViewToggle } from '@/features/items/grid/ViewToggle';
import {
  COL_ACTIONS,
  COL_CREATED,
  COL_MODIFIED,
  COL_NAME,
  COL_OWNER,
  LIST_ROW_GRID,
} from '@/features/items/list-columns';
import { usePdfPreview } from '@/features/items/preview/pdf-preview';
import { cn, getInitials } from '@/lib/utils';
import { SharedGridCard, SharedListRow } from './SharedDriveRows';
import { useSharedBrowse } from './use-shared-browse';

/**
 * A shared resource ("Доступно мне") browsed inline on `/personal`, styled to match the owner's own
 * drive — same list/grid rows, breadcrumb, and PDF viewer — so an invited grantee opens a shared
 * folder/file exactly the way they open their own. Read-only: no upload / new-folder / actions menu /
 * drag-and-drop. Reads are confined server-side to the share's scope via {@link useSharedBrowse}.
 */
export function SharedInlineDrive({
  shareId,
  onExit,
}: {
  shareId: string;
  onExit: () => void;
}) {
  const t = useTranslations('share');
  const tSort = useTranslations('sort');
  const tItems = useTranslations('items');
  const preview = usePdfPreview();
  const { viewMode } = useTheme();
  const gridView = viewMode === 'grid';

  const {
    resolve,
    list,
    view,
    ownerName,
    isFileShare,
    rows,
    stack,
    previewSource,
    openFolder,
    goToRoot,
    goToCrumb,
  } = useSharedBrowse({ kind: 'grantee', shareId });

  const open = (item: ItemDto) =>
    item.type === 'FOLDER' ? openFolder(item) : preview.open(item, previewSource);

  // A file share has no listing — auto-open the single file in the viewer, so a `?share=<fileId>`
  // deep link (e.g. the legacy /shared/[id] redirect for a shared file) lands in the PDF preview,
  // exactly like clicking that file's "Доступно мне" card. The single row below stays as a fallback
  // if the viewer is closed. Guarded by id so it fires once, not on every re-render/refetch.
  const autoOpenedRef = useRef<string | null>(null);
  useEffect(() => {
    if (isFileShare && view?.root && autoOpenedRef.current !== view.root.id) {
      autoOpenedRef.current = view.root.id;
      preview.open(view.root, previewSource);
    }
  }, [isFileShare, view?.root, previewSource, preview]);

  const rootName = view?.root?.name ?? view?.roomName ?? '';
  const atRoot = stack.length === 0;

  // A stale/inaccessible share (e.g. an old deep link the caller isn't a grantee of) resolves to an
  // error — show just the back link + message, not the drive chrome.
  if (resolve.isError) {
    return (
      <div className="flex h-full w-full flex-col gap-4">
        <nav className="flex items-center gap-1 text-sm">
          <button
            type="button"
            onClick={onExit}
            className="rounded-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {t('withMeTitle')}
          </button>
        </nav>
        <SharedInlineError />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col gap-4">
      {/* Toolbar — breadcrumb back to the home feed + view-only chip + list/grid toggle */}
      <div className="flex items-center justify-between gap-4">
        <nav aria-label={t('withMeTitle')} className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
          <button
            type="button"
            onClick={onExit}
            className="shrink-0 rounded-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {t('withMeTitle')}
          </button>
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
          <button
            type="button"
            onClick={goToRoot}
            disabled={atRoot}
            className={cn(
              'min-w-0 truncate rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              atRoot ? 'font-medium' : 'text-muted-foreground transition-colors hover:text-foreground',
            )}
          >
            {rootName || <Skeleton className="inline-block h-4 w-24 align-middle" />}
          </button>
          {stack.map((crumb, i) => (
            <span key={crumb.id ?? 'root'} className="flex min-w-0 items-center gap-1">
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
              <button
                type="button"
                onClick={() => goToCrumb(i)}
                disabled={i === stack.length - 1}
                className={cn(
                  'min-w-0 truncate rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                  i === stack.length - 1
                    ? 'font-medium'
                    : 'text-muted-foreground transition-colors hover:text-foreground',
                )}
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs sm:inline-flex">
            <Eye className="size-3.5" />
            {t('viewOnly')}
          </span>
          {!isFileShare && <ViewToggle />}
        </div>
      </div>

      {/* Owner meta — who shared this */}
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Avatar className="size-6">
          {view?.owner.avatarUrl && <AvatarImage src={view.owner.avatarUrl} alt="" />}
          <AvatarFallback className="text-[10px]">{getInitials(ownerName || '?')}</AvatarFallback>
        </Avatar>
        <span className="truncate">{ownerName ? t('sharedBy', { name: ownerName }) : ''}</span>
      </div>

      {/* Body */}
      {!view || (!isFileShare && list.isLoading) ? (
        gridView ? <GridSkeleton /> : <ListSkeleton />
      ) : rows.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground text-sm">{t('emptyFolder')}</p>
      ) : gridView ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {rows.map((item) => (
            <SharedGridCard
              key={item.id}
              item={item}
              owner={{ name: ownerName, avatarUrl: view.owner.avatarUrl }}
              onOpen={open}
            />
          ))}
        </div>
      ) : (
        <div>
          {/* Column header — mirrors the owner drive's list header (read-only, no sort controls). */}
          <div
            className={cn(
              LIST_ROW_GRID,
              'border-b px-3 py-2 text-muted-foreground text-xs font-medium',
            )}
          >
            <div className={COL_NAME}>{tSort('field.name')}</div>
            <div className={cn(COL_OWNER, 'truncate')}>{tItems('owner')}</div>
            <div className={COL_CREATED}>{tSort('field.created')}</div>
            <div className={COL_MODIFIED}>{tSort('field.modified')}</div>
            <div className={COL_ACTIONS} />
          </div>
          <div className="py-1">
            {rows.map((item) => (
              <SharedListRow
                key={item.id}
                item={item}
                owner={{ name: ownerName, avatarUrl: view.owner.avatarUrl }}
                onOpen={open}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SharedInlineError() {
  const t = useTranslations('share');
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-20 text-center">
      <p className="font-medium text-sm">{t('notFoundTitle')}</p>
      <p className="text-muted-foreground text-sm">{t('notFoundBody')}</p>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-1 py-1">
      {Array.from({ length: 6 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length static skeleton
        <div key={i} className="flex items-center gap-2.5 px-3 py-2">
          <Skeleton className="size-6 rounded" />
          <Skeleton className="h-4 w-56" />
        </div>
      ))}
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 8 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length static skeleton
        <div key={i} className="overflow-hidden rounded-xl border">
          <Skeleton className="aspect-[4/3] rounded-none" />
          <div className="space-y-1.5 p-3">
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
