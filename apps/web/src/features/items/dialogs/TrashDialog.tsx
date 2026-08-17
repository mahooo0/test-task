'use client';

import type { ItemDto } from '@dataroom/types';
import { useTranslations } from 'next-intl';
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
import { errorMessage } from '../errors';
import { useDeleteItem, useRestoreItem } from '../hooks';

interface TrashDialogProps {
  item: ItemDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Confirms moving an item to the Trash. The action is reversible (an inline Undo restores it), and the
 * copy spells out the lifecycle: it goes to the Trash and is permanently purged after 30 days.
 */
export function TrashDialog({ item, open, onOpenChange }: TrashDialogProps) {
  const t = useTranslations('dialogs');
  const trash = useDeleteItem();
  const restore = useRestoreItem();

  const confirm = () => {
    trash.mutate(
      { id: item.id },
      {
        onSuccess: () => {
          toast.success(t('trashedToast', { name: item.name }), {
            action: {
              label: t('undo'),
              onClick: () =>
                restore.mutate(
                  { id: item.id },
                  { onError: (err) => toast.error(errorMessage(err, t('restoreFailed'))) },
                ),
            },
          });
          onOpenChange(false);
        },
        onError: (err) => toast.error(errorMessage(err, t('trashFailed'))),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('trashTitle')}</DialogTitle>
          <DialogDescription>{t('trashDescription', { name: item.name })}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={trash.isPending}
            onClick={confirm}
          >
            {trash.isPending ? t('trashing') : t('trashConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
