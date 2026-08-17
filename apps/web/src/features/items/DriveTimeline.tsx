'use client';

import type { ItemDto } from '@dataroom/types';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { MouseEvent } from 'react';
import { Button } from '@/components/ui/button';
import type { SharedEntryMeta } from '@/features/shares/SharedDriveRows';
import { SharedTimelineRow } from '@/features/shares/SharedDriveRows';
import { cn } from '@/lib/utils';
import { groupByDate } from './date-buckets';
import { DROP_HIGHLIGHT, useItemDnd } from './dnd/use-drop';
import { formatDate } from './format';
import { type ItemAction, ItemActionsMenu } from './ItemActionsMenu';
import { DateHint, ItemIcon, isSharedPlaceholder, OwnerCell, SharedBadge } from './presentation';
import { sortItems } from './sort-items';
import { SortableHeader, useSortControls } from './SortControls';
import { useItemActions } from './use-item-actions';

interface DriveTimelineProps {
  items: ItemDto[];
  onAction: (action: ItemAction, item: ItemDto) => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  /** Item ids that are resources shared *with* the caller — rendered read-only with the sharer as owner. */
  sharedMeta?: ReadonlyMap<string, SharedEntryMeta>;
  /** Opens a shared row (folder → inline browse, file → viewer). Required when `sharedMeta` is set. */
  onOpenShared?: (item: ItemDto, meta: SharedEntryMeta) => void;
}

/**
 * Date-grouped ("по датам") view: the real files + folders, bucketed by when they were added
 * (createdAt). Topped by the same sortable header as the list view: buckets always come from
 * createdAt, so the created sort flips bucket order (newest ↔ oldest first) while any other field
 * re-orders rows within each bucket. Borderless rows that highlight on hover, like the list view.
 */
export function DriveTimeline({
  items,
  onAction,
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore,
  sharedMeta,
  onOpenShared,
}: DriveTimelineProps) {
  const t = useTranslations('items');
  const { sortField, sortDir } = useSortControls();
  const now = new Date();
  const bucketDir = sortField === 'created' ? sortDir : 'desc';
  const factor = bucketDir === 'asc' ? 1 : -1;
  const sorted = [...items].sort(
    (a, b) => factor * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
  );
  // groupByDate always emits buckets today→earlier; mirror an ascending created sort by reversing.
  const grouped = groupByDate(sorted, (item) => item.createdAt, now);
  const ordered = bucketDir === 'asc' ? [...grouped].reverse() : grouped;
  const groups =
    sortField === 'created'
      ? ordered
      : ordered.map((group) => ({ ...group, items: sortItems(group.items, sortField, sortDir) }));

  return (
    <div>
      <div className="flex items-center gap-4 border-b px-3 py-2 font-medium text-muted-foreground text-xs">
        <div className="min-w-0 flex-1">
          <SortableHeader field="name" />
        </div>
        <div className="hidden w-40 lg:block">{t('owner')}</div>
        <div className="hidden w-32 shrink-0 sm:block">
          <SortableHeader field="created" />
        </div>
        {/* Spacer over the rows' "…" menu column. */}
        <div className="w-8 shrink-0" />
      </div>

      <div className="flex flex-col gap-6 py-2">
        {groups.map((group) => (
          <section key={group.key} className="flex flex-col gap-1">
            <h2 className="px-3 font-medium text-muted-foreground text-xs">
              {t(`bucket.${group.key}`)}
            </h2>
            <div className="flex flex-col">
              {group.items.map((item) => {
                const meta = sharedMeta?.get(item.id);
                return meta ? (
                  <SharedTimelineRow
                    key={item.id}
                    item={item}
                    owner={meta.owner}
                    onOpen={(it) => onOpenShared?.(it, meta)}
                  />
                ) : (
                  <TimelineRow key={item.id} item={item} onAction={onAction} />
                );
              })}
            </div>
          </section>
        ))}
        {hasNextPage && (
          <div className="flex justify-center">
            <Button variant="ghost" size="sm" disabled={isFetchingNextPage} onClick={onLoadMore}>
              {isFetchingNextPage ? t('loading') : t('showMore')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineRow({
  item,
  onAction,
}: {
  item: ItemDto;
  onAction: (action: ItemAction, item: ItemDto) => void;
}) {
  const isFolder = item.type === 'FOLDER';
  const t = useTranslations('items');
  const locale = useLocale();
  const { openFile } = useItemActions(item);
  const { setNodeRef, listeners, isDragging, highlight } = useItemDnd(item);
  const shared = isSharedPlaceholder(item.id);
  const router = useRouter();

  // Whole-row open, mirroring the list view's ItemRow: any click outside the name link/button and
  // the "…" menu opens the item (a drag never fires a click thanks to dnd-kit's 6px threshold).
  const openRow = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('a, button')) return;
    if (isFolder) router.push(`/folders/${item.id}`);
    else openFile();
  };

  const label = (
    <span className="flex min-w-0 items-center gap-2.5">
      <ItemIcon item={item} className="size-4" />
      <span className="truncate">{item.name}</span>
      {shared && <SharedBadge />}
    </span>
  );

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      onClick={openRow}
      className={cn(
        'group flex cursor-pointer items-center gap-4 rounded-md px-3 py-2 transition-colors hover:bg-muted/60',
        isDragging && 'opacity-50',
        highlight && DROP_HIGHLIGHT,
      )}
    >
      <div className="min-w-0 flex-1">
        {isFolder ? (
          <Link
            href={`/folders/${item.id}`}
            draggable={false}
            className="block min-w-0 rounded-sm font-medium text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={openFile}
            className="block min-w-0 rounded-sm text-left font-medium text-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {label}
          </button>
        )}
      </div>

      <div className="hidden w-40 lg:block">
        <OwnerCell />
      </div>
      <div className="hidden w-32 shrink-0 text-muted-foreground text-sm sm:block">
        <DateHint iso={item.createdAt}>
          <span className="sr-only">{t('createdLabel')} </span>
          {formatDate(item.createdAt, locale)}
        </DateHint>
      </div>

      <div
        className="flex w-8 shrink-0 justify-end"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <ItemActionsMenu item={item} onAction={onAction} />
      </div>
    </div>
  );
}
