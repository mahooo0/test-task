'use client';

import type { ItemDto } from '@dataroom/types';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { SharedEntryMeta } from '@/features/shares/SharedDriveRows';
import { SharedGridCard } from '@/features/shares/SharedDriveRows';
import type { ItemAction } from '../ItemActionsMenu';
import { ItemCard } from './ItemCard';

interface DriveGridProps {
  items: ItemDto[];
  onAction: (action: ItemAction, item: ItemDto) => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  /** Item ids that are resources shared *with* the caller — rendered read-only with the sharer as owner. */
  sharedMeta?: ReadonlyMap<string, SharedEntryMeta>;
  /** Opens a shared tile (folder → inline browse, file → viewer). Required when `sharedMeta` is set. */
  onOpenShared?: (item: ItemDto, meta: SharedEntryMeta) => void;
}

/** Responsive card grid mirroring the list view, with the same keyset "Load more". */
export function DriveGrid({
  items,
  onAction,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  sharedMeta,
  onOpenShared,
}: DriveGridProps) {
  const t = useTranslations('items');
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
        {items.map((item) => {
          const meta = sharedMeta?.get(item.id);
          return meta ? (
            <SharedGridCard
              key={item.id}
              item={item}
              owner={meta.owner}
              onOpen={(it) => onOpenShared?.(it, meta)}
            />
          ) : (
            <ItemCard key={item.id} item={item} onAction={onAction} />
          );
        })}
      </div>
      {hasNextPage && (
        <div className="flex justify-center">
          <Button variant="ghost" size="sm" disabled={isFetchingNextPage} onClick={onLoadMore}>
            {isFetchingNextPage ? t('loading') : t('showMore')}
          </Button>
        </div>
      )}
    </div>
  );
}
