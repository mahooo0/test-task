'use client';

import { useAuth } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { SignInWithAppleButton } from '@/features/auth/SignInWithAppleButton';
import { SignInWithGoogleButton } from '@/features/auth/SignInWithGoogleButton';
import { SignInWithPasswordForm } from '@/features/auth/SignInWithPasswordForm';
import { type AuthMethod, getLastAuthMethod } from '@/lib/last-auth-method';
import { FullPageSpinner } from '@/ui/full-page-spinner';
import { Wordmark } from '@/ui/wordmark';

export function SignInPage() {
  const t = useTranslations('auth');
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  // Read after mount to avoid an SSR/client hydration mismatch on the badge.
  const [lastMethod, setLastMethod] = useState<AuthMethod | null>(null);

  useEffect(() => {
    setLastMethod(getLastAuthMethod());
  }, []);

  useEffect(() => {
    if (isLoaded && isSignedIn) router.replace('/');
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded || isSignedIn) return <FullPageSpinner label={t('loading')} />;

  return (
    <AuthLayout>
      <div className="flex flex-col items-center gap-3 text-center">
        <Wordmark />
        <p className="text-sm text-muted-foreground">{t('signInSubtitle')}</p>
      </div>

      <div className="mt-8 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <SignInWithGoogleButton lastUsed={lastMethod === 'google'} />
          <SignInWithAppleButton lastUsed={lastMethod === 'apple'} />
        </div>

        <div className="relative py-1 text-center text-xs uppercase tracking-widest">
          <div className="absolute inset-0 top-1/2 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <span className="relative bg-background px-3 text-muted-foreground">{t('orWithEmail')}</span>
        </div>

        <SignInWithPasswordForm lastUsed={lastMethod === 'email'} />
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t('newHere')}{' '}
        <Link
          href="/sign-up"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {t('createAccount')}
        </Link>
      </p>
    </AuthLayout>
  );
}
