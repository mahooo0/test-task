'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { setLocale } from '@/i18n/actions';
import { type Locale, LOCALE_META, LOCALES } from '@/i18n/config';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

/**
 * UK · RU · EN switcher. Writes the choice to the `locale` cookie via a server action, then
 * `router.refresh()`es so every Server Component re-renders with the new messages (the locale never
 * enters the URL). Disabled during the transition to swallow rapid double-clicks.
 */
export function LanguageSwitcher() {
  const active = useLocale() as Locale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const change = (next: string) => {
    if (!next || next === active) return;
    startTransition(async () => {
      await setLocale(next as Locale);
      router.refresh();
    });
  };

  return (
    <ToggleGroup
      size="sm"
      variant="outline"
      type="single"
      value={active}
      onValueChange={change}
      disabled={pending}
    >
      {LOCALES.map((locale) => (
        <ToggleGroupItem key={locale} value={locale} aria-label={LOCALE_META[locale].native}>
          {LOCALE_META[locale].short}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
