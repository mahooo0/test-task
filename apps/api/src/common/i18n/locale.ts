/**
 * API request locales — kept in lockstep with the web app's `src/i18n/config.ts` (uk/ru/en,
 * default ru). The client sends its active UI locale in the `X-Locale` header; we fall back to
 * `Accept-Language` (the first visit, before any locale cookie exists) and finally to the default.
 */
export const API_LOCALES = ['uk', 'ru', 'en'] as const;

export type ApiLocale = (typeof API_LOCALES)[number];

/** Fallback when the request carries no usable `X-Locale` / `Accept-Language`. Mirrors the web default. */
export const DEFAULT_API_LOCALE: ApiLocale = 'ru';

/** Narrows an untrusted header value to a supported {@link ApiLocale}, or `null` if unknown. */
export function toApiLocale(
  value: string | undefined | null,
): ApiLocale | null {
  return value && (API_LOCALES as readonly string[]).includes(value)
    ? (value as ApiLocale)
    : null;
}

type RequestHeaders = Record<string, string | string[] | undefined>;

/** Express may hand a header back as an array (repeated header) — take the first value. */
function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The locale to answer a request in: the explicit `X-Locale` header wins; otherwise the first
 * supported primary subtag of `Accept-Language` (`uk-UA` → `uk`); otherwise {@link DEFAULT_API_LOCALE}.
 */
export function resolveLocale(headers: RequestHeaders): ApiLocale {
  const explicit = toApiLocale(
    firstHeader(headers['x-locale'])?.trim().toLowerCase(),
  );
  if (explicit) return explicit;
  return detectFromAcceptLanguage(firstHeader(headers['accept-language']));
}

function detectFromAcceptLanguage(header: string | undefined): ApiLocale {
  if (!header) return DEFAULT_API_LOCALE;
  for (const part of header.split(',')) {
    const tag = part.split(';')[0]?.trim().toLowerCase();
    const primary = tag?.split('-')[0];
    const match = toApiLocale(primary);
    if (match) return match;
  }
  return DEFAULT_API_LOCALE;
}
