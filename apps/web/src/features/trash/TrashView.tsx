'use client';

import type { ItemDto } from '@dataroom/types';
import { RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { DeleteForeverDialog } from '@/features/items/dialogs/DeleteForeverDialog';
import { errorMessage } from '@/features/items/errors';
import { formatDate } from '@/features/items/format';
import { useEmptyTrash, useRestoreItem, useTrash } from '@/features/items/hooks';
import { DateHint, ItemIcon } from '@/features/items/presentation';

/**
 * "Корзина" — the trashed items of the room (each a *root* of what was trashed together). Every entry
 * can be restored to the drive or deleted forever; the whole Trash can be emptied at once. Trashed
 * items aren't openable or navigable — they only leave the Trash by restore or permanent delete.
 */
export function TrashView() {
  const t = useTranslations('trash');
  const locale = useLocale();
  const { data: items = [], isLoading, isError, refetch } = useTrash();
  const restore = useRestoreItem();
  const [confirmDelete, setConfirmDelete] = useState<ItemDto | null>(null);
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const onRestore = (item: ItemDto) =>
    restore.mutate(
      { id: item.id },
      {
        onSuccess: (restored) => toast.success(t('restored', { name: restored.name })),
        onError: (err) => toast.error(errorMessage(err, t('restoreFailed'))),
      },
    );

  return (
    <div className="flex h-full w-full flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-semibold text-xl">{t('title')}</h1>
        {items.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setConfirmEmpty(true)}>
            <Trash2 />
            {t('emptyTrash')}
          </Button>
        )}
      </div>
      <p className="text-muted-foreground text-sm">{t('description')}</p>

      {isLoading ? (
        <TrashSkeleton />
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-muted-foreground text-sm">{t('loadFailed')}</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            <RefreshCw />
            {t('retry')}
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
          <Trash2 className="size-10 text-muted-foreground/50" />
          <p className="text-muted-foreground text-sm">{t('empty')}</p>
        </div>
      ) : (
        <div className="flex flex-col">
          {items.map((item) => (
            <div
              key={item.id}
              className="group flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-muted/60"
            >
              <ItemIcon item={item} className="size-6 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-sm">{item.name}</span>
              {item.deletedAt && (
                <DateHint
                  iso={item.deletedAt}
                  className="hidden shrink-0 text-muted-foreground text-sm sm:block"
                >
                  {t('deletedAt', { date: formatDate(item.deletedAt, locale) })}
                </DateHint>
              )}
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={restore.isPending && restore.variables?.id === item.id}
                  onClick={() => onRestore(item)}
                >
                  <RotateCcw />
                  {t('restore')}
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('deleteForeverAria', { name: item.name })}
                  onClick={() => setConfirmDelete(item)}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmDelete && (
        <DeleteForeverDialog
          item={confirmDelete}
          open
          onOpenChange={(open) => !open && setConfirmDelete(null)}
        />
      )}
      <EmptyTrashDialog open={confirmEmpty} onOpenChange={setConfirmEmpty} />
    </div>
  );
}

/** Confirms emptying the whole Trash — permanent, irreversible. */
function EmptyTrashDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('trash');
  const emptyTrash = useEmptyTrash();
  const confirm = () =>
    emptyTrash.mutate(undefined, {
      onSuccess: () => {
        toast.success(t('emptied'));
        onOpenChange(false);
      },
      onError: (err) => toast.error(errorMessage(err, t('emptyFailed'))),
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('emptyConfirmTitle')}</DialogTitle>
          <DialogDescription>{t('emptyConfirmDescription')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={emptyTrash.isPending}
            onClick={confirm}
          >
            {emptyTrash.isPending ? t('emptying') : t('emptyConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TrashSkeleton() {
  return (
    <div className="flex flex-col gap-1 py-1">
      {['a', 'b', 'c', 'd'].map((key) => (
        <div key={key} className="flex items-center gap-3 px-3 py-2">
          <Skeleton className="size-6 rounded" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="ml-auto h-4 w-24" />
        </div>
      ))}
    </div>
  );
}
