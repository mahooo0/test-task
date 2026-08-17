'use client';

import { RefreshCw, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/app/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DriveTimeline } from '@/features/items/DriveTimeline';
import { DriveGrid } from '@/features/items/grid/DriveGrid';
import { ViewToggle } from '@/features/items/grid/ViewToggle';
import { useStarred } from '@/features/items/hooks';
import { DriveDialogs, useDriveDialogs } from '@/features/items/ItemActionDialogs';
import { ItemsTable } from '@/features/items/ItemsTable';

/**
 * "Помеченные" — every starred item in the room (folders first, then name; server-ordered). Renders
 * with the same list / grid / timeline views as the drive; folders navigate, files open the viewer,
 * and the row/card "…" menu (incl. un-star) works exactly as in the drive.
 */
export function StarredView() {
  const t = useTranslations('starred');
  const { viewMode } = useTheme();
  const { data: items = [], isLoading, isError, refetch } = useStarred();
  const { dialog, onAction, close } = useDriveDialogs();

  return (
    <div className="flex h-full w-full flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-semibold text-xl">{t('title')}</h1>
        {items.length > 0 && <ViewToggle />}
      </div>

      {isLoading ? (
        <StarredSkeleton />
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-muted-foreground text-sm">{t('loadFailed')}</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            <RefreshCw />
            {t('retry')}
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
          <Star className="size-10 text-muted-foreground/50" />
          <p className="text-muted-foreground text-sm">{t('empty')}</p>
          <p className="max-w-sm text-muted-foreground/70 text-sm">{t('emptyHint')}</p>
        </div>
      ) : viewMode === 'grid' ? (
        <DriveGrid items={items} onAction={onAction} hasNextPage={false} isFetchingNextPage={false} onLoadMore={() => {}} />
      ) : viewMode === 'timeline' ? (
        <DriveTimeline items={items} onAction={onAction} />
      ) : (
        <ItemsTable items={items} onAction={onAction} />
      )}

      <DriveDialogs parentId={null} dialog={dialog} onOpenChange={close} />
    </div>
  );
}

function StarredSkeleton() {
  return (
    <div className="flex flex-col gap-1 py-1">
      {['a', 'b', 'c', 'd'].map((key) => (
        <div key={key} className="flex items-center gap-2.5 px-3 py-2">
          <Skeleton className="size-6 rounded" />
          <Skeleton className="h-4 w-48" />
        </div>
      ))}
    </div>
  );
}
