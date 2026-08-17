'use client';

import { useClerk, useSignIn } from '@clerk/nextjs';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import posthog from 'posthog-js';
import { clerkErrorMessage, isSessionExistsError } from '@/lib/clerk-errors';
import { setLastAuthMethod } from '@/lib/last-auth-method';
import { GRADIENT_BTN } from '@/lib/styles';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/ui/input-otp';
import { Label } from '@/components/ui/label';
import { LastUsedBadge } from '@/ui/last-used-badge';
import { PasswordInput } from '@/ui/password-input';
import { RippleButton } from '@/ui/ripple-button';

type Step = 'credentials' | 'secondFactor';

/** The resolved sign-in resource returned by Clerk's create/attempt calls. */
type SignInAttempt = NonNullable<ReturnType<typeof useSignIn>['signIn']>;

interface SignInWithPasswordFormProps {
  redirectTo?: string;
  lastUsed?: boolean;
}

export function SignInWithPasswordForm({
  redirectTo = '/',
  lastUsed = false,
}: SignInWithPasswordFormProps) {
  const t = useTranslations('auth');
  const { signIn, setActive, isLoaded } = useSignIn();
  const { signOut } = useClerk();
  const router = useRouter();
  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);

  async function completeSignIn(sessionId: string) {
    if (!setActive) return;
    setLastAuthMethod('email');
    await setActive({ session: sessionId });
    posthog.capture('user_signed_in', { method: 'email_password' });
    router.push(redirectTo);
  }

  /** Route a Clerk sign-in result: finish, prompt for 2FA, or show a clear message. */
  async function handleSignInResult(res: SignInAttempt) {
    switch (res.status) {
      case 'complete':
        if (res.createdSessionId) await completeSignIn(res.createdSessionId);
        return;
      case 'needs_second_factor':
        setStep('secondFactor');
        toast.message(t('needsSecondFactor'));
        return;
      case 'needs_first_factor':
        toast.error(t('needsFirstFactor'));
        return;
      case 'needs_new_password':
        toast.error(t('needsNewPassword'));
        return;
      default:
        toast.error(t('errors.fallback'));
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isLoaded || !signIn || pending) return;
    setPending(true);

    const attempt = async () => {
      const res = await signIn.create({ identifier: email, password });
      await handleSignInResult(res);
    };

    try {
      try {
        await attempt();
      } catch (err) {
        if (isSessionExistsError(err)) {
          await signOut();
          await attempt();
        } else {
          throw err;
        }
      }
    } catch (err) {
      toast.error(clerkErrorMessage(err, t));
    } finally {
      setPending(false);
    }
  }

  async function verifySecondFactor(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isLoaded || !signIn || pending) return;
    if (code.length !== 6) return;
    setPending(true);
    try {
      const res = await signIn.attemptSecondFactor({ strategy: 'totp', code });
      await handleSignInResult(res);
    } catch (err) {
      setCode('');
      toast.error(clerkErrorMessage(err, t));
    } finally {
      setPending(false);
    }
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {step === 'credentials' ? (
        <motion.form
          key="credentials"
          onSubmit={submit}
          className="flex flex-col gap-4"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={{ duration: 0.25 }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="email">{t('email')}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder={t('emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="h-12 rounded-xl px-4 text-[15px]"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="password">{t('password')}</Label>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-12 rounded-xl px-4 text-[15px]"
            />
          </div>
          <div className="relative">
            {lastUsed ? <LastUsedBadge /> : null}
            <RippleButton
              type="submit"
              variant="outline"
              size="lg"
              disabled={pending}
              className={cn(GRADIENT_BTN, 'w-full justify-center rounded-xl')}
              rippleColor="#89BEFF"
            >
              {pending ? t('signingIn') : t('signIn')}
            </RippleButton>
          </div>
        </motion.form>
      ) : (
        <motion.form
          key="secondFactor"
          onSubmit={verifySecondFactor}
          className="flex flex-col gap-4"
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={{ duration: 0.25 }}
        >
          <div className="grid gap-2 text-center">
            <p className="text-sm font-medium text-foreground">{t('secondFactorTitle')}</p>
            <p className="text-sm text-muted-foreground">{t('secondFactorDescription')}</p>
            <div className="mt-1 flex justify-center">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={setCode}
                autoFocus
                onComplete={(value) => {
                  if (value.length === 6) {
                    void verifySecondFactor({
                      preventDefault: () => {},
                    } as unknown as FormEvent<HTMLFormElement>);
                  }
                }}
              >
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>
          <RippleButton
            type="submit"
            variant="outline"
            size="lg"
            disabled={pending || code.length !== 6}
            className={cn(GRADIENT_BTN, 'w-full justify-center rounded-xl')}
            rippleColor="#89BEFF"
          >
            {pending ? t('signingIn') : t('signIn')}
          </RippleButton>
          <button
            type="button"
            className="text-center text-xs text-muted-foreground transition hover:text-foreground"
            onClick={() => {
              setCode('');
              setStep('credentials');
            }}
          >
            {t('useDifferentDetails')}
          </button>
        </motion.form>
      )}
    </AnimatePresence>
  );
}
