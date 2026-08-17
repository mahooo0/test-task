'use client';

import { useAuth, useUser } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { displayPersonName } from '@/lib/utils';
import { useSharedWithMe } from './hooks';

/** Per-user localStorage key holding the set of share ids we've already told this user about. */
const seenKey = (userId: string) => `dataroom:seen-shares:${userId}`;

/**
 * localStorage can throw (disabled/quota/sandboxed contexts). Guard every access so a hostile storage
 * engine degrades to "no toast" instead of throwing out of the effect and taking down the app shell.
 * A throwing getItem reads as "first load", so we simply seed (a no-op write) and never announce.
 */
function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // storage unavailable — skip persistence (REQ2 simply won't fire in this context)
  }
}

function parseSeen(raw: string): Set<string> {
  try {
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

/**
 * Watches the signed-in user's "Доступно мне" feed (polled) and raises a persistent toast whenever a
 * new resource is shared with them — "«{owner}» shared «{name}» with you", with a "View" action that
 * lands on `/personal` and highlights the item. There's no push channel in this MVP, so "new" is
 * detected by diffing the current feed against a per-user seen-set in localStorage; the very first
 * load for a user seeds that set silently so pre-existing shares never toast. Renders nothing.
 */
export function NewShareNotifier() {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const { data } = useSharedWithMe();
  const t = useTranslations('share');
  const router = useRouter();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!isSignedIn || !userId || !data || typeof window === 'undefined') return;
    const key = seenKey(userId);
    const stored = safeGet(key);

    // First ever load for this user (or unreadable storage): remember what's already shared, announce
    // nothing — so pre-existing shares never toast.
    if (stored === null) {
      safeSet(key, JSON.stringify(data.map((s) => s.shareId)));
      return;
    }

    const seen = parseSeen(stored);
    const fresh = data.filter((s) => !seen.has(s.shareId));
    if (fresh.length === 0) return;

    for (const share of fresh) {
      const owner = displayPersonName(share.owner.name, share.owner.email);
      const name = share.root?.name ?? share.roomName;
      toast(t('newShareToast', { owner, name }), {
        id: `new-share:${share.shareId}`,
        duration: Number.POSITIVE_INFINITY, // sticky — the user dismisses it (Toaster has closeButton)
        action: {
          label: t('view'),
          onClick: () => router.push(`/personal?highlight=${encodeURIComponent(share.shareId)}`),
        },
      });
      seen.add(share.shareId);
    }
    safeSet(key, JSON.stringify([...seen]));
  }, [isSignedIn, userId, data, t, router]);

  return null;
}
