'use client';

import type { SharedResourceView } from '@dataroom/types';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { FolderGlyph } from '@/features/items/icons';
import { ItemIcon } from '@/features/items/presentation';
import { cn, displayPersonName, getInitials } from '@/lib/utils';
import { useSharedWithMe } from './hooks';

/**
 * "Доступно мне" — the resources other people shared with the signed-in user, shown as a section on
 * the Личные home page. Renders nothing until there's at least one share (matching the home page's
 * "empty sections stay hidden" rule). Clicking a card opens the resource inline via {@link onOpen} —
 * a folder/room browses in place, a file opens the PDF viewer — instead of navigating away.
 * `highlightShareId` (set when arriving from a "shared with you" toast) scrolls the matching card
 * into view and pulses it once.
 */
export function SharedWithMeSection({
  onOpen,
  highlightShareId,
}: {
  onOpen: (share: SharedResourceView) => void;
  highlightShareId?: string | null;
}) {
  const t = useTranslations('share');
  const { data } = useSharedWithMe();

  const cardRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const pulsedRef = useRef<string | null>(null);
  const [pulseId, setPulseId] = useState<string | null>(null);

  useEffect(() => {
    if (!highlightShareId || !data) return;
    if (pulsedRef.current === highlightShareId) return;
    const el = cardRefs.current.get(highlightShareId);
    if (!el) return; // card not mounted yet — re-runs once `data` populates it
    pulsedRef.current = highlightShareId;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setPulseId(highlightShareId);
    const timer = setTimeout(() => setPulseId(null), 2500);
    return () => clearTimeout(timer);
  }, [highlightShareId, data]);

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h2 className="font-medium text-muted-foreground text-sm">{t('withMeTitle')}</h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((share) => {
          const ownerName = displayPersonName(share.owner.name, share.owner.email);
          return (
            <li key={share.shareId}>
              <button
                type="button"
                ref={(el) => {
                  if (el) cardRefs.current.set(share.shareId, el);
                  else cardRefs.current.delete(share.shareId);
                }}
                onClick={() => onOpen(share)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl border p-3 text-left outline-none transition-all hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50',
                  pulseId === share.shareId && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                )}
              >
                {share.root ? (
                  <ItemIcon item={share.root} className="size-6 shrink-0" />
                ) : (
                  <FolderGlyph className="size-6 shrink-0" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-sm">
                    {share.root?.name ?? share.roomName}
                  </span>
                  <span className="block truncate text-muted-foreground text-xs">
                    {t('sharedBy', { name: ownerName })}
                  </span>
                </span>
                <Avatar className="size-6 shrink-0">
                  {share.owner.avatarUrl && <AvatarImage src={share.owner.avatarUrl} alt="" />}
                  <AvatarFallback className="text-[10px]">{getInitials(ownerName)}</AvatarFallback>
                </Avatar>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
