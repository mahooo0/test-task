'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

/**
 * Small "Last used" pill marking the auth method the user last signed in with.
 * Rendered inside a `relative` wrapper — the OAuth buttons clip their own
 * overflow, so the badge lives just outside the button and overlaps its edge.
 */
export function LastUsedBadge({ className }: { className?: string }) {
  const t = useTranslations('auth');
  return (
    <span
      className={cn(
        'pointer-events-none absolute -top-2 right-2 z-20 select-none',
        'rounded-full bg-foreground px-2 py-0.5 text-[10px] font-medium leading-none text-background',
        'shadow-sm ring-1 ring-black/5',
        className,
      )}
    >
      {t('lastUsed')}
    </span>
  );
}
