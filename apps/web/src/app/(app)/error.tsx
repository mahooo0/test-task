'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { BrandMark } from '@/ui/brand-mark';

/**
 * Segment error boundary for the authenticated app group. `error.js` replaces the
 * page (not the layout above it), so this renders inside the sidebar shell as a
 * branded, centered fallback with a `retry()` recovery action and an escape hatch
 * back to My Drive.
 */
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useTranslations('errors');

  useEffect(() => {
    // Surface the failure for local debugging / error reporting.
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-full min-h-[440px] w-full flex-col items-center justify-center gap-6 p-6 text-center sm:p-10">
      <BrandMark className="size-14" />
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-lg font-semibold text-foreground">{t('boundaryTitle')}</h1>
        <p className="max-w-md text-sm text-muted-foreground">{t('boundaryDescription')}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        <Button size="lg" onClick={() => retry()}>
          {t('tryAgain')}
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/">{t('backToDrive')}</Link>
        </Button>
      </div>
    </div>
  );
}
