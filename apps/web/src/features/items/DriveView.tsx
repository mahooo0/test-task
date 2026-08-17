'use client';

import { useAuth } from '@clerk/nextjs';
import { FolderPlus, Info, RefreshCw, WifiOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/app/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSharedDrive } from '@/features/shares/use-shared-drive';
import { Breadcrumbs } from './Breadcrumbs';
import { type DetailsTarget, useDetailsPanel } from './details/details-panel';
import { DriveTimeline } from './DriveTimeline';
import { EmptyState } from './EmptyState';
import { DriveGrid } from './grid/DriveGrid';
import { ViewToggle } from './grid/ViewToggle';
import { useBreadcrumb, useDriveItems, useItem } from './hooks';
import { DriveDialogs, useDriveDialogs } from './ItemActionDialogs';
import { ItemsTable } from './ItemsTable';
import { sortItems } from './sort-items';
import { SortMenu } from './SortControls';
import { UploadButton } from './uploads/UploadButton';

/** The drive at one folder level. `parentId === null` is the room root. */
export function DriveView({ parentId }: { parentId: string | null }) {
  const t = useTranslations('drive');
  const { isLoaded } = useAuth();
  const { viewMode, sortField, sortDir } = useTheme();
  // The timeline groups by createdAt, so page it in created order too — otherwise "Показать ещё"
  // pulls name-ordered rows that re-bucket above already-visible items. The direction follows the
  // pref only when sorting by created (its header is flippable in the timeline as well).
  const timelineDir = sortField === 'created' ? sortDir : 'desc';
  const items = useDriveItems(
    parentId,
    viewMode === 'timeline' ? 'created' : sortField,
    viewMode === 'timeline' ? timelineDir : sortDir,
  );
  const breadcrumb = useBreadcrumb(parentId);
  const { dialog, openNew, onAction, close } = useDriveDialogs();

  // The ⓘ toolbar toggle shows the current folder's details (or the room root at the top level).
  const details = useDetailsPanel();
  const td = useTranslations('details');
  const currentFolder = useItem(parentId, parentId !== null);
  const detailsTarget: DetailsTarget = parentId && currentFolder.data ? currentFolder.data : 'room';

  const ownItems = items.data?.pages.flatMap((page) => page.items) ?? [];
  // Resources shared *with* the caller live at the drive root ("shared with me"), mixed into the
  // listing as read-only rows with the sharer shown as owner. Only merged at the root; owned folders
  // never contain someone else's shared roots. When there's nothing to merge we pass the server's
  // own-items order straight through (no client re-sort) so the owned-only drive is unchanged.
  const shared = useSharedDrive();
  const atRoot = parentId === null;
  const hasShared = atRoot && shared.sharedItems.length > 0;
  const allItems = hasShared
    ? sortItems(
        [...ownItems, ...shared.sharedItems],
        viewMode === 'timeline' ? 'created' : sortField,
        viewMode === 'timeline' ? timelineDir : sortDir,
      )
    : ownItems;
  const sharedMeta = hasShared ? shared.sharedMeta : undefined;
  // Treat Clerk hydration + first fetch as loading, so an empty state never flashes during the auth
  // handshake (query disabled until `isSignedIn` resolves). At the root, also wait on the shared
  // feed — otherwise a grantee who owns nothing but has shares could flash the empty dropzone before
  // their shared rows arrive.
  // An offline/paused query (no cached data yet) is neither loading nor errored — surface it as its
  // own offline panel instead of spinning the skeleton forever (mirrors folder-tree's isPaused branch).
  const isOffline = items.isPaused && !items.data;
  const isResolving =
    !isLoaded || (!items.data && !items.isError && !isOffline) || (atRoot && shared.isLoading);
  const showEmpty = !isResolving && !isOffline && !items.isError && allItems.length === 0;
  const showControls = !isResolving && !isOffline && !showEmpty;

  return (
    <div className="flex h-full w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Breadcrumbs trail={parentId ? (breadcrumb.data ?? []) : []} />
        <div className="flex items-center gap-2">
          {/* List view carries the sort control in its header; grid view has no header, so it lives here. */}
          {showControls && viewMode === 'grid' && <SortMenu />}
          <ViewToggle />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={td('title')}
            onClick={() => details.toggle(detailsTarget)}
          >
            <Info />
          </Button>
          {showControls && (
            <>
              <UploadButton parentId={parentId} />
              <Button variant="outline" size="sm" onClick={openNew}>
                <FolderPlus />
                <span className="hidden sm:inline">{t('newFolder')}</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {isResolving ? (
        <DriveSkeleton />
      ) : items.isError ? (
        <ErrorState onRetry={() => void items.refetch()} />
      ) : isOffline ? (
        <OfflineState onRetry={() => void items.refetch()} />
      ) : showEmpty ? (
        <EmptyState parentId={parentId} onNewFolder={openNew} />
      ) : viewMode === 'grid' ? (
        <DriveGrid
          items={allItems}
          onAction={onAction}
          hasNextPage={!!items.hasNextPage}
          isFetchingNextPage={items.isFetchingNextPage}
          onLoadMore={() => void items.fetchNextPage()}
          sharedMeta={sharedMeta}
          onOpenShared={shared.openEntry}
        />
      ) : viewMode === 'timeline' ? (
        <DriveTimeline
          items={allItems}
          onAction={onAction}
          hasNextPage={!!items.hasNextPage}
          isFetchingNextPage={items.isFetchingNextPage}
          onLoadMore={() => void items.fetchNextPage()}
          sharedMeta={sharedMeta}
          onOpenShared={shared.openEntry}
        />
      ) : (
        <ItemsTable
          items={allItems}
          onAction={onAction}
          hasNextPage={!!items.hasNextPage}
          isFetchingNextPage={items.isFetchingNextPage}
          onLoadMore={() => void items.fetchNextPage()}
          sharedMeta={sharedMeta}
          onOpenShared={shared.openEntry}
        />
      )}

      <DriveDialogs parentId={parentId} dialog={dialog} onOpenChange={close} />
    </div>
  );
}

/**
 * Loading skeleton whose shape (list rows vs grid tiles) is chosen by the pre-paint
 * `data-view-mode` attribute via CSS — not React state — so a grid user never flashes
 * a list skeleton on the first frame before the pref resolves on mount.
 */
function DriveSkeleton() {
  return (
    <>
      <div className="[html[data-view-mode=grid]_&]:hidden">
        <ListSkeleton />
      </div>
      <div className="hidden [html[data-view-mode=grid]_&]:block">
        <GridSkeleton />
      </div>
    </>
  );
}

function ListSkeleton() {
  return (
    <div>
      <div className="border-b px-3 py-2">
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="space-y-1 py-1">
        {Array.from({ length: 6 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length static skeleton
          <div key={i} className="flex items-center gap-2.5 px-3 py-2">
            <Skeleton className="size-4 rounded" />
            <Skeleton className="h-4 w-48" />
          </div>
        ))}
      </div>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length static skeleton
        <div key={i} className="overflow-hidden rounded-xl border">
          <Skeleton className="aspect-[4/3] rounded-none" />
          <div className="space-y-1.5 p-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('drive');
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-20 text-center">
      <p className="text-sm text-muted-foreground">{t('loadError')}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw />
        {t('retry')}
      </Button>
    </div>
  );
}

/** Shown when the drive query is paused offline with no cached rows — mirrors {@link ErrorState}. */
function OfflineState({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('drive');
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-20 text-center">
      <WifiOff className="size-8 text-muted-foreground" />
      <div className="space-y-1">
        <p className="text-sm font-medium">{t('offlineTitle')}</p>
        <p className="text-sm text-muted-foreground">{t('offlineDescription')}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw />
        {t('retry')}
      </Button>
    </div>
  );
}
