'use client';

import type { ItemDto, SharedResourceView } from '@dataroom/types';
import { Command as CommandPrimitive } from 'cmdk';
import { Search, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { type ReactNode, type Ref, useEffect, useMemo, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDate } from '@/features/items/format';
import { useItemSearch } from '@/features/items/hooks';
import { usePdfPreview } from '@/features/items/preview/pdf-preview';
import { DateHint, ItemIcon, useCurrentOwner } from '@/features/items/presentation';
import {
  applyFilters,
  buildSearchQuery,
  hasActiveFilter,
  ME_PERSON,
  ownerKeyFromShare,
  type SearchFilters as Filters,
} from '@/features/search/filters';
import { SearchFilters } from '@/features/search/SearchFilters';
import { useSharedWithMe } from '@/features/shares/hooks';
import { useSharedDrive } from '@/features/shares/use-shared-drive';
import { cn, displayPersonName, getInitials } from '@/lib/utils';

/** Pause after the last keystroke before hitting the search endpoint. */
const SEARCH_DEBOUNCE_MS = 180;
/** Google-blue accent for the footer links (lighter in dark mode, like Drive). */
const LINK =
  'font-medium text-[#1a73e8] transition-colors hover:text-[#1558b0] dark:text-[#8ab4f8] dark:hover:text-[#aecbfa]';

/**
 * Shared search state + navigation for the header modal ({@link SearchDialog}) and the inline
 * {@link InlineSearch} overlay. Searches item names across the whole room (see {@link useItemSearch});
 * `onNavigate` fires right before a route change / file open so the surrounding container can close
 * itself first.
 */
function useDriveSearch(
  onNavigate: () => void,
  options?: {
    initialQuery?: string;
    submit?: (query: string) => void;
    /** Mirrors the live term out to the caller, so a launcher can commit a filter with it. */
    onQueryChange?: (query: string) => void;
    /** Active Тип/Люди/Изменено filters — applied to the live list, like the results page. */
    filters?: Filters;
    /** Browse the whole room on an empty term (the palette shows all files by default). */
    browseAll?: boolean;
  },
) {
  const [query, setQuery] = useState(options?.initialQuery ?? '');
  const router = useRouter();
  const { open: openPreview } = usePdfPreview();
  const owner = useCurrentOwner();

  const onQueryChange = options?.onQueryChange;
  useEffect(() => {
    onQueryChange?.(query);
  }, [query, onQueryChange]);

  // Search on a pause, not on every keystroke; the highlight uses the same debounced term the
  // results were fetched with, so bold spans always line up with what's on screen.
  const debounced = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const term = debounced.trim();
  const needle = term.toLowerCase();
  const { data: ownResults = [], isLoading } = useItemSearch(
    debounced,
    20,
    options?.browseAll || undefined,
  );

  // Resources shared with the caller are searchable + filterable here too — merged and filtered the
  // same way as the results page so the palette lists the identical set.
  const drive = useSharedDrive();
  const filterType = options?.filters?.type;
  const filterPerson = options?.filters?.person;
  const filterModified = options?.filters?.modified;
  const results = useMemo(() => {
    const sharedMatches =
      term === '' ? drive.sharedItems : drive.sharedItems.filter((i) => i.name.toLowerCase().includes(needle));
    const merged = [...ownResults, ...sharedMatches];
    return applyFilters(
      merged,
      { type: filterType, person: filterPerson, modified: filterModified },
      drive.ownerKeyById,
    );
    // drive.* accessors are memoized by the shared feed, so they are safe to omit from deps
  }, [ownResults, drive.sharedItems, drive.ownerKeyById, term, needle, filterType, filterPerson, filterModified]);

  // People the term can match: you + everyone who shared a file/folder with you. Each is a suggestion
  // chip that, when clicked, applies as the "People" filter on the results page.
  const { data: shares } = useSharedWithMe();
  const people = [
    { key: ME_PERSON, name: owner.name, email: owner.email, avatarUrl: owner.avatarUrl },
    ...dedupeSharers(shares),
  ];
  const personMatches =
    term === ''
      ? []
      : people.filter(
          (p) => p.name.toLowerCase().includes(needle) || p.email.toLowerCase().includes(needle),
        );

  const go = (url: string) => {
    onNavigate();
    router.push(url);
  };

  // Clicking a person suggestion filters the results page by that owner.
  const goToPerson = (key: string) => go(`/search?person=${encodeURIComponent(key)}`);

  const openResult = (item: ItemDto) => {
    onNavigate();
    // A shared row opens through the grantee endpoints (folder → inline browse, file → viewer).
    const meta = drive.sharedMeta.get(item.id);
    if (meta) {
      drive.openEntry(item, meta);
    } else if (item.type === 'FOLDER') {
      router.push(`/folders/${item.id}`);
    } else {
      openPreview(item);
    }
  };

  // Submit the search (Enter, or the "Все результаты" link). By default → the full results page for
  // the term + any active filters; the results page passes its own `submit` to refine in place.
  const goToResults = () => {
    const trimmed = query.trim();
    if (options?.submit) {
      onNavigate();
      options.submit(trimmed);
      return;
    }
    go(`/search?${buildSearchQuery(trimmed, options?.filters ?? {})}`);
  };

  return {
    query,
    setQuery,
    term,
    results,
    isLoading,
    owner,
    sharedMeta: drive.sharedMeta,
    browseAll: !!options?.browseAll,
    personMatches,
    goToPerson,
    openResult,
    goToResults,
  };
}

/** Distinct sharers (by owner key) shaped for the person-suggestion chips; whole-room shares excluded. */
function dedupeSharers(shares: SharedResourceView[] | undefined) {
  const byKey = new Map<
    string,
    { key: string; name: string; email: string; avatarUrl: string | null }
  >();
  for (const share of shares ?? []) {
    if (!share.root) continue;
    const key = ownerKeyFromShare(share.owner);
    if (byKey.has(key)) continue;
    byKey.set(key, {
      key,
      name: displayPersonName(share.owner.name, share.owner.email),
      email: share.owner.email ?? '',
      avatarUrl: share.owner.avatarUrl,
    });
  }
  return [...byKey.values()];
}

type DriveSearch = ReturnType<typeof useDriveSearch>;

/** Search field row — magnifier · input · trailing (clear/close button or shortcut hint). */
function SearchInputRow({
  inputRef,
  value,
  onValueChange,
  onFocus,
  onSubmit,
  autoFocus,
  trailing,
}: {
  inputRef: Ref<HTMLInputElement>;
  value: string;
  onValueChange: (value: string) => void;
  onFocus?: () => void;
  onSubmit?: () => void;
  autoFocus?: boolean;
  trailing: ReactNode;
}) {
  const t = useTranslations('search');
  return (
    <div className="flex h-16 items-center gap-4 px-6">
      <Search className="size-6 shrink-0 text-muted-foreground" />
      <CommandPrimitive.Input
        ref={inputRef}
        autoFocus={autoFocus}
        value={value}
        onValueChange={onValueChange}
        onFocus={onFocus}
        // Enter submits the search. Stop propagation so cmdk doesn't also try to act on the keystroke.
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.stopPropagation();
            onSubmit?.();
          }
        }}
        placeholder={t('searchPlaceholder')}
        aria-label={t('searchPlaceholder')}
        className="flex-1 bg-transparent text-lg outline-none placeholder:text-muted-foreground"
      />
      {trailing}
    </div>
  );
}

/** Round icon button: clears the term when there's text, otherwise closes/collapses the search. */
function ClearButton({
  query,
  onClear,
  onEmpty,
}: {
  query: string;
  onClear: () => void;
  onEmpty: () => void;
}) {
  const t = useTranslations('search');
  return (
    <button
      type="button"
      aria-label={query ? t('clear') : t('close')}
      onClick={() => (query ? onClear() : onEmpty())}
      className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <X className="size-6" />
    </button>
  );
}

/** The panel below the input — shared by the modal and the inline overlay: person chip, results, footer. */
function SearchBody({
  search,
  filtersSlot,
  canSubmit = false,
}: {
  search: DriveSearch;
  filtersSlot?: ReactNode;
  // Force the "Все результаты" footer on even with an empty term — e.g. the /personal launcher, where
  // an active filter alone is enough to submit (there's no live list on that page).
  canSubmit?: boolean;
}) {
  const t = useTranslations('search');
  const locale = useLocale();
  const {
    term,
    results,
    isLoading,
    owner,
    sharedMeta,
    browseAll,
    personMatches,
    goToPerson,
    openResult,
    goToResults,
  } = search;
  return (
    <>
      {/* Filter chips (results page) — kept reachable inside the open panel, above the results. */}
      {filtersSlot && <div className="px-6 pb-3">{filtersSlot}</div>}

      {/* Person suggestions — you + any sharer whose name/email matches the term. Click one to filter
          the results page by that person (Material chip: avatar + name, hairline border). */}
      {personMatches.length > 0 && (
        <div className="flex flex-wrap gap-2 px-6 pb-3">
          {personMatches.map((person) => (
            <button
              key={person.key}
              type="button"
              onClick={() => goToPerson(person.key)}
              className="inline-flex max-w-full items-center gap-2.5 rounded-full border py-1.5 pr-4 pl-1.5 text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <Avatar className="size-7 shrink-0">
                {person.avatarUrl && <AvatarImage src={person.avatarUrl} alt="" />}
                <AvatarFallback className="text-[10px]">{getInitials(person.name)}</AvatarFallback>
              </Avatar>
              <span className="truncate">{person.name}</span>
            </button>
          ))}
        </div>
      )}

      <CommandSeparator className="mx-0" />

      <CommandList className="max-h-[min(60vh,26rem)] py-2">
        {isLoading ? (
          <p className="px-6 py-10 text-center text-muted-foreground text-sm">{t('searching')}</p>
        ) : results.length > 0 ? (
          <CommandGroup className="p-0">
            {results.map((item) => {
              // Shared rows show the sharer as owner; your own rows show you.
              const ownerName = sharedMeta.get(item.id)?.owner.name ?? owner.name;
              return (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  onSelect={() => openResult(item)}
                  className="gap-4 rounded-none px-6 py-3.5"
                >
                  <ItemIcon item={item} className="size-6" />
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate text-[15px]">
                      <Highlight text={item.name} query={term} />
                    </span>
                    <span className="truncate text-[13px] text-muted-foreground">
                      <Highlight text={ownerName} query={term} />
                    </span>
                  </span>
                  <DateHint
                    iso={item.updatedAt}
                    className="ms-auto shrink-0 pl-3 text-[13px] text-muted-foreground"
                  >
                    {formatDate(item.updatedAt, locale)}
                  </DateHint>
                </CommandItem>
              );
            })}
          </CommandGroup>
        ) : term !== '' ? (
          <p className="px-6 py-10 text-center text-muted-foreground text-sm">
            {t('noResultsFor', { query: term })}
          </p>
        ) : browseAll ? (
          <p className="px-6 py-10 text-center text-muted-foreground text-sm">{t('noResults')}</p>
        ) : (
          <p className="px-6 py-10 text-center text-muted-foreground text-sm">{t('startTyping')}</p>
        )}
      </CommandList>

      {/* Footer: jump to the full results page for the current query (and any staged filters). */}
      {(term !== '' || canSubmit) && (
        <div className="flex items-center justify-end px-6 py-3 text-[15px]">
          <button type="button" onClick={goToResults} className={LINK}>
            {t('allResults')}
          </button>
        </div>
      )}
    </>
  );
}

/**
 * Header search: a "Search ⌘K" trigger that opens the Material search panel as a centered modal.
 */
export function SearchDialog() {
  const t = useTranslations('search');
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>({});
  const inputRef = useRef<HTMLInputElement>(null);
  // The palette mirrors the results page: filter chips + browse-all (all files on an empty term).
  const search = useDriveSearch(() => setOpen(false), { filters, browseAll: true });

  // ⌘K / Ctrl-K toggles the palette.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (!next) {
      // Reset so the palette reopens clean.
      search.setQuery('');
      setFilters({});
    }
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant="link"
        className="gap-2 px-0! font-normal text-muted-foreground hover:no-underline"
      >
        <Search data-icon="inline-start" />
        {t('search')}
        <kbd className="inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-medium text-[10px]">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <Dialog open={open} onOpenChange={changeOpen}>
        {/* Material-3 surface: big radius, soft shadow, no ring, roomy. */}
        <DialogContent
          showCloseButton={false}
          className="gap-0 overflow-hidden rounded-[28px] p-0 shadow-2xl ring-0 sm:max-w-2xl"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{t('search')}</DialogTitle>
            <DialogDescription>{t('dialogDescription')}</DialogDescription>
          </DialogHeader>

          <Command shouldFilter={false} className="rounded-[28px] bg-transparent">
            <SearchInputRow
              inputRef={inputRef}
              value={search.query}
              onValueChange={search.setQuery}
              onSubmit={search.goToResults}
              autoFocus
              trailing={
                <ClearButton
                  query={search.query}
                  onClear={() => {
                    search.setQuery('');
                    inputRef.current?.focus();
                  }}
                  onEmpty={() => changeOpen(false)}
                />
              }
            />
            <SearchBody
              search={search}
              filtersSlot={
                <SearchFilters
                  value={filters}
                  onChange={setFilters}
                  onReset={() => setFilters({})}
                />
              }
              canSubmit={hasActiveFilter(filters)}
            />
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * A big rounded search field that expands **in place** on focus into the Material panel, floating
 * over the page content — no modal. The field is the panel's top row, so its position never jumps:
 * filters, chip, results, and footer just unfold beneath it. Click-outside or Escape collapses it.
 *
 * `options` seed/redirect the underlying {@link useDriveSearch} (the results page seeds the URL term
 * and submits back to `/search`); `filtersSlot`, when given, renders the filter chips inside the open
 * panel so they stay reachable while searching; `canSubmit` forces the "Все результаты" footer on for
 * an active filter alone. Used by the `/personal` launcher and the results-page search. (⌘K stays
 * owned by the header {@link SearchDialog}.)
 */
export function InlineSearch({
  options,
  filtersSlot,
  canSubmit,
}: {
  options?: {
    initialQuery?: string;
    submit?: (query: string) => void;
    onQueryChange?: (query: string) => void;
  };
  filtersSlot?: ReactNode;
  canSubmit?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const collapse = () => {
    setOpen(false);
    inputRef.current?.blur();
  };
  const search = useDriveSearch(collapse, options);

  // Collapse when the pointer goes down anywhere outside the search. The filter chips inside the
  // panel open Radix menus that portal their content to <body> (outside this subtree) — treat clicks
  // there as "inside" so opening a filter, or picking one of its options, never collapses the panel.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (target instanceof Element && target.closest('[data-radix-popper-content-wrapper]'))
        return;
      if (rootRef.current && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  return (
    // Fixed-height slot reserves the field's space so the page never shifts; the card is absolutely
    // positioned on top of it and grows downward over the content when open. `text-left` resets the
    // centered alignment of the `/personal` hero so results/inputs read left-aligned.
    <div ref={rootRef} className="relative h-16 w-full max-w-2xl text-left">
      <Command
        shouldFilter={false}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            collapse();
          }
        }}
        className={cn(
          // h-auto overrides cmdk's `size-full`, so the card grows with its content instead of being
          // pinned to the slot's collapsed height (which would clip the panel).
          'absolute inset-x-0 top-0 h-auto overflow-hidden text-popover-foreground transition-shadow',
          open
            ? 'z-40 rounded-[28px] bg-popover shadow-2xl ring-1 ring-border'
            : 'rounded-full bg-muted/40 ring-1 ring-border hover:bg-muted/60',
        )}
      >
        <SearchInputRow
          inputRef={inputRef}
          value={search.query}
          onValueChange={search.setQuery}
          onFocus={() => setOpen(true)}
          onSubmit={search.goToResults}
          trailing={
            open ? (
              <ClearButton
                query={search.query}
                onClear={() => {
                  search.setQuery('');
                  inputRef.current?.focus();
                }}
                onEmpty={collapse}
              />
            ) : null
          }
        />
        {open && <SearchBody search={search} filtersSlot={filtersSlot} canSubmit={canSubmit} />}
      </Command>
    </div>
  );
}

/** Bolds every case-insensitive occurrence of `query` inside `text` — the "с совпадениями" highlight. */
function Highlight({ text, query }: { text: string; query: string }) {
  const needle = query.trim().toLowerCase();
  if (needle === '') return <>{text}</>;

  const lower = text.toLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (let idx = lower.indexOf(needle); idx !== -1; idx = lower.indexOf(needle, cursor)) {
    if (idx > cursor) parts.push(text.slice(cursor, idx));
    parts.push(
      <strong key={idx} className="font-semibold text-foreground">
        {text.slice(idx, idx + needle.length)}
      </strong>,
    );
    cursor = idx + needle.length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

/** `value` delayed by `delay` ms since its last change — a plain debounce. */
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
