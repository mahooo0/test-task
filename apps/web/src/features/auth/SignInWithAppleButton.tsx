'use client';

import { useClerk, useSignIn } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { clerkErrorMessage, isSessionExistsError } from '@/lib/clerk-errors';
import { setLastAuthMethod } from '@/lib/last-auth-method';
import { cn } from '@/lib/utils';
import { LastUsedBadge } from '@/ui/last-used-badge';
import { AppleWhiteIcon } from '@/ui/oauth-icons';
import { RippleButton } from '@/ui/ripple-button';

interface SignInWithAppleButtonProps {
  className?: string;
  redirectTo?: string;
  lastUsed?: boolean;
}

/** Apple sign-in — official black surface per Apple brand guidelines. */
export function SignInWithAppleButton({
  className,
  redirectTo = '/',
  lastUsed = false,
}: SignInWithAppleButtonProps) {
  const t = useTranslations('auth');
  const { signIn, isLoaded } = useSignIn();
  const { signOut } = useClerk();
  const [pending, setPending] = useState(false);
  const busy = pending || !isLoaded;

  async function handleClick() {
    if (!isLoaded || !signIn) return;
    setPending(true);
    setLastAuthMethod('apple');
    const redirect = () =>
      signIn.authenticateWithRedirect({
        strategy: 'oauth_apple',
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
      console.error('[Apple OAuth]', err);
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
          // Apple brand guidance: black button on light, white button on dark.
          'border border-black bg-black text-white shadow-sm',
          'hover:bg-[#1a1a1a] hover:border-[#1a1a1a]',
          'dark:border-[#DADCE0] dark:bg-white dark:text-neutral-900',
          'dark:hover:bg-[#F8F9FA] dark:hover:border-[#C6C9CE]',
          className,
        )}
        disabled={busy}
        onClick={handleClick}
        rippleColor="#ffffff"
        rippleOpacity={0.25}
      >
        <AppleWhiteIcon className="size-5" />
        <span className="text-[15px] font-medium">Apple</span>
      </RippleButton>
    </div>
  );
}
