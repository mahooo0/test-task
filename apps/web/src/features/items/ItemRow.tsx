'use client';

import type { ItemDto } from '@dataroom/types';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { MouseEvent } from 'react';
import { cn } from '@/lib/utils';
import { DROP_HIGHLIGHT, useItemDnd } from './dnd/use-drop';
import { formatDate } from './format';
import { type ItemAction, ItemActionsMenu } from './ItemActionsMenu';
import {
  COL_ACTIONS,
  COL_CREATED,
  COL_MODIFIED,
  COL_NAME,
  COL_OWNER,
  LIST_CELL_ROLE,
  LIST_ROW_GRID,
  LIST_ROW_ROLE,
} from './list-columns';
import {
  DateHint,
  ItemIcon,
  isSharedPlaceholder,
  OwnerCell,
  SharedBadge,
  StarBadge,
} from './presentation';
import { useItemActions } from './use-item-actions';

export type { ItemAction };

interface ItemRowProps {
  item: ItemDto;
  onAction: (action: ItemAction, item: ItemDto) => void;
}

export function ItemRow({ item, onAction }: ItemRowProps) {
  const isFolder = item.type === 'FOLDER';
  const { openFile } = useItemActions(item);
  const { setNodeRef, listeners, isDragging, highlight } = useItemDnd(item);
  const shared = isSharedPlaceholder(item.id);
  const router = useRouter();
  const t = useTranslations('items');
  const locale = useLocale();

  // Clicking anywhere on the row opens it — a folder navigates, a file launches the PDF preview —
  // so the whole row is a hit target, not just the name. Clicks on the name link/button and the
  // trailing "…" menu are left to their own handlers (they surface the same action or a menu), and
  // a drag (dnd-kit's 6px threshold) never fires a click.
  const openRow = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('a, button')) return;
    if (isFolder) router.push(`/folders/${item.id}`);
    else openFile();
  };

  const label = (
    <span className="flex min-w-0 items-center gap-2.5">
      {/* 24px type glyph to match Google Drive's list rows (folder + PDF stay the same size so the
          icon column aligns). */}
      <ItemIcon item={item} className="size-6" />
      <span className="truncate">{item.name}</span>
      {item.starred && <StarBadge />}
      {shared && <SharedBadge />}
    </span>
  );

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      role={LIST_ROW_ROLE}
      onClick={openRow}
      className={cn(
        LIST_ROW_GRID,
        'group cursor-pointer rounded-md px-3 py-2 transition-colors hover:bg-muted/60',
        isDragging && 'opacity-50',
        highlight && DROP_HIGHLIGHT,
      )}
    >
      <div className={COL_NAME} role={LIST_CELL_ROLE}>
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

      <div className={COL_OWNER} role={LIST_CELL_ROLE}>
        <OwnerCell />
      </div>
      <div className={cn(COL_CREATED, 'text-muted-foreground text-sm')} role={LIST_CELL_ROLE}>
        <DateHint iso={item.createdAt}>
          <span className="sr-only">{t('createdLabel')} </span>
          {formatDate(item.createdAt, locale)}
        </DateHint>
      </div>
      <div className={cn(COL_MODIFIED, 'text-muted-foreground text-sm')} role={LIST_CELL_ROLE}>
        <DateHint iso={item.updatedAt}>
          <span className="sr-only">{t('modifiedLabel')} </span>
          {formatDate(item.updatedAt, locale)}
        </DateHint>
      </div>

      {/* The actions cell is excluded from the row-open click; stopping pointerdown also keeps the
          "…" menu from starting a drag so it opens normally. */}
      <div
        className={COL_ACTIONS}
        role={LIST_CELL_ROLE}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <ItemActionsMenu item={item} onAction={onAction} />
      </div>
    </div>
  );
}
