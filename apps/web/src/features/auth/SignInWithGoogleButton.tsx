'use client';

import { useClerk, useSignIn } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { clerkErrorMessage, isSessionExistsError } from '@/lib/clerk-errors';
import { setLastAuthMethod } from '@/lib/last-auth-method';
import { cn } from '@/lib/utils';
import { LastUsedBadge } from '@/ui/last-used-badge';
import { GoogleColorIcon } from '@/ui/oauth-icons';
import { RippleButton } from '@/ui/ripple-button';

interface SignInWithGoogleButtonProps {
  className?: string;
  redirectTo?: string;
  lastUsed?: boolean;
}

/** Neutral white Google button — leave the blue gradient for the primary CTA. */
export function SignInWithGoogleButton({
  className,
  redirectTo = '/',
  lastUsed = false,
}: SignInWithGoogleButtonProps) {
  const t = useTranslations('auth');
  const { signIn, isLoaded } = useSignIn();
  const { signOut } = useClerk();
  const [pending, setPending] = useState(false);
  const busy = pending || !isLoaded;

  async function handleClick() {
    if (!isLoaded || !signIn) return;
    setPending(true);
    setLastAuthMethod('google');
    const redirect = () =>
      signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: `${window.location.origin}/sso-callback`,
        redirectUrlComplete: `${window.location.origin}${redirectTo}`,
      });
    try {
      try {
        await redirect();
      } catch (err) {
        if (isSessionExistsError(err)) {
          await signOut();
          await redirect();
        } else {
          throw err;
        }
      }
    } catch (err) {
      setPending(false);
      console.error('[Google OAuth]', err);
      toast.error(clerkErrorMessage(err, t));
    }
  }

  return (
    <div className="relative">
      {lastUsed ? <LastUsedBadge /> : null}
      <RippleButton
        size="lg"
        className={cn(
          'h-12 w-full justify-center gap-2 rounded-xl',
          'border border-[#DADCE0] bg-white text-neutral-900 shadow-sm',
          'hover:bg-[#F8F9FA] hover:border-[#C6C9CE]',
          'dark:bg-white dark:text-neutral-900 dark:border-[#DADCE0]',
          className,
        )}
        disabled={busy}
        onClick={handleClick}
        rippleColor="#4285F4"
        rippleOpacity={0.18}
      >
        <GoogleColorIcon className="size-5" />
        <span className="text-[15px] font-medium">Google</span>
      </RippleButton>
    </div>
  );
}
