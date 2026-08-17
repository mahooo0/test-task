/**
 * Remembers which method the user last authenticated with, so the sign-in page
 * can surface a "Last used" hint on it. Purely a client-side affordance — the
 * source of truth for the session is always Clerk.
 */
export type AuthMethod = 'google' | 'apple' | 'email';

const STORAGE_KEY = 'dataroom:last-auth-method';

const isAuthMethod = (value: string | null): value is AuthMethod =>
  value === 'google' || value === 'apple' || value === 'email';

export function getLastAuthMethod(): AuthMethod | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return isAuthMethod(value) ? value : null;
  } catch {
    return null;
  }
}

export function setLastAuthMethod(method: AuthMethod): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, method);
  } catch {
    // Storage can be unavailable (private mode, disabled cookies) — the hint is
    // non-essential, so silently skip persisting it.
  }
}
