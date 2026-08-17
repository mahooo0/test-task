'use client';

import type { ItemDto, ShareDto } from '@dataroom/types';
import { ShareMode } from '@dataroom/types';
import { HardDrive, Share2, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { useItemShares } from '@/features/shares/hooks';
import { ShareDialog } from '@/features/shares/ShareDialog';
import { cn } from '@/lib/utils';
import { formatBytes, formatDate } from '../format';
import { useRoom, useRoomStats, useSubtreeStats } from '../hooks';
import { DateHint, ItemIcon, OwnerCell } from '../presentation';

/** What the panel describes: a specific item, or the room root ("Мой диск"). */
export type DetailsTarget = ItemDto | 'room';

interface DetailsPanelContextValue {
  target: DetailsTarget | null;
  open: (target: DetailsTarget) => void;
  close: () => void;
  /** Toggle the panel: open on `target`, or close if it's already showing the same target. */
  toggle: (target: DetailsTarget) => void;
}

const DetailsPanelContext = createContext<DetailsPanelContextValue | null>(null);

function targetId(target: DetailsTarget): string {
  return target === 'room' ? 'room' : target.id;
}

/**
 * Owns the in-drive "Сведения" side panel (Google-Drive-style ⓘ): the `…` menu opens it for one item,
 * the toolbar ⓘ toggles it for the current folder/room. Rendered as a fixed right drawer over the
 * shell (no dimming backdrop), so browsing continues underneath. Distinct from the PDF viewer's own
 * details drawer.
 */
export function DetailsPanelProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<DetailsTarget | null>(null);
  const open = useCallback((next: DetailsTarget) => setTarget(next), []);
  const close = useCallback(() => setTarget(null), []);
  const toggle = useCallback(
    (next: DetailsTarget) =>
      setTarget((cur) => (cur && targetId(cur) === targetId(next) ? null : next)),
    [],
  );
  const value = useMemo<DetailsPanelContextValue>(
    () => ({ target, open, close, toggle }),
    [target, open, close, toggle],
  );

  return (
    <DetailsPanelContext.Provider value={value}>
      {children}
      {target && <DetailsPanel target={target} onClose={close} />}
    </DetailsPanelContext.Provider>
  );
}

export function useDetailsPanel(): DetailsPanelContextValue {
  const ctx = useContext(DetailsPanelContext);
  if (!ctx) throw new Error('useDetailsPanel must be used within a DetailsPanelProvider');
  return ctx;
}

function DetailsPanel({ target, onClose }: { target: DetailsTarget; onClose: () => void }) {
  const t = useTranslations('details');
  const isMobile = useIsMobile();
  const panelRef = useRef<HTMLElement>(null);

  // The mobile Sheet (Radix Dialog) manages focus + Escape natively; the desktop drawer has no
  // such wrapper, so do it ourselves: move focus into the panel on open and restore it to the
  // previously focused element on close.
  useEffect(() => {
    if (isMobile) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => previouslyFocused?.focus?.();
  }, [isMobile]);

  // Close on Escape (matches the app's dialogs/drawers); the Sheet already handles this on mobile.
  useEffect(() => {
    if (isMobile) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMobile, onClose]);

  const body = target === 'room' ? <RoomBody /> : <ItemBody item={target} />;

  // On mobile, render as the Sheet primitive so it gets a backdrop + tap-outside/Escape dismissal.
  if (isMobile) {
    return (
      <Sheet open onOpenChange={(next) => next || onClose()}>
        <SheetContent
          side="right"
          aria-describedby={undefined}
          className="w-80 gap-0 p-0 sm:max-w-sm"
        >
          <SheetHeader className="h-14 flex-row items-center border-b px-4 py-0">
            <SheetTitle className="text-sm">{t('title')}</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-auto p-4">{body}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      ref={panelRef}
      tabIndex={-1}
      className="fixed top-14 right-0 bottom-0 z-30 flex w-80 flex-col border-l bg-background shadow-lg outline-none duration-200 animate-in slide-in-from-right-4 fade-in"
      aria-label={t('title')}
    >
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <h2 className="flex-1 font-medium text-sm">{t('title')}</h2>
        <Button variant="ghost" size="icon-sm" aria-label={t('close')} onClick={onClose}>
          <X />
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-4">{body}</div>
    </aside>
  );
}

/** Details for the room root: name + whole-room contents. */
function RoomBody() {
  const t = useTranslations('details');
  const locale = useLocale();
  const room = useRoom();
  const stats = useRoomStats();
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-muted">
          <HardDrive className="size-5 text-muted-foreground" />
        </span>
        <span className="min-w-0 truncate font-medium">{room.data?.name ?? t('myDrive')}</span>
      </div>
      <dl className="flex flex-col gap-4">
        <Row label={t('type')} value={t('typeRoom')} />
        {stats.data && (
          <>
            <Row
              label={t('contents')}
              value={t('contentsValue', {
                fileCount: stats.data.fileCount,
                folderCount: stats.data.folderCount,
              })}
            />
            <Row label={t('totalSize')} value={formatBytes(stats.data.totalSizeBytes, locale)} />
          </>
        )}
      </dl>
    </div>
  );
}

/** Details for a file/folder: type, size/contents, owner, dates, and sharing status. */
function ItemBody({ item }: { item: ItemDto }) {
  const t = useTranslations('details');
  const locale = useLocale();
  const isFolder = item.type === 'FOLDER';
  const stats = useSubtreeStats(isFolder ? item.id : null);
  const shares = useItemShares(item.id);
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <ItemIcon item={item} className="size-8 shrink-0" />
        <span className="min-w-0 break-words font-medium">{item.name}</span>
      </div>

      <dl className="flex flex-col gap-4">
        <Row label={t('type')} value={isFolder ? t('typeFolder') : 'PDF'} />
        {isFolder ? (
          stats.data && (
            <>
              <Row
                label={t('contents')}
                value={t('contentsValue', {
                  fileCount: stats.data.fileCount,
                  folderCount: stats.data.folderCount,
                })}
              />
              <Row label={t('totalSize')} value={formatBytes(stats.data.totalSizeBytes, locale)} />
            </>
          )
        ) : (
          <Row label={t('size')} value={formatBytes(item.sizeBytes, locale)} />
        )}
        <Row label={t('owner')}>
          <OwnerCell />
        </Row>
        <Row label={t('createdAt')}>
          <DateHint iso={item.createdAt}>{formatDate(item.createdAt, locale)}</DateHint>
        </Row>
        <Row label={t('updatedAt')}>
          <DateHint iso={item.updatedAt}>{formatDate(item.updatedAt, locale)}</DateHint>
        </Row>
        <Row label={t('access')} value={accessLabel(shares.data, t)} />
      </dl>

      <Button variant="outline" size="sm" className="w-full" onClick={() => setShareOpen(true)}>
        <Share2 />
        {t('manageAccess')}
      </Button>
      <ShareDialog item={item} open={shareOpen} onOpenChange={setShareOpen} />
    </div>
  );
}

/** "Только вы" / "Доступ по ссылке" / "N с доступом" from the resource's shares. */
function accessLabel(
  shares: ShareDto[] | undefined,
  t: ReturnType<typeof useTranslations>,
): string {
  if (!shares) return '—';
  const hasPublic = shares.some((s) => s.mode === ShareMode.PUBLIC);
  const people = shares
    .filter((s) => s.mode === ShareMode.RESTRICTED)
    .reduce((n, s) => n + s.grants.length, 0);
  if (hasPublic) return t('accessLink');
  if (people > 0) return t('accessPeople', { count: people });
  return t('accessPrivate');
}

/** A single label/value row in the panel. */
function Row({ label, value, children }: { label: string; value?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className={cn('text-sm', !children && 'break-words')}>{children ?? value}</dd>
    </div>
  );
}
