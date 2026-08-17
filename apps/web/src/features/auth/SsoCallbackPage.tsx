'use client';

import { AuthenticateWithRedirectCallback } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import { FullPageSpinner } from '@/ui/full-page-spinner';

/** Lands here after an OAuth redirect; Clerk finishes the handshake then redirects. */
export function SsoCallbackPage() {
  const t = useTranslations('auth');
  return (
    <>
      <FullPageSpinner label={t('finishingSignIn')} />
      <AuthenticateWithRedirectCallback signInFallbackRedirectUrl="/" signUpFallbackRedirectUrl="/" />
    </>
  );
}
