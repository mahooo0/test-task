'use client';

import type { ItemDto } from '@dataroom/types';
import { ChevronRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { formatBytes, formatDate } from '@/features/items/format';
import { previewFrameClass } from '@/features/items/grid/PdfThumbnail';
import {
  COL_ACTIONS,
  COL_CREATED,
  COL_MODIFIED,
  COL_NAME,
  COL_OWNER,
  LIST_CELL_ROLE,
  LIST_ROW_GRID,
  LIST_ROW_ROLE,
} from '@/features/items/list-columns';
import { DateHint, ItemIcon } from '@/features/items/presentation';
import { cn, getInitials } from '@/lib/utils';

/** Sharing metadata for a drive entry that isn't the caller's own — a resource shared *with* them. */
export interface SharedEntryMeta {
  shareId: string;
  owner: { name: string; avatarUrl: string | null };
}

/** Owner avatar + display name, mirroring the drive's "Owner" cell for a shared (someone-else's) row. */
function SharedOwner({ owner }: { owner: SharedEntryMeta['owner'] }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar className="size-6 shrink-0">
        {owner.avatarUrl && <AvatarImage src={owner.avatarUrl} alt="" />}
        <AvatarFallback className="text-[10px]">{getInitials(owner.name || '?')}</AvatarFallback>
      </Avatar>
      <span className="truncate text-muted-foreground text-sm">{owner.name}</span>
    </span>
  );
}

/**
 * A read-only drive list row for a resource shared with the caller — aligned to the owner drive's
 * column grid (name · owner · created · modified · size) so it interleaves cleanly with owned rows,
 * but with the sharer as owner and no actions menu / drag. The whole row opens the resource.
 */
export function SharedListRow({
  item,
  owner,
  onOpen,
}: {
  item: ItemDto;
  owner: SharedEntryMeta['owner'];
  onOpen: (item: ItemDto) => void;
}) {
  const t = useTranslations('items');
  const locale = useLocale();
  const isFolder = item.type === 'FOLDER';
  return (
    <button
      type="button"
      role={LIST_ROW_ROLE}
      onClick={() => onOpen(item)}
      className={cn(
        LIST_ROW_GRID,
        'w-full cursor-pointer rounded-md px-3 py-2 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50',
      )}
    >
      <div className={COL_NAME} role={LIST_CELL_ROLE}>
        <span className="flex min-w-0 items-center gap-2.5">
          <ItemIcon item={item} className="size-6" />
          <span className="truncate font-medium text-sm">{item.name}</span>
        </span>
      </div>
      <div className={COL_OWNER} role={LIST_CELL_ROLE}>
        <SharedOwner owner={owner} />
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
      <div className={cn(COL_ACTIONS, 'text-muted-foreground text-sm')} role={LIST_CELL_ROLE}>
        {isFolder ? (
          <ChevronRight className="size-4" />
        ) : item.sizeBytes != null ? (
          formatBytes(item.sizeBytes, locale)
        ) : null}
      </div>
    </button>
  );
}

/** A read-only grid tile mirroring the owner drive's card frame (glyph preview, owner footer). */
export function SharedGridCard({
  item,
  owner,
  onOpen,
}: {
  item: ItemDto;
  owner: SharedEntryMeta['owner'];
  onOpen: (item: ItemDto) => void;
}) {
  const t = useTranslations('items');
  const isFolder = item.type === 'FOLDER';
  return (
    <Card
      role="button"
      tabIndex={0}
      aria-label={
        isFolder ? t('openFolder', { name: item.name }) : t('openFile', { name: item.name })
      }
      onClick={() => onOpen(item)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(item);
        }
      }}
      className="group cursor-pointer gap-0 overflow-hidden p-0 outline-none transition-colors hover:border-foreground/20 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <div className="flex items-center gap-1.5 px-3 py-2.5">
        <ItemIcon item={item} className="size-4" />
        <span className="min-w-0 flex-1 truncate font-medium text-sm">{item.name}</span>
      </div>
      <div className={previewFrameClass}>
        <ItemIcon item={item} className="size-10" />
      </div>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <Avatar className="size-5 shrink-0">
          {owner.avatarUrl && <AvatarImage src={owner.avatarUrl} alt="" />}
          <AvatarFallback className="text-[9px]">{getInitials(owner.name || '?')}</AvatarFallback>
        </Avatar>
        <span className="truncate text-muted-foreground text-xs">{owner.name}</span>
      </div>
    </Card>
  );
}

/** A read-only timeline row for a shared resource — mirrors the drive's date-grouped row, no actions. */
export function SharedTimelineRow({
  item,
  owner,
  onOpen,
}: {
  item: ItemDto;
  owner: SharedEntryMeta['owner'];
  onOpen: (item: ItemDto) => void;
}) {
  const t = useTranslations('items');
  const locale = useLocale();
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="group flex w-full items-center gap-4 rounded-md px-3 py-2 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <span className="flex min-w-0 flex-1 items-center gap-2.5 font-medium text-sm">
        <ItemIcon item={item} className="size-4" />
        <span className="truncate">{item.name}</span>
      </span>
      <span className="hidden w-40 lg:block">
        <SharedOwner owner={owner} />
      </span>
      <DateHint
        iso={item.createdAt}
        className="hidden w-32 shrink-0 text-muted-foreground text-sm sm:block"
      >
        <span className="sr-only">{t('createdLabel')} </span>
        {formatDate(item.createdAt, locale)}
      </DateHint>
      <span className="w-8 shrink-0" />
    </button>
  );
}
