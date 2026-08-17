/**
 * Active (selected-page) color for sidebar nav items — Google Drive's blue pill: `#C1E7FF` fill,
 * `#004A77` text + icons. Applied on top of a `SidebarMenuButton`/`SidebarMenuSubButton`; the
 * `data-active:` compound variants keep it stable through hover, and the `[&_svg]` override recolors
 * even icons that force their own color (the folder-tree sub-button does).
 */
export const NAV_ACTIVE =
  'data-active:bg-[#C1E7FF] data-active:text-[#004A77] data-active:[&_svg]:text-[#004A77] data-active:hover:bg-[#C1E7FF] data-active:hover:text-[#004A77]';
