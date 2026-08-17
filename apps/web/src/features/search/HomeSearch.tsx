'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { InlineSearch } from '@/features/shell/search-dialog';
import { buildSearchQuery, hasActiveFilter, type SearchFilters as Filters } from './filters';
import { SearchFilters } from './SearchFilters';

/**
 * `/personal` launcher search — the expanding Material panel with the Тип / Люди / Изменено chips
 * inside its dropdown. Query and filters are staged locally: picking a filter or typing never leaves
 * the page — only "Все результаты" (or Enter) commits, opening `/search` with the term and the chosen
 * filters applied. `canSubmit` keeps that link available when only a filter is set (no term yet).
 */
export function HomeSearch() {
  const router = useRouter();
  const [filters, setFilters] = useState<Filters>({});
  const [query, setQuery] = useState('');
  const submit = useCallback(
    (q: string) => router.push(`/search?${buildSearchQuery(q, filters)}`),
    [router, filters],
  );
  // A filter chip applies immediately (Drive-style): jump straight to /search with it — even with an
  // empty term — carrying along whatever's been typed so far.
  const changeFilters = useCallback(
    (next: Filters) => {
      setFilters(next);
      router.push(`/search?${buildSearchQuery(query, next)}`);
    },
    [router, query],
  );

  return (
    <InlineSearch
      options={{ submit, onQueryChange: setQuery }}
      filtersSlot={
        <SearchFilters
          value={filters}
          onChange={changeFilters}
          onReset={() => setFilters({})}
        />
      }
      canSubmit={hasActiveFilter(filters)}
    />
  );
}
