'use client';

import { useClerk, useSignUp } from '@clerk/nextjs';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { clerkErrorMessage, isSessionExistsError } from '@/lib/clerk-errors';
import { setLastAuthMethod } from '@/lib/last-auth-method';
import { GRADIENT_BTN } from '@/lib/styles';
import { cn } from '@/lib/utils';
import { Input } from '@/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/ui/input-otp';
import { Label } from '@/ui/label';
import { PasswordInput } from '@/ui/password-input';
import { RippleButton } from '@/ui/ripple-button';

type Step = 'form' | 'code';

/** Seconds a user must wait before requesting a fresh verification code. */
const RESEND_COOLDOWN_SECONDS = 30;

interface SignUpWithPasswordFormProps {
  redirectTo?: string;
}

export function SignUpWithPasswordForm({ redirectTo = '/' }: SignUpWithPasswordFormProps) {
  const t = useTranslations('auth');
  const { signUp, setActive, isLoaded } = useSignUp();
  const { signOut } = useClerk();
  const router = useRouter();
  const [step, setStep] = useState<Step>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  async function createAccount(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isLoaded || !signUp || pending) return;
    setPending(true);
    const start = async () => {
      await signUp.create({ emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
    };
    try {
      try {
        await start();
      } catch (err) {
        if (isSessionExistsError(err)) {
          await signOut();
          await start();
        } else {
          throw err;
        }
      }
      setStep('code');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      toast.success(t('codeSent', { email }));
    } catch (err) {
      toast.error(clerkErrorMessage(err, t));
    } finally {
      setPending(false);
    }
  }

  async function resendCode() {
    if (!isLoaded || !signUp || pending || resendCooldown > 0) return;
    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setCode('');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      toast.success(t('codeResent', { email }));
    } catch (err) {
      toast.error(clerkErrorMessage(err, t));
    }
  }

  async function verifyCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isLoaded || !signUp || pending) return;
    if (code.length !== 6) return;
    setPending(true);
    try {
      const attempt = await signUp.attemptEmailAddressVerification({ code });
      if (attempt.status === 'complete' && attempt.createdSessionId) {
        setLastAuthMethod('email');
        await setActive({ session: attempt.createdSessionId });
        router.push(redirectTo);
      } else {
        toast.error(t('verificationIncomplete', { status: String(attempt.status) }));
      }
    } catch (err) {
      setCode('');
      toast.error(clerkErrorMessage(err, t));
    } finally {
      setPending(false);
    }
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {step === 'form' ? (
        <motion.form
          key="form"
          onSubmit={createAccount}
          className="flex flex-col gap-4"
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
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
              autoComplete="new-password"
              placeholder={t('passwordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="h-12 rounded-xl px-4 text-[15px]"
            />
          </div>
          <RippleButton
            type="submit"
            variant="outline"
            size="lg"
            disabled={pending}
            className={cn(GRADIENT_BTN, 'w-full justify-center rounded-xl')}
            rippleColor="#89BEFF"
          >
            {pending ? t('creatingAccount') : t('createAccountButton')}
          </RippleButton>
        </motion.form>
      ) : (
        <motion.form
          key="code"
          onSubmit={verifyCode}
          className="flex flex-col gap-4"
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={{ duration: 0.25 }}
        >
          <div className="grid gap-2 text-center">
            <p className="text-sm text-muted-foreground">
              {t.rich('enterCode', {
                email,
                highlight: (chunks) => <span className="text-foreground">{chunks}</span>,
              })}
            </p>
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={setCode}
                autoFocus
                onComplete={(value) => {
                  if (value.length === 6) {
                    void verifyCode({
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
            {pending ? t('verifying') : t('verifyContinue')}
          </RippleButton>
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              disabled={pending || resendCooldown > 0}
              className="text-xs text-muted-foreground transition hover:text-foreground disabled:pointer-events-none disabled:opacity-60"
              onClick={resendCode}
            >
              {resendCooldown > 0
                ? t('resendCooldown', { seconds: resendCooldown })
                : t('resendCode')}
            </button>
            <button
              type="button"
              className="text-xs text-muted-foreground transition hover:text-foreground"
              onClick={() => {
                setCode('');
                setStep('form');
              }}
            >
              {t('useDifferentDetails')}
            </button>
          </div>
        </motion.form>
      )}
    </AnimatePresence>
  );
}
