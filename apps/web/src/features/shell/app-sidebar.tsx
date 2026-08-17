'use client';

import { HardDrive, House, Star, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentProps } from 'react';
import logo from '@/assets/logo.webp';
import { DROP_HIGHLIGHT, useDropTarget } from '@/features/items/dnd/use-drop';
import { cn } from '@/lib/utils';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { FolderTree } from './folder-tree';
import { NAV_ACTIVE } from './nav-active';
import { NavUser } from './nav-user';
import { SidebarCreateButton } from './sidebar-create-button';
import { SidebarResizeHandle } from './sidebar-resize';

export function AppSidebar(props: ComponentProps<typeof Sidebar>) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  // "My Drive" is a drop target too: dragging an item onto it moves the item to the room root.
  const rootDrop = useDropTarget('sidebar:root', null, t('myDrive'));

  return (
    <Sidebar {...props}>
      {/* Brand row is h-14 with a bottom border so it lines up exactly with the
          main header's bottom border — one continuous line across sidebar + header. */}
      <SidebarHeader className="h-14 justify-center border-b border-sidebar-border p-0">
        <Link
          href="/"
          className="flex h-full items-center justify-center gap-2 px-2 group-data-[collapsible=icon]:gap-0"
        >
          <img
            src={logo.src}
            alt=""
            className="size-9 shrink-0 object-contain group-data-[collapsible=icon]:size-6"
          />
          {/* Animate the wordmark's width/opacity on collapse; `whitespace-nowrap` stops the ugly
              two-line wrap while the sidebar shrinks. */}
          <span className="max-w-[10rem] overflow-hidden whitespace-nowrap font-semibold text-lg opacity-100 transition-all duration-200 group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:opacity-0">
            Data Room
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarCreateButton />

        <SidebarGroup>
          <SidebarGroupLabel>{t('workspace')}</SidebarGroupLabel>
          <SidebarMenu className="gap-1">
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === '/personal'}
                tooltip={t('personal')}
                className={NAV_ACTIVE}
              >
                <Link href="/personal" draggable={false}>
                  <House />
                  <span>{t('personal')}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                // Stay active across the whole owned-drive subtree — the root and any
                // `/folders/*` page — without also lighting up Starred/Trash/Search/Shared.
                isActive={pathname === '/' || pathname.startsWith('/folders/')}
                tooltip={t('myDrive')}
                className={cn(NAV_ACTIVE, rootDrop.highlight && DROP_HIGHLIGHT)}
              >
                <Link ref={rootDrop.setNodeRef} href="/" draggable={false}>
                  <HardDrive />
                  <span>{t('myDrive')}</span>
                </Link>
              </SidebarMenuButton>
              <FolderTree />
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === '/starred'}
                tooltip={t('starred')}
                className={NAV_ACTIVE}
              >
                <Link href="/starred" draggable={false}>
                  <Star />
                  <span>{t('starred')}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === '/trash'}
                tooltip={t('trash')}
                className={NAV_ACTIVE}
              >
                <Link href="/trash" draggable={false}>
                  <Trash2 />
                  <span>{t('trash')}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>

      {/* Drag handle on the right edge to resize the sidebar width. */}
      <SidebarResizeHandle />
    </Sidebar>
  );
}
