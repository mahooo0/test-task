'use client';

import type { ItemDto } from '@dataroom/types';
import { ChevronRight, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { DROP_HIGHLIGHT, useSidebarFolderDnd } from '@/features/items/dnd/use-drop';
import { FolderGlyph } from '@/features/items/icons';
import { useBreadcrumb, useFolderPicker } from '@/features/items/hooks';
import { NAV_ACTIVE } from './nav-active';

/** The folder id from a `/folders/:id` route, or `null` on any other page (root, starred, …). */
function folderIdFromPathname(pathname: string): string | null {
  const match = pathname.match(/^\/folders\/([^/]+)/);
  return match ? match[1] : null;
}

/**
 * Tighter indent than the shadcn default (`mx-3.5 px-2.5`) so a deep tree doesn't collapse into a
 * "pyramid": each level adds only a small step, and dropping the right margin/padding hands long
 * folder names the full remaining width — they stay on one line and truncate with an ellipsis.
 */
const TREE_SUB_CLASS = 'mx-0 ml-2.5 px-0 pl-2';

/** The room's top-level folders, shown under "My Drive". Fetched once; each node lazy-loads deeper. */
export function FolderTree() {
  const { data: folders, isError, isPaused, isSuccess, refetch } = useFolderPicker(null, true);
  const pathname = usePathname();
  const activeFolderId = folderIdFromPathname(pathname);
  // The active folder's root→current trail; drives which ancestors auto-expand so a deep folder
  // reached by breadcrumb, card, or search reveals itself in the tree.
  const { data: trail } = useBreadcrumb(activeFolderId);
  // Ancestors that must be expanded to reveal the active folder — every crumb except the folder
  // itself (which only needs highlighting, not expanding).
  const ancestorIds = useMemo(
    () => new Set((trail ?? []).slice(0, -1).map((crumb) => crumb.id)),
    [trail],
  );

  // A failed or offline-paused fetch must not masquerade as "no folders" — only a
  // genuine success renders the (possibly empty) tree; anything else is loading or error.
  if (isError || isPaused)
    return (
      <SidebarMenuSub className={TREE_SUB_CLASS}>
        <TreeError onRetry={() => void refetch()} />
      </SidebarMenuSub>
    );
  if (!isSuccess) return <TreeSkeleton />;
  if (!folders || folders.length === 0) return null;

  return (
    <SidebarMenuSub className={TREE_SUB_CLASS}>
      {folders.map((folder) => (
        <FolderTreeNode
          key={folder.id}
          folder={folder}
          activeFolderId={activeFolderId}
          ancestorIds={ancestorIds}
        />
      ))}
    </SidebarMenuSub>
  );
}

function FolderTreeNode({
  folder,
  activeFolderId,
  ancestorIds,
}: {
  folder: ItemDto;
  activeFolderId: string | null;
  ancestorIds: Set<string>;
}) {
  const t = useTranslations('nav');
  const active = folder.id === activeFolderId;
  // This node sits on the path to the active folder — expand it to reveal that folder.
  const onActivePath = ancestorIds.has(folder.id);
  const [open, setOpen] = useState(onActivePath);
  // Navigating (breadcrumb/card/search) can make this node an ancestor of the newly-active folder
  // after mount; open it then, while still letting the user collapse it again afterwards.
  useEffect(() => {
    if (onActivePath) setOpen(true);
  }, [onActivePath]);
  // A leaf folder (no subfolders) is never an accordion — no expand toggle, no lazy fetch.
  const expandable = folder.hasSubfolders === true;
  // Child folders load only while an expandable node is open; collapsing keeps the cached result.
  const { data: children, isError, isPaused, isSuccess, refetch } = useFolderPicker(
    folder.id,
    expandable && open,
  );
  // The node is both a drag source (grab it to move this folder) and a drop target (drop another
  // item onto it to move that item inside this folder).
  const { setNodeRef, listeners, isDragging, highlight } = useSidebarFolderDnd(folder);

  return (
    <SidebarMenuSubItem>
      <div className="flex items-center gap-0.5">
        {expandable ? (
          <button
            type="button"
            aria-label={t(open ? 'collapseFolder' : 'expandFolder', { name: folder.name })}
            aria-expanded={open}
            onClick={() => setOpen((prev) => !prev)}
            className="flex size-5 shrink-0 items-center justify-center rounded-sm text-sidebar-foreground/60 outline-hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <ChevronRight className={cn('size-3.5 transition-transform', open && 'rotate-90')} />
          </button>
        ) : (
          // Keep the chevron's slot so leaf names line up with expandable siblings.
          <span aria-hidden className="size-5 shrink-0" />
        )}
        <SidebarMenuSubButton
          asChild
          isActive={active}
          className={cn(NAV_ACTIVE, 'flex-1', isDragging && 'opacity-50', highlight && DROP_HIGHLIGHT)}
        >
          <Link ref={setNodeRef} {...listeners} href={`/folders/${folder.id}`} draggable={false}>
            {/* Keep the Drive-gray folder color (matching the home "Recommended folders"); override
                the sidebar button's `[&>svg]` recolor, which otherwise wins by specificity. */}
            <FolderGlyph className="text-[#5f6368]!" />
            <span>{folder.name}</span>
          </Link>
        </SidebarMenuSubButton>
      </div>

      {expandable &&
        open &&
        (isError || isPaused ? (
          <SidebarMenuSub className={TREE_SUB_CLASS}>
            <TreeError onRetry={() => void refetch()} />
          </SidebarMenuSub>
        ) : !isSuccess ? (
          <TreeSkeleton />
        ) : children && children.length > 0 ? (
          <SidebarMenuSub className={TREE_SUB_CLASS}>
            {children.map((child) => (
              <FolderTreeNode
                key={child.id}
                folder={child}
                activeFolderId={activeFolderId}
                ancestorIds={ancestorIds}
              />
            ))}
          </SidebarMenuSub>
        ) : (
          <SidebarMenuSub className={TREE_SUB_CLASS}>
            <li className="whitespace-nowrap px-2 py-1 text-sidebar-foreground/50 text-xs">
              {t('noSubfolders')}
            </li>
          </SidebarMenuSub>
        ))}
    </SidebarMenuSubItem>
  );
}

/** A node/root whose folder fetch failed: an honest, retryable affordance instead of a false "empty". */
function TreeError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('nav');
  return (
    <li className="px-2 py-1">
      <button
        type="button"
        onClick={onRetry}
        className="flex items-center gap-1.5 rounded-sm text-sidebar-foreground/60 text-xs outline-hidden hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
      >
        <RefreshCw className="size-3" />
        <span>{t('treeLoadFailed')}</span>
      </button>
    </li>
  );
}

function TreeSkeleton() {
  return (
    <SidebarMenuSub className={TREE_SUB_CLASS}>
      {[0, 1].map((i) => (
        <SidebarMenuSubItem key={i} className="flex h-7 items-center gap-2 px-2">
          <Skeleton className="size-3.5 rounded" />
          <Skeleton className="h-3.5 flex-1" />
        </SidebarMenuSubItem>
      ))}
    </SidebarMenuSub>
  );
}
