'use client';

import type { ItemSortField, SortDirection } from '@dataroom/types';
import { ArrowDown, ArrowDownUp, ArrowUp, ArrowUpDown, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/app/ThemeProvider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { LIST_COLUMNHEADER_ROLE } from './list-columns';

/** Fields offered in the sort menu, in display order (folders always group first regardless). */
const SORT_FIELDS: ItemSortField[] = ['name', 'modified', 'created'];

/** Which set of contextual order labels a field uses ("Newest first" for dates, "A→Z" for names). */
const DIR_GROUP: Record<ItemSortField, 'name' | 'date' | 'size'> = {
  name: 'name',
  modified: 'date',
  created: 'date',
  size: 'size',
};

/** The natural first direction when switching TO a field: А→Я by name, newest / largest first otherwise. */
const DEFAULT_DIR: Record<ItemSortField, SortDirection> = {
  name: 'asc',
  modified: 'desc',
  created: 'desc',
  size: 'desc',
};

/**
 * Shared re-sort intent, backed by the persisted `sortField`/`sortDir` preferences.
 * - `sortBy` (column headers): clicking the active field flips direction; another field switches to
 *   it in its natural default.
 * - `setField` / `setDirection` (the sort menu): field and order are chosen independently.
 */
export function useSortControls() {
  const { sortField, sortDir, setSort } = useTheme();
  return {
    sortField,
    sortDir,
    sortBy: (field: ItemSortField) =>
      field === sortField
        ? setSort(field, sortDir === 'asc' ? 'desc' : 'asc')
        : setSort(field, DEFAULT_DIR[field]),
    setField: (field: ItemSortField) => setSort(field, sortDir),
    setDirection: (dir: SortDirection) => setSort(sortField, dir),
  };
}

/** Up/down arrow marking the active sort field's direction. */
function DirArrow({ dir, className }: { dir: SortDirection; className?: string }) {
  const Icon = dir === 'asc' ? ArrowUp : ArrowDown;
  return <Icon aria-hidden className={cn('size-3.5 shrink-0', className)} />;
}

/**
 * The sort menu: pick a field and an order independently. `compact` renders a labelled gradient pill
 * (the drive table's last "action" column header, mirroring Google Drive's rounded "Сортировка"
 * control); otherwise a labelled outline button (used in grid view).
 *
 * Behaves like a popover, not a menu: selecting a field or order re-sorts in place and keeps the
 * panel open (via `preventDefault`), so field + order can be tuned in one pass. It dismisses only
 * on an outside click or Escape.
 */
export function SortMenu({ compact = false }: { compact?: boolean }) {
  const t = useTranslations('sort');
  const { sortField, sortDir, setField, setDirection } = useSortControls();

  const fieldLabel = (field: ItemSortField) => t(`field.${field}`);
  const dirWord = (dir: SortDirection) => t(dir === 'asc' ? 'ascending' : 'descending');
  const orderLabel = (field: ItemSortField, dir: SortDirection) =>
    t(`dir.${DIR_GROUP[field]}.${dir}`);
  const ariaLabel = t('ariaCurrent', { field: fieldLabel(sortField), dir: dirWord(sortDir) });

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            {compact ? (
              <Button variant="default" size="sm" className="rounded-full" aria-label={ariaLabel}>
                <ArrowDownUp />
                <span>{t('button')}</span>
              </Button>
            ) : (
              <Button variant="outline" size="sm" aria-label={ariaLabel}>
                <ArrowUpDown />
                <span className="hidden sm:inline">{fieldLabel(sortField)}</span>
                <DirArrow dir={sortDir} className="text-muted-foreground" />
              </Button>
            )}
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{ariaLabel}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>{t('sortBy')}</DropdownMenuLabel>
        {SORT_FIELDS.map((field) => (
          <DropdownMenuItem
            key={field}
            onSelect={(e) => {
              e.preventDefault();
              setField(field);
            }}
            className="justify-between"
            aria-label={
              field === sortField
                ? t('fieldSelected', { field: fieldLabel(field) })
                : t('sortByField', { field: fieldLabel(field) })
            }
          >
            <span>{fieldLabel(field)}</span>
            {field === sortField && <Check className="size-4 shrink-0 text-muted-foreground" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t('order')}</DropdownMenuLabel>
        {(['asc', 'desc'] as const).map((dir) => (
          <DropdownMenuItem
            key={dir}
            onSelect={(e) => {
              e.preventDefault();
              setDirection(dir);
            }}
            className="justify-between"
            aria-label={
              dir === sortDir
                ? `${orderLabel(sortField, dir)}, ${t('selected')}`
                : orderLabel(sortField, dir)
            }
          >
            <span className="flex items-center gap-2">
              <DirArrow dir={dir} className="text-muted-foreground" />
              {orderLabel(sortField, dir)}
            </span>
            {dir === sortDir && <Check className="size-4 shrink-0 text-muted-foreground" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** List-view clickable column header; pass width/justify via `className` for aligned columns. */
export function SortableHeader({ field, className }: { field: ItemSortField; className?: string }) {
  const t = useTranslations('sort');
  const { sortField, sortDir, sortBy } = useSortControls();
  const active = field === sortField;
  const label = t(`field.${field}`);
  // Doubles as the hover hint: current state for the active field, the click affordance otherwise.
  const hint = active
    ? t('headerActive', {
        field: label,
        dir: t(sortDir === 'asc' ? 'ascending' : 'descending'),
      })
    : t('sortByField', { field: label });
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          // This button is also this column's header cell: `columnheader` + `aria-sort` let a screen
          // reader announce the sort state ("Name, sorted ascending") in table-navigation mode. The
          // native <button> still fires on Enter/Space — an ARIA role overrides only the exposed
          // role, not the element's built-in activation — so click-to-sort keeps working.
          role={LIST_COLUMNHEADER_ROLE}
          aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
          // Radix closes the tooltip on the trigger's pointerdown/click; preventDefault makes its
          // composed handlers skip that, so the hint survives the click and re-renders with the
          // new sort state (a button has no native default to lose).
          onPointerDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.preventDefault();
            sortBy(field);
          }}
          aria-label={hint}
          className={cn(
            // The -m/p pairs cancel out so the label stays aligned with row cells while the hover tab
            // bleeds over the full column (100% + both -mx) and the header row's py-2, sitting flush on
            // the header's bottom border (hence top-only rounding).
            'group -mx-2 -my-2 flex w-[calc(100%+1rem)] items-center gap-1 rounded-t-md px-2 py-2 outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50',
            active && 'text-foreground',
            className,
          )}
        >
          <span className="truncate">{label}</span>
          {active ? (
            <DirArrow dir={sortDir} />
          ) : (
            // Faint affordance that the header is sortable — always visible, stronger on hover.
            <ArrowUpDown
              aria-hidden
              className="size-3.5 shrink-0 opacity-40 transition-opacity group-hover:opacity-70"
            />
          )}
        </button>
      </TooltipTrigger>
      {/* The trigger counts as "outside" the content, so a click would also dismiss via the
          DismissableLayer; preventing it keeps hover-out as the only close path. */}
      <TooltipContent onPointerDownOutside={(e) => e.preventDefault()}>{hint}</TooltipContent>
    </Tooltip>
  );
}
