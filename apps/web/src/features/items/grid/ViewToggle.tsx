'use client';

import { CalendarDays, LayoutGrid, List } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ViewMode, useTheme } from '@/app/ThemeProvider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

/** List ↔ grid ↔ date-grouped switch, bound to the persisted `viewMode` preference. */
export function ViewToggle() {
  const t = useTranslations('view');
  const { viewMode, setViewMode } = useTheme();
  return (
    <ToggleGroup
      type="single"
      size="sm"
      variant="outline"
      value={viewMode}
      onValueChange={(value) => value && setViewMode(value as ViewMode)}
      aria-label={t('mode')}
    >
      <ToggleGroupItem value="list" aria-label={t('list')}>
        <List />
      </ToggleGroupItem>
      <ToggleGroupItem value="grid" aria-label={t('grid')}>
        <LayoutGrid />
      </ToggleGroupItem>
      <ToggleGroupItem value="timeline" aria-label={t('timeline')}>
        <CalendarDays />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
