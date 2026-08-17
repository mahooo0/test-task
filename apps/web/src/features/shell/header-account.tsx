'use client';

import { useClerk, useUser } from '@clerk/nextjs';
import { LogOut, Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getInitials } from '@/lib/utils';

/** Header account control (mirrors the reference AccountSwitcher): rounded-lg avatar + menu. */
export function HeaderAccount() {
  const t = useTranslations('account');
  const { user } = useUser();
  const { signOut, openUserProfile } = useClerk();

  const name = user?.fullName ?? user?.username ?? t('account');
  const email = user?.primaryEmailAddress?.emailAddress ?? '';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('account')}
          className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <Avatar className="size-8 rounded-lg">
            <AvatarImage src={user?.imageUrl} alt={name} />
            <AvatarFallback className="rounded-lg">{getInitials(name)}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-56 rounded-lg" side="bottom" align="end" sideOffset={4}>
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex w-full items-center gap-2 px-1 py-1.5">
            <Avatar className="size-9 rounded-lg">
              <AvatarImage src={user?.imageUrl} alt={name} />
              <AvatarFallback className="rounded-lg">{getInitials(name)}</AvatarFallback>
            </Avatar>
            <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">{name}</span>
              {email && <span className="truncate text-muted-foreground text-xs">{email}</span>}
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => openUserProfile()}>
          <Settings />
          {t('settings')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut({ redirectUrl: '/sign-in' })}>
          <LogOut />
          {t('signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
