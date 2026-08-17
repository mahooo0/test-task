'use client';

import { RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { useTheme } from '@/app/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DriveTimeline } from '@/features/items/DriveTimeline';
import { DriveGrid } from '@/features/items/grid/DriveGrid';
import { ViewToggle } from '@/features/items/grid/ViewToggle';
import { useItemSearch } from '@/features/items/hooks';
import { DriveDialogs, useDriveDialogs } from '@/features/items/ItemActionDialogs';
import { ItemsTable } from '@/features/items/ItemsTable';
import { sortItems } from '@/features/items/sort-items';
import { useSharedDrive } from '@/features/shares/use-shared-drive';
import {
  applyFilters,
  buildSearchQuery,
  parseFilters,
  type SearchFilters as Filters,
} from './filters';
import { ResultsSearch } from './ResultsSearch';
import { SearchFilters } from './SearchFilters';

/** Result cap for the full page (backend allows up to 50). */
const SEARCH_LIMIT = 50;

/**
 * The "Все результаты" page: the drive list / grid / timeline over the search hits, with the
 * Тип / Люди / Изменено filter chips beneath the title. Term + filters live in the URL; the term
 * is matched server-side (empty term ⇒ browse the whole room), the filters are applied client-side.
 * With no term and no filter it defaults to browsing everything, so the page always shows the drive.
 */
export function SearchResults({
  query,
  type,
  modified,
  person,
}: {
  query: string;
  type?: string;
  modified?: string;
  person?: string;
}) {
  const q = query.trim();
  const t = useTranslations('search');
  const router = useRouter();
  const { viewMode, sortField, sortDir } = useTheme();
  const { dialog, onAction, close } = useDriveDialogs();

  const filters = useMemo(() => parseFilters({ type, modified, person }), [type, modified, person]);
  // Always browse — an empty term lists the whole room, so the default view is all files.
  const { data = [], isLoading, isError, refetch } = useItemSearch(q, SEARCH_LIMIT, true);
  // The endpoint returns a bare array capped at SEARCH_LIMIT with no cursor/total, so a full page is
  // indistinguishable from "there may be more" — surface it instead of silently truncating.
  const isTruncated = data.length >= SEARCH_LIMIT;

  // Files/folders shared *with* the caller are searchable too — matched by name over the shared feed
  // (shallow: the shared root itself, not files nested inside a shared folder), tagged with the owner.
  const { sharedItems, sharedMeta, ownerKeyById, openEntry } = useSharedDrive();

  const items = useMemo(() => {
    const needle = q.toLowerCase();
    const sharedMatches = q === '' ? sharedItems : sharedItems.filter((i) => i.name.toLowerCase().includes(needle));
    const merged = [...data, ...sharedMatches];
    // Timeline buckets by createdAt (newest first), matching the drive's timeline view.
    const field = viewMode === 'timeline' ? 'created' : sortField;
    const dir = viewMode === 'timeline' ? 'desc' : sortDir;
    return sortItems(applyFilters(merged, filters, ownerKeyById), field, dir);
  }, [data, sharedItems, ownerKeyById, q, filters, viewMode, sortField, sortDir]);

  const onFiltersChange = (next: Filters) => {
    router.replace(`/search?${buildSearchQuery(q, next)}`);
  };
  // Reset clears the term AND every filter — back to the default (browse everything).
  const onReset = () => router.replace('/search');

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Centered search hero, mirroring the /personal launcher — a visible heading anchors the page
          so it reads as the search-results screen, not a second launcher. The Тип / Люди / Изменено
          chips sit under the field; the same set also lives inside the dropdown, so they stay usable
          while the panel (which unfolds over this row) is open. */}
      <div className="flex flex-col items-center gap-4 pt-4 text-center">
        <h1 className="font-semibold text-2xl">
          {q ? t('resultsTitleFor', { query: q }) : t('resultsTitle')}
        </h1>
        <ResultsSearch
          query={q}
          filters={filters}
          onFiltersChange={onFiltersChange}
          onReset={onReset}
        />
        <SearchFilters
          value={filters}
          onChange={onFiltersChange}
          onReset={onReset}
          className="justify-center"
        />
      </div>

      {/* Result count + view toggle sit above the list, once there are hits. */}
      {items.length > 0 && (
        <div className="flex items-center justify-end gap-3">
          <span className="shrink-0 text-muted-foreground text-sm">
            {t('foundCount', { count: items.length })}
          </span>
          <ViewToggle />
        </div>
      )}

      {/* Truncation notice — the backend caps hits at SEARCH_LIMIT and returns no total/cursor, so a
          full page may be hiding further matches. Make that explicit rather than silently truncating. */}
      {!isLoading && !isError && isTruncated && (
        <p className="text-muted-foreground text-sm">
          {t('showingFirst', { count: SEARCH_LIMIT })} {t('refineHint')}
        </p>
      )}

      {isLoading ? (
        <ResultsSkeleton />
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-muted-foreground text-sm">{t('searchFailed')}</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            <RefreshCw />
            {t('retry')}
          </Button>
        </div>
      ) : items.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground text-sm">
          {q !== '' ? t('noResultsFor', { query: q }) : t('noResults')}
        </p>
      ) : viewMode === 'grid' ? (
        <DriveGrid
          items={items}
          onAction={onAction}
          hasNextPage={false}
          isFetchingNextPage={false}
          onLoadMore={() => {}}
          sharedMeta={sharedMeta}
          onOpenShared={openEntry}
        />
      ) : viewMode === 'timeline' ? (
        <DriveTimeline
          items={items}
          onAction={onAction}
          sharedMeta={sharedMeta}
          onOpenShared={openEntry}
        />
      ) : (
        <ItemsTable
          items={items}
          onAction={onAction}
          sharedMeta={sharedMeta}
          onOpenShared={openEntry}
        />
      )}

      <DriveDialogs parentId={null} dialog={dialog} onOpenChange={close} />
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="space-y-1 py-1">
      {['a', 'b', 'c', 'd', 'e', 'f'].map((key) => (
        <div key={key} className="flex items-center gap-2.5 px-3 py-2">
          <Skeleton className="size-6 rounded" />
          <Skeleton className="h-4 w-48" />
        </div>
      ))}
    </div>
  );
}
