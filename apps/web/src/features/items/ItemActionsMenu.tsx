'use client';

import type { ItemDto } from '@dataroom/types';
import {
  Download,
  FolderInput,
  Info,
  MoreHorizontal,
  Pencil,
  Share2,
  Star,
  StarOff,
  SquareArrowOutUpRight,
  Trash2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useDetailsPanel } from './details/details-panel';
import { useItemActions } from './use-item-actions';

export type ItemAction = 'share' | 'rename' | 'move' | 'delete';

interface ItemActionsMenuProps {
  item: ItemDto;
  onAction: (action: ItemAction, item: ItemDto) => void;
  /** Extra classes for the trigger button (merged after the hover-reveal defaults). */
  triggerClassName?: string;
}

/**
 * The per-item "…" actions menu, shared by the list row and the grid card.
 * Files also get Open/Download; folders only get Rename/Move/Delete.
 */
export function ItemActionsMenu({ item, onAction, triggerClassName }: ItemActionsMenuProps) {
  const isFolder = item.type === 'FOLDER';
  const t = useTranslations('actions');
  const { openFile, downloadFile, toggleStar } = useItemActions(item);
  const details = useDetailsPanel();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('actionsFor', { name: item.name })}
          className={cn('text-muted-foreground', triggerClassName)}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      {/* Size to the longest label and never wrap — long locales (e.g. UK "Додати до позначених")
          would otherwise break onto a second line inside a fixed width. */}
      <DropdownMenuContent align="end" className="w-max min-w-44 whitespace-nowrap">
        <DropdownMenuItem onSelect={() => onAction('share', item)}>
          <Share2 />
          {t('share')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {!isFolder && (
          <>
            <DropdownMenuItem onSelect={openFile}>
              <SquareArrowOutUpRight />
              {t('open')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={downloadFile}>
              <Download />
              {t('download')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onSelect={toggleStar}>
          {item.starred ? <StarOff /> : <Star />}
          {item.starred ? t('removeFromStarred') : t('addToStarred')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction('rename', item)}>
          <Pencil />
          {t('rename')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction('move', item)}>
          <FolderInput />
          {t('move')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => details.open(item)}>
          <Info />
          {t('details')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => onAction('delete', item)}>
          <Trash2 />
          {t('delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
