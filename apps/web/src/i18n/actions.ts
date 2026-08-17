'use server';

import { cookies } from 'next/headers';
import { type Locale, LOCALE_COOKIE } from './config';

/** One year — the locale choice is a long-lived preference, not a session value. */
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Persists the chosen locale in the `locale` cookie. Called from the language switcher; the client
 * then `router.refresh()`es so server components re-render with the new messages. Not `httpOnly`
 * (it's a UI preference, not a secret) so a future no-flash script could read it client-side too.
 */
export async function setLocale(locale: Locale): Promise<void> {
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
    sameSite: 'lax',
  });
}
