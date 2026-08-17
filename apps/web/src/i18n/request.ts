import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { DEFAULT_LOCALE, detectLocale, LOCALE_COOKIE, toLocale } from './config';

/**
 * Resolves the active locale + messages for every server render. Precedence:
 *   1. the `locale` cookie (set once the user picks a language — sticky), then
 *   2. the browser's `Accept-Language` on the first visit, then
 *   3. {@link DEFAULT_LOCALE}.
 * No i18n routing — the locale never appears in the URL; the cookie is the single source of truth.
 */
export default getRequestConfig(async () => {
  const cookieLocale = toLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const locale =
    cookieLocale ?? detectLocale((await headers()).get('accept-language')) ?? DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
