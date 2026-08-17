import type { useTranslations } from 'next-intl';

type ClerkErrLike = { errors?: Array<{ code?: string; message?: string }>; message?: string };

/** Translator scoped to the `auth` namespace (from `useTranslations('auth')`). */
type AuthTranslator = ReturnType<typeof useTranslations<'auth'>>;

/**
 * Clerk error codes we surface with a localized, user-facing message. Anything
 * outside this list falls back to Clerk's own message, then a generic string.
 */
const LOCALIZED_CODES = [
  'form_password_incorrect',
  'form_identifier_not_found',
  'form_identifier_exists',
  'form_password_pwned',
  'form_password_length_too_short',
  'form_code_incorrect',
  'too_many_requests',
] as const;

type LocalizedCode = (typeof LOCALIZED_CODES)[number];

function isLocalizedCode(code: string): code is LocalizedCode {
  return (LOCALIZED_CODES as readonly string[]).includes(code);
}

/**
 * "Session already exists" fires when Clerk's client-side signIn/signUp resource
 * still holds status='complete' from a previous flow. Detect it so callers can
 * signOut + retry cleanly.
 */
export function isSessionExistsError(err: unknown): boolean {
  const e = err as ClerkErrLike;
  const code = e?.errors?.[0]?.code ?? '';
  const message = String(e?.errors?.[0]?.message ?? e?.message ?? '').toLowerCase();
  return code === 'session_exists' || message.includes('session already exists');
}

/**
 * Resolve a Clerk / fetch error into a localized, user-facing message. Known
 * Clerk error codes map to translated copy so RU/UK users never see English;
 * unmapped codes fall back to Clerk's own message, then a generic localized string.
 *
 * Pass the `auth` translator to get localized code mapping. A plain string may be
 * passed for the legacy behaviour (Clerk's message, then that string as fallback),
 * which callers outside the auth forms still rely on.
 */
export function clerkErrorMessage(err: unknown, tOrFallback: AuthTranslator | string): string {
  const e = err as ClerkErrLike;
  const clerkError = e?.errors?.[0];
  const code = clerkError?.code ?? '';

  if (typeof tOrFallback === 'string') {
    return clerkError?.message ?? (err instanceof Error ? err.message : tOrFallback);
  }

  if (isLocalizedCode(code)) {
    return tOrFallback(`errors.${code}`);
  }
  return clerkError?.message ?? (err instanceof Error ? err.message : tOrFallback('errors.fallback'));
}
