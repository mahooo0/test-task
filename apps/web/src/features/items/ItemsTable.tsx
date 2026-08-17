'use client';

import type { ItemDto } from '@dataroom/types';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { SharedEntryMeta } from '@/features/shares/SharedDriveRows';
import { SharedListRow } from '@/features/shares/SharedDriveRows';
import { cn } from '@/lib/utils';
import type { ItemAction } from './ItemActionsMenu';
import { ItemRow } from './ItemRow';
import {
  COL_ACTIONS,
  COL_CREATED,
  COL_MODIFIED,
  COL_NAME,
  COL_OWNER,
  LIST_COLUMNHEADER_ROLE,
  LIST_ROW_GRID,
  LIST_ROW_ROLE,
  LIST_ROWGROUP_ROLE,
  LIST_TABLE_ROLE,
} from './list-columns';
import { SortableHeader, SortMenu } from './SortControls';

interface ItemsTableProps {
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
 * The drive list view: a header of sortable columns (with the rounded sort control in the last
 * "action" cell) over item rows, plus a keyset "Load more". Shared by the drive and the home
 * dashboard's "Рекомендуемые файлы" so both render identical rows.
 */
export function ItemsTable({
  items,
  onAction,
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore,
  sharedMeta,
  onOpenShared,
}: ItemsTableProps) {
  const t = useTranslations('items');
  return (
    <div>
      {/*
        Table semantics over the CSS-grid layout: this wrapper is the table, the header line below is
        its `row` of `columnheader`s, and the item list is the body `rowgroup`. Each row (ItemRow /
        SharedListRow) tags its root `LIST_ROW_ROLE` and its cells `LIST_CELL_ROLE`, so a screen
        reader navigates the whole list as one table. The sortable headers (SortableHeader) carry the
        `columnheader` role and `aria-sort` themselves, so their layout wrappers stay `presentation`
        to avoid a stray generic node between the row and its header cell.
      */}
      <div role={LIST_TABLE_ROLE}>
        <div
          role={LIST_ROW_ROLE}
          className={cn(
            LIST_ROW_GRID,
            'border-b px-3 py-2 text-muted-foreground text-xs font-medium',
          )}
        >
          <div className={COL_NAME} role="presentation">
            <SortableHeader field="name" />
          </div>
          <div className={cn(COL_OWNER, 'truncate')} role={LIST_COLUMNHEADER_ROLE}>
            {t('owner')}
          </div>
          <div className={COL_CREATED} role="presentation">
            <SortableHeader field="created" />
          </div>
          <div className={COL_MODIFIED} role="presentation">
            <SortableHeader field="modified" />
          </div>
          <div className={COL_ACTIONS} role={LIST_COLUMNHEADER_ROLE}>
            <SortMenu compact />
          </div>
        </div>

        <div className="py-1" role={LIST_ROWGROUP_ROLE}>
          {items.map((item) => {
            const meta = sharedMeta?.get(item.id);
            return meta ? (
              <SharedListRow
                key={item.id}
                item={item}
                owner={meta.owner}
                onOpen={(it) => onOpenShared?.(it, meta)}
              />
            ) : (
              <ItemRow key={item.id} item={item} onAction={onAction} />
            );
          })}
        </div>
      </div>

      {hasNextPage && (
        <div className="p-2 text-center">
          <Button
            variant="ghost"
            size="sm"
            disabled={isFetchingNextPage}
            onClick={onLoadMore}
          >
            {isFetchingNextPage ? t('loading') : t('showMore')}
          </Button>
        </div>
      )}
    </div>
  );
}
