'use client';

import { useClerk, useUser } from '@clerk/nextjs';
import { ChevronsUpDown, LogOut, Settings } from 'lucide-react';
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
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar';

/** Sidebar-footer account control: avatar + identity, with a sign-out menu. */
export function NavUser() {
  const t = useTranslations('account');
  const { user } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const { isMobile } = useSidebar();

  const name = user?.fullName ?? user?.username ?? t('account');
  const email = user?.primaryEmailAddress?.emailAddress ?? '';
  const initials = (name.trim()[0] ?? 'U').toUpperCase();

  const identity = (
    <div className="grid flex-1 text-left text-sm leading-tight">
      <span className="truncate font-medium">{name}</span>
      {email && <span className="truncate text-muted-foreground text-xs">{email}</span>}
    </div>
  );

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
              <Avatar className="size-8 rounded-lg">
                <AvatarImage src={user?.imageUrl} alt={name} />
                <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
              </Avatar>
              {identity}
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
            className="w-56"
          >
            <DropdownMenuLabel className="p-2 font-normal">
              <div className="flex items-center gap-2">
                <Avatar className="size-8 rounded-lg">
                  <AvatarImage src={user?.imageUrl} alt={name} />
                  <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                </Avatar>
                {identity}
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
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
