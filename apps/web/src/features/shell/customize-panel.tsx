'use client';

import {
  AlignJustify,
  CalendarDays,
  LayoutGrid,
  List,
  Monitor,
  Moon,
  Rows3,
  Rows4,
  Settings,
  Square,
  SquareStack,
  Sun,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import {
  type Density,
  type SidebarCollapsible,
  type SidebarVariant,
  type Theme,
  type ViewMode,
  useTheme,
} from '@/app/ThemeProvider';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/features/shell/language-switcher';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

// `labelKey` indexes the `customize` message namespace; the visible label is resolved via `t()` at
// render so every option follows the active locale.
const THEME_OPTIONS: { value: Theme; labelKey: string; Icon: typeof Sun }[] = [
  { value: 'light', labelKey: 'light', Icon: Sun },
  { value: 'dark', labelKey: 'dark', Icon: Moon },
  { value: 'system', labelKey: 'system', Icon: Monitor },
];

const DENSITY_OPTIONS: { value: Density; labelKey: string; Icon: typeof Rows4 }[] = [
  { value: 'compact', labelKey: 'compact', Icon: Rows4 },
  { value: 'comfortable', labelKey: 'comfortable', Icon: Rows3 },
  { value: 'spacious', labelKey: 'spacious', Icon: AlignJustify },
];

const VIEW_OPTIONS: { value: ViewMode; labelKey: string; Icon: typeof List }[] = [
  { value: 'list', labelKey: 'list', Icon: List },
  { value: 'grid', labelKey: 'grid', Icon: LayoutGrid },
  { value: 'timeline', labelKey: 'timeline', Icon: CalendarDays },
];

function SectionLabel({ children }: { children: ReactNode }) {
  return <Label className="font-medium text-foreground text-sm">{children}</Label>;
}

function IconTile({
  active,
  ariaLabel,
  onClick,
  children,
}: {
  active: boolean;
  ariaLabel: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center gap-1.5 rounded-md border bg-background px-3 py-3 text-xs transition-colors hover:bg-accent hover:text-accent-foreground',
        active ? 'border-foreground text-foreground ring-1 ring-foreground/20' : 'border-border text-muted-foreground',
      )}
    >
      {children}
    </button>
  );
}

/** Full-width toggle-group section (Sidebar Style / Collapse Mode). */
const toggleGroupClass =
  'w-full **:data-[slot=toggle-group]:w-full **:data-[slot=toggle-group-item]:flex-1 **:data-[slot=toggle-group-item]:text-xs';

export function CustomizePanel() {
  const t = useTranslations('customize');
  const {
    theme,
    setTheme,
    density,
    setDensity,
    sidebarVariant,
    setSidebarVariant,
    sidebarCollapsible,
    setSidebarCollapsible,
    viewMode,
    setViewMode,
    reset,
  } = useTheme();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t('open')}>
          <Settings />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
        <SheetHeader className="px-6 py-4">
          <SheetTitle className="text-xl">{t('title')}</SheetTitle>
          <SheetDescription>{t('description')}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <section className="space-y-2.5">
            <SectionLabel>{t('theme')}</SectionLabel>
            <div className="grid grid-cols-3 gap-2">
              {THEME_OPTIONS.map(({ value, labelKey, Icon }) => (
                <IconTile key={value} active={theme === value} ariaLabel={t(labelKey)} onClick={() => setTheme(value)}>
                  <Icon className="size-4" />
                  <span className="text-foreground">{t(labelKey)}</span>
                </IconTile>
              ))}
            </div>
          </section>

          <section className="space-y-2.5">
            <SectionLabel>{t('view')}</SectionLabel>
            <div className="grid grid-cols-3 gap-2">
              {VIEW_OPTIONS.map(({ value, labelKey, Icon }) => (
                <IconTile
                  key={value}
                  active={viewMode === value}
                  ariaLabel={t(labelKey)}
                  onClick={() => setViewMode(value)}
                >
                  <Icon className="size-4" />
                  <span className="text-foreground">{t(labelKey)}</span>
                </IconTile>
              ))}
            </div>
          </section>

          <section className="space-y-2.5">
            <SectionLabel>{t('density')}</SectionLabel>
            <div className="grid grid-cols-3 gap-2">
              {DENSITY_OPTIONS.map(({ value, labelKey, Icon }) => (
                <IconTile key={value} active={density === value} ariaLabel={t(labelKey)} onClick={() => setDensity(value)}>
                  <Icon className="size-4" />
                  <span className="text-foreground">{t(labelKey)}</span>
                </IconTile>
              ))}
            </div>
          </section>

          <section className="space-y-2.5">
            <SectionLabel>{t('language')}</SectionLabel>
            <div className={cn(toggleGroupClass)}>
              <LanguageSwitcher />
            </div>
          </section>

          <section className="space-y-3 pt-1">
            <SectionLabel>{t('sidebar')}</SectionLabel>

            <div className={cn('space-y-1.5', toggleGroupClass)}>
              <Label className="font-medium text-muted-foreground text-xs">{t('sidebarStyle')}</Label>
              <ToggleGroup
                size="sm"
                variant="outline"
                type="single"
                value={sidebarVariant}
                onValueChange={(v) => v && setSidebarVariant(v as SidebarVariant)}
              >
                <ToggleGroupItem value="inset">{t('variantInset')}</ToggleGroupItem>
                <ToggleGroupItem value="sidebar">{t('variantSidebar')}</ToggleGroupItem>
                <ToggleGroupItem value="floating">{t('variantFloating')}</ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className={cn('space-y-1.5', toggleGroupClass)}>
              <Label className="font-medium text-muted-foreground text-xs">{t('collapseMode')}</Label>
              <ToggleGroup
                size="sm"
                variant="outline"
                type="single"
                value={sidebarCollapsible}
                onValueChange={(v) => v && setSidebarCollapsible(v as SidebarCollapsible)}
              >
                <ToggleGroupItem value="icon">
                  <Square className="size-3.5" />
                  {t('collapseIcon')}
                </ToggleGroupItem>
                <ToggleGroupItem value="offcanvas">
                  <SquareStack className="size-3.5" />
                  {t('collapseOffcanvas')}
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </section>
        </div>

        <SheetFooter className="px-6 py-4">
          <Button type="button" variant="outline" className="w-full" onClick={reset}>
            {t('reset')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
