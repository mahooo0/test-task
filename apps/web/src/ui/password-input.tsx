'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ComponentProps, useState } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

type PasswordInputProps = Omit<ComponentProps<'input'>, 'type'>;

/** A password field with a show/hide toggle. */
export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const t = useTranslations('auth');
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} className={cn('pr-11', className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t('hidePassword') : t('showPassword')}
        className="absolute inset-y-0 right-0 flex items-center px-3.5 text-muted-foreground transition hover:text-foreground"
      >
        {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  );
}
