'use client';

import type { ItemDto } from '@dataroom/types';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { MouseEvent } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { cn, getInitials } from '@/lib/utils';
import { DROP_HIGHLIGHT, useItemDnd } from '../dnd/use-drop';
import { FolderGlyph } from '../icons';
import { formatDate } from '../format';
import { type ItemAction, ItemActionsMenu } from '../ItemActionsMenu';
import { useMySharedResourceIds } from '@/features/shares/hooks';
import { DateHint, ItemIcon, SharedBadge, StarBadge, useCurrentOwner } from '../presentation';
import { useItemActions } from '../use-item-actions';
import { PdfThumbnail, previewFrameClass } from './PdfThumbnail';

interface ItemCardProps {
  item: ItemDto;
  onAction: (action: ItemAction, item: ItemDto) => void;
}

/**
 * Grid tile — mirrors the Google Drive card: a header (type icon · name · "…" menu), a page-1
 * preview, and a footer with the owner avatar + "Создано вами · дата". Folder → navigate, file →
 * open, same actions menu as the list row.
 */
export function ItemCard({ item, onAction }: ItemCardProps) {
  const isFolder = item.type === 'FOLDER';
  const t = useTranslations('items');
  const locale = useLocale();
  const { openFile } = useItemActions(item);
  const { setNodeRef, listeners, isDragging, highlight } = useItemDnd(item);
  const owner = useCurrentOwner();
  const shared = useMySharedResourceIds().has(item.id);
  const router = useRouter();

  // Whole-card open, mirroring the list view's ItemRow: any click outside the name/preview links
  // and the "…" menu opens the item (a drag never fires a click thanks to dnd-kit's 6px threshold).
  const openCard = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('a, button')) return;
    if (isFolder) router.push(`/folders/${item.id}`);
    else openFile();
  };

  const preview = isFolder ? (
    <div className={previewFrameClass}>
      <FolderGlyph className="size-10" />
    </div>
  ) : (
    <PdfThumbnail item={item} />
  );

  const nameClass =
    'min-w-0 flex-1 truncate rounded-sm text-left font-medium text-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50';
  const previewFocus = 'block w-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50';

  return (
    <Card
      ref={setNodeRef}
      {...listeners}
      onClick={openCard}
      className={cn(
        'group relative cursor-pointer gap-0 overflow-hidden p-0 transition-colors hover:border-foreground/20 hover:shadow-md',
        isDragging && 'opacity-50',
        highlight && DROP_HIGHLIGHT,
      )}
    >
      <div className="flex items-center gap-1.5 px-3 py-2.5">
        <ItemIcon item={item} className="size-4" />
        {isFolder ? (
          <Link href={`/folders/${item.id}`} draggable={false} className={nameClass}>
            {item.name}
          </Link>
        ) : (
          <button type="button" onClick={openFile} className={nameClass}>
            {item.name}
          </button>
        )}
        {item.starred && <StarBadge />}
        {shared && <SharedBadge />}
        {/* Stop the "…" menu's pointerdown from starting a drag (so the menu opens normally). */}
        <span onPointerDown={(e) => e.stopPropagation()}>
          <ItemActionsMenu item={item} onAction={onAction} triggerClassName="-me-1" />
        </span>
      </div>

      {isFolder ? (
        <Link
          href={`/folders/${item.id}`}
          draggable={false}
          aria-label={t('openFolder', { name: item.name })}
          className={previewFocus}
        >
          {preview}
        </Link>
      ) : (
        <button
          type="button"
          onClick={openFile}
          aria-label={t('openFile', { name: item.name })}
          className={previewFocus}
        >
          {preview}
        </button>
      )}

      <div className="flex items-center gap-2 px-3 py-2.5">
        <Avatar className="size-5 shrink-0">
          {owner.avatarUrl && <AvatarImage src={owner.avatarUrl} alt="" />}
          <AvatarFallback className="text-[9px]">{getInitials(owner.name)}</AvatarFallback>
        </Avatar>
        <DateHint iso={item.createdAt} className="truncate text-muted-foreground text-xs">
          {t('createdByYou', { date: formatDate(item.createdAt, locale) })}
        </DateHint>
      </div>
    </Card>
  );
}
