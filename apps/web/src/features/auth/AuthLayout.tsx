'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { ThemeToggle } from '@/ui/theme-toggle';

// WebGL shader — client-only, so it never runs during the server render pass.
const ShaderBg = dynamic(() => import('@/ui/shader-bg').then((m) => m.ShaderBg), { ssr: false });

interface AuthLayoutProps {
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthLayout({ children, footer }: AuthLayoutProps) {
  const t = useTranslations('hero');
  const highlights = [
    { heading: t('h1Heading'), body: t('h1Body') },
    { heading: t('h2Heading'), body: t('h2Body') },
  ];
  return (
    <main>
      <div className="grid h-dvh gap-2 p-2 lg:grid-cols-2">
        {/* Left / form */}
        <div className="relative order-1 flex h-full">
          <ThemeToggle className="absolute top-6 left-6 z-10" />

          <div className="mx-auto flex w-full flex-col justify-center space-y-8 px-6 sm:w-[460px]">
            <div className="relative isolate">
              <div
                aria-hidden
                className="absolute -inset-0.5 -z-10 rounded-[1.3rem] bg-[linear-gradient(135deg,#89BEFF,#8b7cff_45%,#c084fc)] opacity-30 blur-2xl"
              />
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="light rounded-2xl bg-card p-6 text-card-foreground ring-1 ring-black/5"
              >
                {children}
              </motion.div>
            </div>
          </div>

          {footer ? (
            <div className="absolute top-5 flex w-full justify-end px-6 text-sm text-muted-foreground">
              {footer}
            </div>
          ) : null}

          <div className="absolute bottom-5 left-0 flex w-full items-center justify-between px-6 text-xs text-muted-foreground">
            <span>{t('copyright', { year: new Date().getFullYear() })}</span>
          </div>
        </div>

        {/* Right / hero */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.5, ease: 'easeOut' }}
          className="relative order-2 hidden h-full overflow-hidden rounded-3xl bg-[#eef0f3] text-neutral-900 lg:flex"
        >
          <ShaderBg colorBack="#eef0f3" colorFront="#7a8494" speed={0.45} scale={1.4} />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(238,240,243,0)_0%,rgba(238,240,243,0.55)_100%)]" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#eef0f3]/70 via-[#eef0f3]/20 to-[#eef0f3]/80" />

          <div className="relative z-10 flex h-full w-full flex-col justify-between p-10">
            <div className="space-y-3">
              <h1 className="max-w-md font-medium text-2xl leading-tight text-neutral-900">
                {t('title')}
              </h1>
              <p className="max-w-md text-sm text-neutral-700">{t('subtitle')}</p>
            </div>

            <div className="flex w-full flex-wrap justify-between gap-6">
              {highlights.map((h) => (
                <div key={h.heading} className="min-w-[180px] flex-1 space-y-1">
                  <h2 className="font-medium text-sm text-neutral-900">{h.heading}</h2>
                  <p className="text-sm text-neutral-700">{h.body}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
