import { daysBetween } from './format';

/**
 * Coarse "when" buckets for the date-grouped (timeline) drive view, newest first. Values are stable
 * keys (not display text) — the timeline view resolves each to a localized label via `t('bucket.*')`.
 */
export const DATE_BUCKETS = [
  'today',
  'yesterday',
  'thisWeek',
  'thisMonth',
  'lastMonth',
  'earlier',
] as const;

export type DateBucket = (typeof DATE_BUCKETS)[number];

/** The bucket an ISO date falls into, relative to `now`. First match wins (buckets are ordered). */
export function dateBucket(iso: string, now: Date): DateBucket {
  const d = new Date(iso);
  const dayDiff = daysBetween(d, now);
  if (dayDiff <= 0) return 'today';
  if (dayDiff === 1) return 'yesterday';
  if (dayDiff < 7) return 'thisWeek';
  if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) return 'thisMonth';
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  if (d.getFullYear() === lastMonth.getFullYear() && d.getMonth() === lastMonth.getMonth())
    return 'lastMonth';
  return 'earlier';
}

/** Group items into DATE_BUCKETS order by a chosen date field, dropping empty buckets. */
export function groupByDate<T>(
  items: T[],
  dateOf: (item: T) => string,
  now: Date,
): Array<{ key: DateBucket; items: T[] }> {
  return DATE_BUCKETS.map((key) => ({
    key,
    items: items.filter((item) => dateBucket(dateOf(item), now) === key),
  })).filter((group) => group.items.length > 0);
}
