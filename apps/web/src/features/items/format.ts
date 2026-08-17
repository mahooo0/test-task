/** CLDR unit ids per size step; `Intl.NumberFormat` renders the localized symbol ("kB" / "кБ"). */
const BYTE_UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte'] as const;

/**
 * Human-readable byte size in the active `locale` — the number, decimal separator, and unit label are
 * all localized ("1.5 kB" in en, "1,5 кБ" in ru/uk). Folders (null) render as "—". Pass the active
 * locale (`useLocale()`), same as {@link formatDate}.
 */
export function formatBytes(bytes: number | null, locale: string): string {
  if (bytes === null) return '—';
  if (bytes === 0) return formatUnit(0, 'byte', locale);
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), BYTE_UNITS.length - 1);
  const value = bytes / 1024 ** exponent;
  return formatUnit(value, BYTE_UNITS[exponent], locale, exponent === 0 ? 0 : 1);
}

function formatUnit(value: number, unit: string, locale: string, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit,
    unitDisplay: 'short',
    maximumFractionDigits,
  }).format(value);
}

/** Whole calendar days between two dates (each normalized to local midnight); positive when `to` is later. */
export function daysBetween(from: Date, to: Date): number {
  const atMidnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((atMidnight(to) - atMidnight(from)) / 86_400_000);
}

/**
 * Compact, Google Drive-style date in the active `locale`: relative for the last week ("Today",
 * "Yesterday", "3 days ago" — grammar handled by `Intl.RelativeTimeFormat`), then a short date that
 * drops the year when it's the current one ("14 Aug" vs "18 Oct 2023"). Pass the active locale
 * (`useLocale()`); wrap in `DateHint` so hover shows the precise {@link formatDateExact} value.
 */
export function formatDate(iso: string, locale: string): string {
  const date = new Date(iso);
  const now = new Date();
  const dayDiff = daysBetween(date, now);

  if (dayDiff >= 0 && dayDiff < 7) {
    // `numeric: 'auto'` yields the idiomatic "today"/"yesterday" words, and correct plurals beyond.
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-dayDiff, 'day');
  }

  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** The full date + time in the active `locale` — the `DateHint` tooltip over a relative/short date. */
export function formatDateExact(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
}
