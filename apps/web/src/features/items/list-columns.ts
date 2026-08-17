/**
 * Shared column layout for the drive list — the header row and every item row use these exact
 * classes so cells stay aligned. Columns: Name (fills) · Владелец · Дата создания · Дата изменения ·
 * actions. Secondary columns drop out on narrower viewports (name + modified + actions always show).
 */
export const LIST_ROW_GRID =
  'grid grid-cols-[minmax(0,1fr)_auto_auto_auto_auto] items-center gap-4';

export const COL_NAME = 'min-w-0';
export const COL_OWNER = 'hidden w-40 lg:block';
export const COL_CREATED = 'hidden w-32 xl:block';
export const COL_MODIFIED = 'hidden w-32 md:block';
/**
 * Trailing cell — the header's labelled "Сортировка" control and each row's right-aligned "…" menu
 * share this fixed width so the control and the row menus line up (and the middle columns stay put).
 */
export const COL_ACTIONS = 'flex w-32 justify-end';

/**
 * ARIA roles that expose the shared column grid as a real table to assistive tech, without touching
 * the layout: the list is a CSS grid of divs, and these roles give it table/row/cell semantics so a
 * screen reader can navigate it row-by-row and column-by-column. The header (ItemsTable) and every
 * data row (ItemRow, SharedListRow) apply the same constants so the header cells and body cells line
 * up as one table. `as const` keeps each value a literal `AriaRole`, not a widened `string`.
 */
export const LIST_TABLE_ROLE = 'table' as const;
export const LIST_ROWGROUP_ROLE = 'rowgroup' as const;
export const LIST_ROW_ROLE = 'row' as const;
export const LIST_COLUMNHEADER_ROLE = 'columnheader' as const;
export const LIST_CELL_ROLE = 'cell' as const;
