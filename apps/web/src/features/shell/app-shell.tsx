'use client';

import { useTranslations } from 'next-intl';
import type { CSSProperties, ReactNode } from 'react';
import { useTheme } from '@/app/ThemeProvider';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './app-sidebar';
import { CustomizePanel } from './customize-panel';
import { HeaderAccount } from './header-account';
import { SearchDialog } from './search-dialog';

/** Authenticated app frame: collapsible sidebar (style + collapse mode from prefs) + top bar. */
export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations('common');
  const { sidebarVariant, sidebarCollapsible } = useTheme();

  return (
    // The width defaults to 16rem but is overridable at runtime by the resize grip, which writes
    // `--app-sidebar-width` on <html> (seeded pre-paint in layout.tsx) — no re-render on drag.
    <SidebarProvider style={{ '--sidebar-width': 'var(--app-sidebar-width, 16rem)' } as CSSProperties}>
      {/* First tab stop: lets keyboard users jump past the sidebar straight to the content. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:font-medium focus:text-sm focus:shadow-md focus:ring-2 focus:ring-ring"
      >
        {t('skipToContent')}
      </a>
      <AppSidebar variant={sidebarVariant} collapsible={sidebarCollapsible} />
      {/* Floating sidebar is offset 8px from the top; match it so the header's
          bottom border lines up with the sidebar brand's bottom border. */}
      <SidebarInset className="md:peer-data-[variant=floating]:mt-2">

        {/* Header lives inside the scroll container so `sticky` + backdrop blur actually have
            content passing underneath; the skip-link target is the content div below it. */}
        <div className="flex flex-1 flex-col overflow-auto">
          <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/70 px-4 backdrop-blur-md">
            <SidebarTrigger className="-ms-1" aria-label={t('toggleSidebar')} />
            <Separator orientation="vertical" className="me-1 data-[orientation=vertical]:h-5 data-[orientation=vertical]:self-center!" />
            <SearchDialog />
            <div className="ms-auto flex items-center gap-1">
              <CustomizePanel />
              <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-5 data-[orientation=vertical]:self-center!" />
              <HeaderAccount />
            </div>
          </header>
          <div id="main-content" tabIndex={-1} className="flex w-full flex-1 flex-col p-4 outline-none md:p-6">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
