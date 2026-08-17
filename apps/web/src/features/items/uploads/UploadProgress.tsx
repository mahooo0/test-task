'use client';

import { AlertCircle, Check, ChevronDown, Loader2, RotateCcw, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PdfGlyph } from '../icons';
import { type UploadTask, useUploads } from './uploads-context';

/**
 * Fixed bottom-right transfer panel — Google-Drive style. The title bar collapses the list down to
 * just itself (chevron) and closes the whole panel (X). Each row is a PDF glyph · name · a status
 * that swaps a progress ring / green check for a cancel/dismiss control on hover.
 */
export function UploadProgress() {
  const { tasks, cancel, retry, remove, dismissAll } = useUploads();
  const t = useTranslations('uploads');
  const [collapsed, setCollapsed] = useState(false);
  const listId = useId();
  if (tasks.length === 0) return null;

  const active = tasks.filter(
    (task) => task.state === 'uploading' || task.state === 'queued',
  ).length;
  const done = tasks.filter((task) => task.state === 'done').length;
  // Prefer the live/success counts; only when nothing is in flight or done (every task errored or was
  // canceled) fall back to a "not uploaded" summary — never claim "0 files uploaded".
  const title =
    active > 0
      ? t('uploading', { count: active })
      : done > 0
        ? t('uploaded', { count: done })
        : t('notUploaded', { count: tasks.length });

  return (
    <div className="fixed right-4 bottom-0 z-50 w-[min(92vw,23rem)] overflow-hidden rounded-t-xl border border-b-0 bg-popover text-popover-foreground shadow-[0_-4px_32px_-8px_rgba(0,0,0,0.28)] duration-300 animate-in fade-in slide-in-from-bottom-8 dark:shadow-[0_-8px_40px_-10px_rgba(0,0,0,0.8)] dark:ring-1 dark:ring-white/10">
      <div className={cn('flex items-center gap-1 px-4 py-3', !collapsed && 'border-b')}>
        <span aria-live="polite" className="min-w-0 flex-1 truncate font-semibold text-sm">
          {title}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={collapsed ? t('expand') : t('collapse')}
          aria-expanded={!collapsed}
          aria-controls={listId}
          // A disclosure is expanded at rest, so suppress the ghost variant's aria-expanded highlight
          // (meant for menu triggers) — keep the chevron flat like the reference, hover/focus aside.
          className="aria-expanded:bg-transparent!"
          onClick={() => setCollapsed((prev) => !prev)}
        >
          <ChevronDown className={cn('transition-transform', collapsed && 'rotate-180')} />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label={t('close')} onClick={dismissAll}>
          <X />
        </Button>
      </div>

      {/* Collapse to just the title bar — the 0fr↔1fr grid row animates height without measuring.
          `inert` pulls the hidden rows out of the tab order + a11y tree, so "collapsed" holds for
          keyboard and screen-reader users too, not just visually. */}
      <div
        id={listId}
        inert={collapsed}
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out',
          collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]',
        )}
      >
        <ul className="max-h-72 min-h-0 divide-y overflow-y-auto">
          {tasks.map((task) => (
            <li key={task.id} className="group/row flex items-center gap-3 px-4 py-2.5">
              <PdfGlyph className="size-6 text-[#EA4335]" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm" title={task.relativePath}>
                  {task.name}
                </div>
                {(task.state === 'error' || task.state === 'canceled') && (
                  <StatusText task={task} />
                )}
              </div>
              <StatusSlot
                task={task}
                onCancel={() => cancel(task.id)}
                onRetry={() => retry(task.id)}
                onRemove={() => remove(task.id)}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** The trailing control: a ring/spinner/check that reveals a cancel or dismiss button on hover. */
function StatusSlot({
  task,
  onCancel,
  onRetry,
  onRemove,
}: {
  task: UploadTask;
  onCancel: () => void;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const t = useTranslations('uploads');

  if (task.state === 'done') {
    return (
      <SwapControl base={<DoneCheck />} label={t('dismiss')} icon={<X />} onClick={onRemove} />
    );
  }

  if (task.state === 'uploading' || task.state === 'queued') {
    const base =
      task.state === 'queued' ? (
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      ) : (
        <ProgressRing value={task.progress} label={task.name} />
      );
    return <SwapControl base={base} label={t('cancel')} icon={<X />} onClick={onCancel} />;
  }

  // error | canceled — both are retryable; keep the message inline under the name.
  return (
    <div className="flex shrink-0 items-center">
      <Button variant="ghost" size="icon-xs" aria-label={t('retry')} onClick={onRetry}>
        <RotateCcw />
      </Button>
      <Button variant="ghost" size="icon-xs" aria-label={t('dismiss')} onClick={onRemove}>
        <X />
      </Button>
    </div>
  );
}

/** Shows `base`, swapping to an icon button while the row is hovered or focused. */
function SwapControl({
  base,
  label,
  icon,
  onClick,
}: {
  base: ReactNode;
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <div className="relative size-6 shrink-0">
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity group-hover/row:opacity-0 group-focus-within/row:opacity-0">
        {base}
      </span>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={label}
        onClick={onClick}
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity focus-visible:pointer-events-auto focus-visible:opacity-100 group-hover/row:pointer-events-auto group-hover/row:opacity-100 group-focus-within/row:pointer-events-auto group-focus-within/row:opacity-100"
      >
        {icon}
      </Button>
    </div>
  );
}

/** The solid green success badge (white check on Google's success green). */
function DoneCheck() {
  const t = useTranslations('uploads');
  return (
    <span className="flex size-5 items-center justify-center rounded-full bg-[#34A853] text-white">
      <Check className="size-3.5" strokeWidth={3} />
      <span className="sr-only">{t('done')}</span>
    </span>
  );
}

/** Determinate circular progress, 0–100. Starts at 12 o'clock (the svg is rotated -90°). */
function ProgressRing({ value, label }: { value: number; label: string }) {
  const radius = 8;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, value));
  const offset = circumference * (1 - clamped / 100);
  return (
    <svg
      viewBox="0 0 20 20"
      className="size-5 -rotate-90"
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <circle cx="10" cy="10" r={radius} fill="none" strokeWidth="2.5" className="stroke-muted" />
      <circle
        cx="10"
        cy="10"
        r={radius}
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="stroke-primary transition-[stroke-dashoffset] duration-200"
      />
    </svg>
  );
}

/** The error message / "canceled" line shown under the file name for failed rows. */
function StatusText({ task }: { task: UploadTask }) {
  const t = useTranslations('uploads');
  if (task.state === 'canceled') {
    return <div className="mt-0.5 truncate text-muted-foreground text-xs">{t('canceled')}</div>;
  }
  return (
    <div className="mt-0.5 flex items-center gap-1 text-destructive text-xs" title={task.error}>
      <AlertCircle className="size-3 shrink-0" />
      <span className="truncate">{task.error ?? t('failed')}</span>
    </div>
  );
}
