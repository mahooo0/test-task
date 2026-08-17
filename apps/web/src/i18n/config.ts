/**
 * Supported UI locales. Order is display order in the language switcher.
 * Ukrainian and Russian first (the primary audience), English as the international fallback.
 */
export const LOCALES = ['uk', 'ru', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

/** Fallback when no cookie is set and the browser's language isn't one we ship. */
export const DEFAULT_LOCALE: Locale = 'ru';

/** Cookie the chosen locale is persisted in — readable on both the server and the client. */
export const LOCALE_COOKIE = 'locale';

/** Native names + a short chip label for the switcher. */
export const LOCALE_META: Record<Locale, { native: string; short: string }> = {
  uk: { native: 'Українська', short: 'UK' },
  ru: { native: 'Русский', short: 'RU' },
  en: { native: 'English', short: 'EN' },
};

/** Narrows an untrusted string (cookie value) to a supported `Locale`, or `null` if unknown. */
export function toLocale(value: string | undefined | null): Locale | null {
  return LOCALES.includes(value as Locale) ? (value as Locale) : null;
}

/**
 * Best-effort locale from an `Accept-Language` header — used only on the first visit (no cookie yet).
 * Picks the first tag whose primary subtag we support (`uk-UA` → `uk`); falls back to {@link DEFAULT_LOCALE}.
 */
export function detectLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  for (const part of acceptLanguage.split(',')) {
    const tag = part.split(';')[0]?.trim().toLowerCase();
    const primary = tag?.split('-')[0];
    const match = toLocale(primary);
    if (match) return match;
  }
  return DEFAULT_LOCALE;
}
