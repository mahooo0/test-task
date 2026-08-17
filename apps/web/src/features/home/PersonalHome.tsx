'use client';

import { useAuth } from '@clerk/nextjs';
import type { ItemDto, SharedResourceView } from '@dataroom/types';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { useTheme } from '@/app/ThemeProvider';
import { Skeleton } from '@/components/ui/skeleton';
import { DriveTimeline } from '@/features/items/DriveTimeline';
import { EmptyState } from '@/features/items/EmptyState';
import { FolderGlyph } from '@/features/items/icons';
import { DriveGrid } from '@/features/items/grid/DriveGrid';
import { ViewToggle } from '@/features/items/grid/ViewToggle';
import { useAllFolders, useDriveItems } from '@/features/items/hooks';
import { DriveDialogs, useDriveDialogs } from '@/features/items/ItemActionDialogs';
import { ItemsTable } from '@/features/items/ItemsTable';
import { type PreviewSource, usePdfPreview } from '@/features/items/preview/pdf-preview';
import { HomeSearch } from '@/features/search/HomeSearch';
import { sharesApi } from '@/features/shares/api';
import { SharedInlineDrive } from '@/features/shares/SharedInlineDrive';
import { SharedWithMeSection } from '@/features/shares/SharedWithMeSection';
import { cn, displayPersonName } from '@/lib/utils';

/**
 * "Личные" — a Google Drive-style welcome dashboard: search, quick filter chips, and collapsible
 * "Рекомендуемые папки" / "Рекомендуемые файлы" sections over the room root (real data). Each
 * section only renders when it has items — an empty section shows no title. A drive with neither
 * folders nor files falls back to the upload dropzone.
 */
export function PersonalHome({
  initialShareId = null,
  highlightShareId = null,
}: {
  /** A resource shared with you to open inline on mount (`?share=<id>`), or null for the normal home. */
  initialShareId?: string | null;
  /** A "Доступно мне" card to scroll to + pulse on arrival (`?highlight=<id>` from the share toast). */
  highlightShareId?: string | null;
}) {
  const t = useTranslations('home');
  const { viewMode, sortField, sortDir } = useTheme();
  const { getToken } = useAuth();
  const preview = usePdfPreview();
  const router = useRouter();
  const { dialog, onAction, openNew, close } = useDriveDialogs();

  // A shared folder/room browses inline (replacing the home body); a shared file opens straight in
  // the PDF viewer. The open share lives entirely in the URL (`?share=`), driven through the router,
  // so it stays in sync with the route: the sidebar "Личные" link and the share toast both close it
  // by navigating back to /personal, and a refresh restores it.
  const openShareId = initialShareId;

  const openShare = useCallback(
    (share: SharedResourceView) => {
      if (share.root?.type === 'FILE') {
        // A shared file opens like an owned one — same viewer, reading through the grantee endpoints.
        const source: PreviewSource = {
          previewUrl: async (id) =>
            (await sharesApi.granteePreviewUrl(await getToken(), share.shareId, id)).url,
          downloadUrl: async (id) =>
            (await sharesApi.granteeDownloadUrl(await getToken(), share.shareId, id)).url,
          owner: {
            name: displayPersonName(share.owner.name, share.owner.email),
            avatarUrl: share.owner.avatarUrl,
          },
        };
        preview.open(share.root, source);
        return;
      }
      router.replace(`/personal?share=${encodeURIComponent(share.shareId)}`, { scroll: false });
    },
    [getToken, preview, router],
  );

  const exitShare = useCallback(() => {
    router.replace('/personal', { scroll: false });
  }, [router]);

  // Landing here from a toast (`?highlight=`) hands the id straight to the section, which pulses the
  // card; strip just the query afterwards (URL-only, no reload) so a refresh doesn't re-pulse.
  useEffect(() => {
    if (highlightShareId && typeof window !== 'undefined') {
      window.history.replaceState(null, '', '/personal');
    }
  }, [highlightShareId]);
  // Timeline groups by createdAt → page it created-desc so load-more stays chronological.
  const items = useDriveItems(
    null,
    viewMode === 'timeline' ? 'created' : sortField,
    viewMode === 'timeline' ? 'desc' : sortDir,
  );
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = items;
  const files = (items.data?.pages.flatMap((page) => page.items) ?? []).filter(
    (item) => item.type === 'FILE',
  );

  // Up to six folders from ANYWHERE in the room (not just the root), so moving a folder between
  // locations never drops it from this section.
  const foldersQuery = useAllFolders(6);
  const folders = foldersQuery.data?.folders ?? [];
  const folderNameById = foldersQuery.data?.nameById ?? {};

  // Folders always group ahead of files server-side, so a folder-heavy root can fill whole keyset
  // pages with folders before any file appears. Keep pulling pages until a file surfaces (or the
  // listing is exhausted) so the files section never falsely reads empty.
  const noFilesYet = files.length === 0 && hasNextPage;
  useEffect(() => {
    if (noFilesYet && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [noFilesYet, isFetchingNextPage, fetchNextPage]);

  const foldersLoading = foldersQuery.isPending;
  const filesLoading = items.isPending || noFilesYet;
  const hasFolders = folders.length > 0;
  const hasFiles = files.length > 0;
  // Only a genuinely empty drive (no folders AND no files) gets the dropzone — and no section titles.
  const isEmptyDrive = !foldersLoading && !filesLoading && !hasFolders && !hasFiles;

  // A shared resource is open → browse it inline in place of the dashboard (still on /personal).
  if (openShareId) {
    return (
      <div className="flex min-h-full w-full flex-col py-2">
        <SharedInlineDrive shareId={openShareId} onExit={exitShare} />
      </div>
    );
  }

  return (
    <div className="flex min-h-full w-full flex-col gap-8 py-2">
      <header className="flex flex-col items-center gap-6 pt-4 text-center">
        <h1 className="font-semibold text-2xl">{t('welcome')}</h1>
        {/* Search + its Тип / Люди / Изменено filters live together inside this dropdown; picking a
            filter stages it, and "Все результаты" opens /search with the term + filters applied. */}
        <HomeSearch />
      </header>

      {/* Folders — collapsible; only shown when there are folders (no title otherwise). */}
      {foldersLoading ? (
        <FoldersSkeleton />
      ) : hasFolders ? (
        <RecommendedFolders folders={folders} nameById={folderNameById} />
      ) : null}

      {/* Files — collapsible; only shown when there are files (no title otherwise). */}
      {filesLoading ? (
        <FilesSkeleton />
      ) : hasFiles ? (
        <CollapsibleSection title={t('recommendedFiles')} action={<ViewToggle />}>
          {viewMode === 'grid' ? (
            <DriveGrid
              items={files}
              onAction={onAction}
              hasNextPage={!!items.hasNextPage}
              isFetchingNextPage={items.isFetchingNextPage}
              onLoadMore={() => void items.fetchNextPage()}
            />
          ) : viewMode === 'timeline' ? (
            <DriveTimeline
              items={files}
              onAction={onAction}
              hasNextPage={!!items.hasNextPage}
              isFetchingNextPage={items.isFetchingNextPage}
              onLoadMore={() => void items.fetchNextPage()}
            />
          ) : (
            <ItemsTable
              items={files}
              onAction={onAction}
              hasNextPage={!!items.hasNextPage}
              isFetchingNextPage={items.isFetchingNextPage}
              onLoadMore={() => void items.fetchNextPage()}
            />
          )}
        </CollapsibleSection>
      ) : null}

      {/* "Доступно мне" — resources others shared with you; renders nothing when there are none.
          A card opens the resource inline (folder/room) or in the PDF viewer (file). */}
      <SharedWithMeSection onOpen={openShare} highlightShareId={highlightShareId} />

      {/* Nothing at all → the drive's upload component, stretched to fill the rest of the page. */}
      {isEmptyDrive && (
        <div className="flex flex-1">
          <EmptyState parentId={null} onNewFolder={openNew} />
        </div>
      )}

      <DriveDialogs parentId={null} dialog={dialog} onOpenChange={close} />
    </div>
  );
}

/**
 * A section with a collapsible body: click the title (chevron) to fold it away. Defaults to open; an
 * optional `action` (e.g. the view toggle) sits opposite the title and stays visible when collapsed.
 */
function CollapsibleSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          className="-ml-2 flex items-center gap-1.5 rounded-md px-2 py-1 font-medium text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {title}
          <ChevronDown
            className={cn('size-4 opacity-60 transition-transform', open && 'rotate-180')}
          />
        </button>
        {action}
      </div>
      {open && children}
    </section>
  );
}

/** Recommended folders (from anywhere in the room), as collapsible cards labelled by their parent. */
function RecommendedFolders({
  folders,
  nameById,
}: {
  folders: ItemDto[];
  nameById: Record<string, string>;
}) {
  const t = useTranslations('home');
  const tNav = useTranslations('nav');
  return (
    <CollapsibleSection title={t('recommendedFolders')}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {folders.slice(0, 6).map((folder) => {
          // The real parent folder's name; a root-level folder's parent is the drive itself.
          const parentName = folder.parentId
            ? (nameById[folder.parentId] ?? tNav('myDrive'))
            : tNav('myDrive');
          return (
            <Link
              key={folder.id}
              href={`/folders/${folder.id}`}
              className="flex items-center gap-3 rounded-lg border bg-card px-3 py-3 outline-none transition-colors hover:border-foreground/20 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <FolderGlyph className="size-6" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-sm">{folder.name}</div>
                <div className="truncate text-muted-foreground text-xs">
                  {t('parentFolder', { name: parentName })}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </CollapsibleSection>
  );
}

function FoldersSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {['a', 'b', 'c'].map((key) => (
        <Skeleton key={key} className="h-16 rounded-lg" />
      ))}
    </div>
  );
}

function FilesSkeleton() {
  return (
    <div>
      <div className="border-b px-3 py-2">
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="space-y-1 py-1">
        {['a', 'b', 'c', 'd', 'e'].map((key) => (
          <div key={key} className="flex items-center gap-2.5 px-3 py-2">
            <Skeleton className="size-4 rounded" />
            <Skeleton className="h-4 w-48" />
          </div>
        ))}
      </div>
    </div>
  );
}
