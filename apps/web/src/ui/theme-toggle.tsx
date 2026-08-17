'use client';

import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { type Theme, useTheme } from '@/app/ThemeProvider';
import { cn } from '@/lib/utils';

const OPTIONS: ReadonlyArray<{ value: Theme; icon: typeof Sun; labelKey: string }> = [
  { value: 'light', icon: Sun, labelKey: 'light' },
  { value: 'system', icon: Monitor, labelKey: 'system' },
  { value: 'dark', icon: Moon, labelKey: 'dark' },
];

/**
 * Theme switcher rendered as a single button showing the current theme's icon.
 * Hovering (or clicking / focusing) reveals a small light / system / dark menu
 * that fades and slides in; the trigger icon animates whenever the theme changes.
 * Opens on hover but is fully operable by click, keyboard, and touch.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations('customize');
  const tc = useTranslations('common');
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  const current = OPTIONS.find((o) => o.value === theme) ?? OPTIONS[1];
  const CurrentIcon = current.icon;
  const currentLabel = t(current.labelKey);

  return (
    <div className={className}>
      <div
        ref={rootRef}
        className="relative"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
        }}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={tc('themeCurrent', { label: currentLabel })}
          className={cn(
            'flex size-9 items-center justify-center rounded-full border border-border bg-background/60 text-foreground outline-none backdrop-blur transition-colors',
            'hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/60',
          )}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={theme}
              initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="inline-flex"
            >
              <CurrentIcon className="size-[18px]" aria-hidden />
            </motion.span>
          </AnimatePresence>
        </button>

        <AnimatePresence>
          {open ? (
            <motion.div
              role="menu"
              aria-label={tc('selectTheme')}
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              // top-full + pt-2 keeps the gap inside the element so moving the
              // cursor from the trigger into the menu never triggers mouseleave.
              className="absolute top-full left-0 z-20 origin-top-left pt-2"
            >
              <div className="min-w-[9.5rem] rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg">
                {OPTIONS.map(({ value, icon: Icon, labelKey }) => {
                  const active = theme === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="menuitemradio"
                      aria-checked={active}
                      onClick={() => {
                        setTheme(value);
                        setOpen(false);
                      }}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm outline-none transition-colors',
                        'hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent',
                        active ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      <Icon className="size-4" aria-hidden />
                      <span className="flex-1 text-left font-medium">{t(labelKey)}</span>
                      {active ? <Check className="size-4" aria-hidden /> : null}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
