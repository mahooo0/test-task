import type { ItemDto, SharedResourceView } from '@dataroom/types';
import { displayPersonName } from '@/lib/utils';

/** Filter dimensions for search, mirroring Google Drive's "Тип / Люди / Изменено" chips. */
export type TypeFilter = 'FOLDER' | 'FILE';
export type ModifiedFilter = 'today' | '7d' | '30d' | 'year';
/**
 * A person to filter by: `'me'` (your own items) or an owner key identifying someone who shared with
 * you. Owner keys come from {@link ownerKeyFromShare}, so they stay stable across renders.
 */
export type PersonFilter = string;

export interface SearchFilters {
  type?: TypeFilter;
  modified?: ModifiedFilter;
  person?: PersonFilter;
}

/**
 * Stable filter option keys (option order = display order). Labels are not stored here — this is a
 * pure module — they're looked up per-locale at the React call site via next-intl.
 */
export const TYPE_KEYS: readonly TypeFilter[] = ['FOLDER', 'FILE'];
export const MODIFIED_KEYS: readonly ModifiedFilter[] = ['today', '7d', '30d', 'year'];
/** The always-present "You" person option; sharers are appended dynamically per {@link sharedPersonOptions}. */
export const ME_PERSON = 'me';

/** A stable key for a sharer — their email if known (case-folded), else a name-derived fallback. */
export function ownerKeyFromShare(owner: { email: string | null; name: string }): string {
  const email = owner.email?.trim().toLowerCase();
  return email || `name:${owner.name.trim().toLowerCase()}`;
}

export interface PersonOption {
  key: string;
  label: string;
  avatarUrl: string | null;
}

/**
 * The People-filter options: "You" first, then one per distinct person who shared a file/folder with
 * you (whole-room shares are excluded — they have no drive row). Keys match {@link ownerKeyFromShare}
 * so the selected option lines up with a merged item's owner.
 */
export function sharedPersonOptions(
  shares: SharedResourceView[],
  meLabel: string,
): PersonOption[] {
  const byKey = new Map<string, PersonOption>([[ME_PERSON, { key: ME_PERSON, label: meLabel, avatarUrl: null }]]);
  for (const share of shares) {
    if (!share.root) continue; // whole-room shares don't appear as a drive row
    const key = ownerKeyFromShare(share.owner);
    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        label: displayPersonName(share.owner.name, share.owner.email),
        avatarUrl: share.owner.avatarUrl,
      });
    }
  }
  return [...byKey.values()];
}

/** Reads (and validates) the filter values out of the page's search params. */
export function parseFilters(params: {
  type?: string;
  modified?: string;
  person?: string;
}): SearchFilters {
  return {
    type: params.type === 'FOLDER' || params.type === 'FILE' ? params.type : undefined,
    modified:
      params.modified && (MODIFIED_KEYS as readonly string[]).includes(params.modified)
        ? (params.modified as ModifiedFilter)
        : undefined,
    person: params.person ? params.person : undefined,
  };
}

/** Builds the `/search` query string from a term + filters, omitting empty values. */
export function buildSearchQuery(query: string, filters: SearchFilters): string {
  const params = new URLSearchParams();
  const q = query.trim();
  if (q) params.set('q', q);
  if (filters.type) params.set('type', filters.type);
  if (filters.modified) params.set('modified', filters.modified);
  if (filters.person) params.set('person', filters.person);
  return params.toString();
}

export function hasActiveFilter(filters: SearchFilters): boolean {
  return Boolean(filters.type || filters.modified || filters.person);
}

/**
 * Narrows a result set by the active filters (client-side). The person filter is resolved via
 * `ownerKeyById` (shared item id → owner key); items absent from that map are the caller's own, so
 * they match `'me'`.
 */
export function applyFilters(
  items: ItemDto[],
  filters: SearchFilters,
  ownerKeyById?: ReadonlyMap<string, string>,
): ItemDto[] {
  return items.filter((item) => {
    if (filters.type && item.type !== filters.type) return false;
    if (filters.modified && !withinModified(item.updatedAt, filters.modified)) return false;
    if (filters.person) {
      const key = ownerKeyById?.get(item.id) ?? ME_PERSON;
      if (key !== filters.person) return false;
    }
    return true;
  });
}

function withinModified(iso: string, range: ModifiedFilter): boolean {
  const at = new Date(iso).getTime();
  const now = Date.now();
  const day = 86_400_000;
  switch (range) {
    case 'today': {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      return at >= start.getTime();
    }
    case '7d':
      return at >= now - 7 * day;
    case '30d':
      return at >= now - 30 * day;
    case 'year':
      return at >= new Date(new Date().getFullYear(), 0, 1).getTime();
  }
}
