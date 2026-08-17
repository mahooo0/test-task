import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { PdfPreviewProvider } from '@/features/items/preview/pdf-preview';
import { SharedBrowser } from '@/features/shares/SharedBrowser';

/**
 * Anonymous public-share page. Kept outside the `(app)` group (no sidebar/auth shell) and whitelisted
 * in `proxy.ts` so anyone with the link can open it. The token in the path is the only credential.
 */
export default async function PublicSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const t = await getTranslations('share');
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex h-14 items-center justify-between border-b px-4 sm:px-6">
        <span className="font-semibold">Data Room</span>
        <Link href="/" className="text-muted-foreground text-sm hover:text-foreground">
          {t('backToDrive')}
        </Link>
      </header>
      <main className="flex-1">
        <PdfPreviewProvider>
          <SharedBrowser source={{ kind: 'public', token }} />
        </PdfPreviewProvider>
      </main>
    </div>
  );
}
