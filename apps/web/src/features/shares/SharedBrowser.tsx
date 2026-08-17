'use client';

import { ChevronRight, Eye, FolderOpen, Home } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBytes } from '@/features/items/format';
import { usePdfPreview } from '@/features/items/preview/pdf-preview';
import { ItemIcon } from '@/features/items/presentation';
import { getInitials } from '@/lib/utils';
import { type SharedSource, useSharedBrowse } from './use-shared-browse';

export type { SharedSource };

/**
 * Standalone read-only browser over a shared resource — the public `/s/[token]` landing (no app
 * shell). Lists the shared subtree, lets you open subfolders, and opens a file's PDF in the same
 * in-app viewer via a short-lived presigned URL. Signed-in grantees browse the same resource inline
 * on `/personal` via {@link SharedInlineDrive}; both share {@link useSharedBrowse}.
 */
export function SharedBrowser({ source }: { source: SharedSource }) {
  const t = useTranslations('share');
  const locale = useLocale();
  const preview = usePdfPreview();
  const {
    resolve,
    list,
    view,
    ownerName,
    isFileShare,
    rows,
    stack,
    previewSource,
    openFolder,
    goToRoot,
    goToCrumb,
  } = useSharedBrowse(source);

  const openItem = (item: (typeof rows)[number]) =>
    item.type === 'FOLDER' ? openFolder(item) : preview.open(item, previewSource);

  if (resolve.isError) {
    return <SharedError />;
  }
  if (!view) {
    return <SharedSkeleton />;
  }

  const rootName = view.root?.name ?? `${t('roomLabel')} · ${view.roomName}`;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-4 sm:p-8">
      {/* Header — what's shared + who by + view-only */}
      <header className="flex flex-col gap-3 border-b pb-5">
        <div className="flex items-center gap-3">
          {view.root ? (
            <ItemIcon item={view.root} className="size-7" />
          ) : (
            <FolderOpen className="size-7 text-muted-foreground" />
          )}
          <h1 className="min-w-0 truncate font-semibold text-xl">{rootName}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-muted-foreground text-sm">
          <span className="flex items-center gap-2">
            <Avatar className="size-6">
              {view.owner.avatarUrl && <AvatarImage src={view.owner.avatarUrl} alt="" />}
              <AvatarFallback className="text-[10px]">{getInitials(ownerName)}</AvatarFallback>
            </Avatar>
            {t('sharedBy', { name: ownerName })}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs">
            <Eye className="size-3.5" />
            {t('viewOnly')}
          </span>
        </div>
      </header>

      {/* In-scope breadcrumb (root + navigated folders) — not shown for a single-file share */}
      {!isFileShare ? (
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          <button
            type="button"
            onClick={goToRoot}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Home className="size-3.5" />
            {view.root?.name ?? view.roomName}
          </button>
          {stack.map((crumb, i) => (
            <span key={crumb.id ?? 'root'} className="flex items-center gap-1">
              <ChevronRight className="size-3.5 text-muted-foreground" />
              <button
                type="button"
                onClick={() => goToCrumb(i)}
                className="rounded px-1.5 py-0.5 hover:bg-muted"
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </nav>
      ) : null}

      {/* Listing */}
      {!isFileShare && list.isLoading ? (
        <ListSkeleton />
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground text-sm">{t('emptyFolder')}</p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => openItem(item)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-muted"
              >
                <ItemIcon item={item} className="size-5 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-sm">{item.name}</span>
                {item.type === 'FILE' && item.sizeBytes != null && (
                  <span className="shrink-0 text-muted-foreground text-xs">
                    {formatBytes(item.sizeBytes, locale)}
                  </span>
                )}
                {item.type === 'FOLDER' && (
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SharedError() {
  const t = useTranslations('share');
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-24 text-center">
      <h1 className="font-semibold text-lg">{t('notFoundTitle')}</h1>
      <p className="text-muted-foreground text-sm">{t('notFoundBody')}</p>
    </div>
  );
}

function SharedSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-4 sm:p-8">
      <div className="flex items-center gap-3 border-b pb-5">
        <Skeleton className="size-7 rounded" />
        <Skeleton className="h-6 w-48" />
      </div>
      <ListSkeleton />
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length static skeleton
        <div key={i} className="flex items-center gap-3 px-3 py-2.5">
          <Skeleton className="size-5 rounded" />
          <Skeleton className="h-4 w-40" />
        </div>
      ))}
    </div>
  );
}
