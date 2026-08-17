import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge conditional class names, resolving Tailwind conflicts. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Up to two uppercase initials from a name, e.g. "Ada Lovelace" → "AL". */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  const initials = parts.length === 1 ? parts[0].slice(0, 2) : `${parts[0][0]}${parts[parts.length - 1][0]}`;
  return initials.toUpperCase();
}

/**
 * A human-friendly display name. Clerk falls a user's `name` back to their raw email when no first/
 * last name (or username) is set, so a sharer can surface as "dataroom.qa.drive+clerk_test@example.com",
 * which reads badly wherever we show "shared by …". When the name looks like an email (or is empty),
 * derive a Title-Cased handle from the local part — dropping any "+tag" and splitting on separators:
 * e.g. "ada.lovelace+dev@x.com" → "Ada Lovelace". A real display name is returned untouched.
 */
export function displayPersonName(name?: string | null, email?: string | null): string {
  const raw = (name ?? '').trim();
  const looksLikeEmail = raw.includes('@');
  if (raw && !looksLikeEmail) return raw;

  const local = (looksLikeEmail ? raw : (email ?? '').trim()).split('@')[0]?.split('+')[0] ?? '';
  const words = local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));

  return words.length > 0 ? words.join(' ') : raw || (email ?? '').trim() || 'User';
}
