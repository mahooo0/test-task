import type { Metadata } from 'next';
import { Sora } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Providers } from '@/app/providers';
import './globals.css';

const sora = Sora({ subsets: ['latin'], variable: '--font-sora', display: 'swap' });

// Title is the product/brand name (unlocalized); the description is localized per request locale.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common');
  return {
    title: 'Data Room',
    description: t('appDescription'),
    icons: { icon: '/favicon.png' },
  };
}

// Applies saved prefs (theme class, density/content-layout/view-mode attrs, sidebar width) before
// paint to avoid a flash. Mirrors the defaults in ThemeProvider (theme `light`, density
// `comfortable`, content-layout `fluid`, view-mode `list`) — keep in sync.
const NO_FLASH_THEME = `(function(){try{var e=document.documentElement,g=localStorage;var t=g.getItem('theme')||'light';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);e.classList.toggle('dark',d);e.setAttribute('data-density',g.getItem('density')||'comfortable');e.setAttribute('data-view-mode',g.getItem('view-mode')||'list');var w=parseInt(g.getItem('sidebar-width'),10);if(w>=208&&w<=480){e.style.setProperty('--app-sidebar-width',w+'px');}}catch(e){}})();`;

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Locale + messages come from the cookie-based request config (src/i18n/request.ts), so the very
  // first server render is already in the right language — no locale flash to guard against.
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={sora.variable} suppressHydrationWarning>
      <body>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static, pre-hydration theme script */}
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME }} />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
