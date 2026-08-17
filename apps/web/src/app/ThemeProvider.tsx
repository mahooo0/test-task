'use client';

import type { ItemSortField, SortDirection } from '@dataroom/types';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';

export type Theme = 'system' | 'dark' | 'light';
export type Density = 'compact' | 'comfortable' | 'spacious';
export type SidebarVariant = 'inset' | 'sidebar' | 'floating';
export type SidebarCollapsible = 'icon' | 'offcanvas';
export type ViewMode = 'list' | 'grid' | 'timeline';

export interface Preferences {
  theme: Theme;
  density: Density;
  sidebarVariant: SidebarVariant;
  sidebarCollapsible: SidebarCollapsible;
  viewMode: ViewMode;
  sortField: ItemSortField;
  sortDir: SortDirection;
}

export const PREFERENCE_DEFAULTS: Preferences = {
  theme: 'light',
  density: 'comfortable',
  sidebarVariant: 'sidebar',
  sidebarCollapsible: 'icon',
  viewMode: 'list',
  sortField: 'name',
  sortDir: 'asc',
};

const STORAGE_KEYS: Record<keyof Preferences, string> = {
  theme: 'theme',
  density: 'density',
  sidebarVariant: 'sidebar-variant',
  sidebarCollapsible: 'sidebar-collapsible',
  viewMode: 'view-mode',
  sortField: 'sort-field',
  sortDir: 'sort-dir',
};

const OPTIONS: Record<keyof Preferences, readonly string[]> = {
  theme: ['system', 'dark', 'light'],
  density: ['compact', 'comfortable', 'spacious'],
  sidebarVariant: ['inset', 'sidebar', 'floating'],
  sidebarCollapsible: ['icon', 'offcanvas'],
  viewMode: ['list', 'grid', 'timeline'],
  sortField: ['name', 'modified', 'created', 'size'],
  sortDir: ['asc', 'desc'],
};

interface PreferencesContextValue extends Preferences {
  setTheme: (value: Theme) => void;
  setDensity: (value: Density) => void;
  setSidebarVariant: (value: SidebarVariant) => void;
  setSidebarCollapsible: (value: SidebarCollapsible) => void;
  setViewMode: (value: ViewMode) => void;
  /** Sets sort field + direction together so a re-sort is a single state update (one refetch). */
  setSort: (field: ItemSortField, dir: SortDirection) => void;
  reset: () => void;
}

const ThemeContext = createContext<PreferencesContextValue | null>(null);

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function isDark(theme: Theme): boolean {
  return theme === 'dark' || (theme === 'system' && systemPrefersDark());
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // SSR-safe defaults. Real values are read on mount; the inline no-flash script in
  // the root layout already applied them before paint, so gating the DOM effects on
  // `mounted` avoids both a FOUC and a hydration mismatch.
  const [prefs, setPrefs] = useState<Preferences>(PREFERENCE_DEFAULTS);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const read = <K extends keyof Preferences>(key: K): Preferences[K] => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEYS[key]);
        return raw && OPTIONS[key].includes(raw) ? (raw as Preferences[K]) : PREFERENCE_DEFAULTS[key];
      } catch {
        return PREFERENCE_DEFAULTS[key];
      }
    };
    setPrefs({
      theme: read('theme'),
      density: read('density'),
      sidebarVariant: read('sidebarVariant'),
      sidebarCollapsible: read('sidebarCollapsible'),
      viewMode: read('viewMode'),
      sortField: read('sortField'),
      sortDir: read('sortDir'),
    });
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.classList.toggle('dark', isDark(prefs.theme));
    if (prefs.theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => document.documentElement.classList.toggle('dark', mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [prefs.theme, mounted]);

  useEffect(() => {
    if (!mounted) return;
    const el = document.documentElement;
    el.setAttribute('data-density', prefs.density);
    el.setAttribute('data-view-mode', prefs.viewMode);
  }, [prefs.density, prefs.viewMode, mounted]);

  const value = useMemo<PreferencesContextValue>(() => {
    const set = <K extends keyof Preferences>(key: K, val: Preferences[K]) => {
      try {
        window.localStorage.setItem(STORAGE_KEYS[key], val);
      } catch {
        // storage unavailable (private mode) — the DOM effect still applies it this session
      }
      setPrefs((prev) => ({ ...prev, [key]: val }));
    };
    return {
      ...prefs,
      setTheme: (v) => set('theme', v),
      setDensity: (v) => set('density', v),
      setSidebarVariant: (v) => set('sidebarVariant', v),
      setSidebarCollapsible: (v) => set('sidebarCollapsible', v),
      setViewMode: (v) => set('viewMode', v),
      setSort: (field, dir) => {
        try {
          window.localStorage.setItem(STORAGE_KEYS.sortField, field);
          window.localStorage.setItem(STORAGE_KEYS.sortDir, dir);
        } catch {
          // storage unavailable (private mode) — the change still applies this session
        }
        setPrefs((prev) => ({ ...prev, sortField: field, sortDir: dir }));
      },
      reset: () => {
        for (const key of Object.keys(PREFERENCE_DEFAULTS) as (keyof Preferences)[]) {
          set(key, PREFERENCE_DEFAULTS[key]);
        }
      },
    };
  }, [prefs]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): PreferencesContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
