/**
 * Shared style tokens & class-name helpers.
 *
 * `GRADIENT_BTN` — signature blue gradient CTA. Locked to the light
 * treatment even in dark mode (project convention). Slap on any button
 * that should feel like the primary action.
 */
export const GRADIENT_BTN = [
  'relative overflow-hidden',
  'bg-white text-neutral-900 border border-[#EAEAEA] shadow-sm',
  'dark:bg-white dark:text-neutral-900 dark:border-[#EAEAEA]',
  'transition-[filter,box-shadow] duration-200',
  'before:absolute before:inset-0 before:z-0 before:content-[""]',
  'before:bg-[linear-gradient(to_bottom_right,rgba(137,190,255,0.10),rgba(137,190,255,0.70))]',
  'before:opacity-100 before:transition-opacity before:duration-200',
  'hover:before:bg-[linear-gradient(to_bottom_right,rgba(137,190,255,0.18),rgba(137,190,255,0.85))]',
  'focus-visible:ring-2 focus-visible:ring-[#89BEFF]/60',
].join(' ');
