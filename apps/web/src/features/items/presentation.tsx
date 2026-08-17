'use client';

import { useUser } from '@clerk/nextjs';
import type { ItemDto } from '@dataroom/types';
import { Star, Users } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn, getInitials } from '@/lib/utils';
import { formatDateExact } from './format';
import { FolderGlyph, PdfGlyph } from './icons';

/**
 * Presentation helpers for a drive item's owner / sharing / type — the surfaces that mirror
 * Google Drive's list + card metadata.
 *
 * NOTE (single-owner rooms): every item in a room belongs to the signed-in user, so the "owner" is
 * always the current Clerk user. The "shared" badge is driven by the owner's active shares — see
 * `useMySharedResourceIds` in features/shares/hooks.
 */

/** The file/folder type glyph — folders Drive gray, PDFs the red Drive badge, so type reads at a glance. */
export function ItemIcon({ item, className }: { item: ItemDto; className?: string }) {
  return item.type === 'FOLDER' ? (
    <FolderGlyph className={className} />
  ) : (
    <PdfGlyph className={cn('text-[#EA4335]', className)} />
  );
}

/** The signed-in user, shaped as the item's owner (single-owner rooms ⇒ always "you"). */
export function useCurrentOwner() {
  const { user } = useUser();
  const t = useTranslations('items');
  return {
    name: user?.fullName ?? user?.username ?? t('you'),
    email: user?.primaryEmailAddress?.emailAddress ?? '',
    avatarUrl: user?.imageUrl ?? null,
  };
}

/** Owner avatar + "You" label, as shown in the list "Owner" column. */
export function OwnerCell({ className }: { className?: string }) {
  const t = useTranslations('items');
  const owner = useCurrentOwner();
  return (
    <span className={cn('flex min-w-0 items-center gap-2', className)}>
      <Avatar className="size-6 shrink-0">
        {owner.avatarUrl && <AvatarImage src={owner.avatarUrl} alt="" />}
        <AvatarFallback className="text-[10px]">{getInitials(owner.name)}</AvatarFallback>
      </Avatar>
      <span className="truncate text-muted-foreground text-sm">{t('you')}</span>
    </span>
  );
}

/** The filled star shown next to a starred item's name (Google Drive "Помеченные"). */
export function StarBadge({ className }: { className?: string }) {
  const t = useTranslations('items');
  return (
    <Star
      role="img"
      aria-label={t('starredBadge')}
      className={cn('size-3.5 shrink-0 fill-amber-400 text-amber-400', className)}
    />
  );
}

/**
 * Wraps a relative/short date (`formatDate` output, possibly inside a phrase) so hovering it shows
 * the exact date + time in the app's styled tooltip — use instead of a native `title`.
 */
export function DateHint({
  iso,
  className,
  children,
}: {
  iso: string;
  className?: string;
  children: ReactNode;
}) {
  const locale = useLocale();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={className}>{children}</span>
      </TooltipTrigger>
      <TooltipContent>{formatDateExact(iso, locale)}</TooltipContent>
    </Tooltip>
  );
}

/** The two-people "shared" glyph shown next to a shared item's name. */
export function SharedBadge({ className }: { className?: string }) {
  const t = useTranslations('items');
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="img"
          aria-label={t('shared')}
          className={cn('inline-flex shrink-0 text-muted-foreground', className)}
        >
          <Users className="size-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent>{t('shared')}</TooltipContent>
    </Tooltip>
  );
}
