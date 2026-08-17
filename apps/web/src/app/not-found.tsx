import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { BrandMark } from '@/ui/brand-mark';

/**
 * Branded 404. The root `app/not-found.tsx` also catches any unmatched URL
 * app-wide; it renders inside the root layout (locale + intl provider available)
 * as a centered fallback with a single escape hatch back to My Drive.
 */
export default function NotFound() {
  const t = useTranslations('errors');

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-6 p-6 text-center sm:p-10">
      <BrandMark className="size-14" />
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-lg font-semibold text-foreground">{t('notFoundTitle')}</h1>
        <p className="max-w-md text-sm text-muted-foreground">{t('notFoundDescription')}</p>
      </div>
      <Button asChild size="lg">
        <Link href="/">{t('backToDrive')}</Link>
      </Button>
    </div>
  );
}
