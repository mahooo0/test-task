'use client';

import type { BreadcrumbDto } from '@dataroom/types';
import { ChevronRight, MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { DROP_HIGHLIGHT, useDropTarget } from './dnd/use-drop';

/** Padding so the drop-highlight ring (shown when a valid drag hovers a crumb) has room to breathe. */
const crumbDropClass = '-mx-1 rounded-sm px-1';

/**
 * How many trailing crumbs stay visible when a deep trail is collapsed. Google-Drive-style: the root
 * + an overflow "…" menu for the middle ancestors + the last two crumbs (parent + current), so deep
 * trails no longer squeeze every ancestor into an unreadable sliver.
 */
const VISIBLE_TAIL = 2;

/** `trail` is root→current (from the API); "My Drive" (the room root) is prepended here. */
export function Breadcrumbs({ trail }: { trail: BreadcrumbDto[] }) {
  const t = useTranslations('common');
  // Collapse only when it buys space: keep the last two crumbs, tuck everything before them behind
  // an overflow menu. A short trail (≤ tail + 1) renders whole — an ellipsis for one crumb is noise.
  const collapsed = trail.length > VISIBLE_TAIL + 1;
  const hidden = collapsed ? trail.slice(0, trail.length - VISIBLE_TAIL) : [];
  const visible = collapsed ? trail.slice(trail.length - VISIBLE_TAIL) : trail;

  return (
    <nav aria-label={t('breadcrumb')} className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
      <RootCrumb isCurrent={trail.length === 0} />
      {collapsed && <OverflowCrumbs crumbs={hidden} />}
      {visible.map((crumb, index) => (
        <span key={crumb.id} className="flex min-w-0 items-center gap-1">
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
          {/* `visible` always ends on the real current folder, so its last entry is the current crumb. */}
          <CrumbLink crumb={crumb} isLast={index === visible.length - 1} />
        </span>
      ))}
    </nav>
  );
}

/** "My Drive" — a drop target for moving to the room root (`parentId: null`). */
function RootCrumb({ isCurrent }: { isCurrent: boolean }) {
  const t = useTranslations('nav');
  const { setNodeRef, highlight } = useDropTarget('crumb:root', null, t('myDrive'));
  if (isCurrent) {
    return (
      <span
        ref={setNodeRef}
        aria-current="page"
        className={cn('font-medium', crumbDropClass, highlight && DROP_HIGHLIGHT)}
      >
        {t('myDrive')}
      </span>
    );
  }
  return (
    <Link
      ref={setNodeRef}
      href="/"
      draggable={false}
      className={cn(
        'shrink-0 text-muted-foreground transition-colors hover:text-foreground',
        crumbDropClass,
        highlight && DROP_HIGHLIGHT,
      )}
    >
      {t('myDrive')}
    </Link>
  );
}

/** The hidden middle ancestors, tucked behind a "…" menu that opens to navigate to any of them. */
function OverflowCrumbs({ crumbs }: { crumbs: BreadcrumbDto[] }) {
  const t = useTranslations('items');
  return (
    <span className="flex shrink-0 items-center gap-1">
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t('showMore')}
          className="flex size-6 items-center justify-center rounded-sm text-muted-foreground outline-hidden transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-w-64">
          {crumbs.map((crumb) => (
            <DropdownMenuItem key={crumb.id} asChild>
              <Link href={`/folders/${crumb.id}`} draggable={false} className="cursor-pointer">
                <span className="truncate">{crumb.name}</span>
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}

/** An ancestor (or the current) folder crumb — a drop target for moving into that folder. */
function CrumbLink({ crumb, isLast }: { crumb: BreadcrumbDto; isLast: boolean }) {
  const { setNodeRef, highlight } = useDropTarget(`crumb:${crumb.id}`, crumb.id, crumb.name);
  if (isLast) {
    // The current folder: droppable for consistency, but items here already live in it (a no-op).
    return (
      <span
        ref={setNodeRef}
        aria-current="page"
        title={crumb.name}
        className={cn('max-w-[16rem] truncate font-medium', crumbDropClass, highlight && DROP_HIGHLIGHT)}
      >
        {crumb.name}
      </span>
    );
  }
  return (
    <Link
      ref={setNodeRef}
      href={`/folders/${crumb.id}`}
      draggable={false}
      title={crumb.name}
      className={cn(
        'max-w-[12rem] truncate text-muted-foreground transition-colors hover:text-foreground',
        crumbDropClass,
        highlight && DROP_HIGHLIGHT,
      )}
    >
      {crumb.name}
    </Link>
  );
}
