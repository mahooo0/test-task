'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { InlineSearch } from '@/features/shell/search-dialog';
import { buildSearchQuery, type SearchFilters as Filters } from './filters';
import { SearchFilters } from './SearchFilters';

/**
 * The results page's search field — the same expanding Material panel as the `/personal`
 * {@link HomeSearch}, but seeded from the URL term and submitting back to `/search` (via history
 * replace, preserving the active filters, and allowing an empty term to browse by filter alone). The
 * Тип / Люди / Изменено chips also live inside the dropdown, so they stay reachable while the panel is
 * open — the panel unfolds over the row shown beneath the field, so this mirrors that same set.
 */
export function ResultsSearch({
  query,
  filters,
  onFiltersChange,
  onReset,
}: {
  query: string;
  filters: Filters;
  onFiltersChange: (next: Filters) => void;
  onReset?: () => void;
}) {
  const router = useRouter();
  const submit = useCallback(
    (next: string) => router.replace(`/search?${buildSearchQuery(next, filters)}`),
    [router, filters],
  );

  return (
    <InlineSearch
      options={{ initialQuery: query, submit }}
      filtersSlot={<SearchFilters value={filters} onChange={onFiltersChange} onReset={onReset} />}
    />
  );
}
