'use client';

import type { ItemDto } from '@dataroom/types';
import { useLocale, useTranslations } from 'next-intl';
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
import posthog from 'posthog-js';
import { errorMessage } from '../errors';
import { formatBytes } from '../format';
import { useDeleteForever, useSubtreeStats } from '../hooks';

interface DeleteForeverDialogProps {
  item: ItemDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Confirms a **permanent** delete from the Trash — irreversible. For a folder it fetches subtree
 * stats so the impact (how much is about to be lost for good) is explicit.
 */
export function DeleteForeverDialog({ item, open, onOpenChange }: DeleteForeverDialogProps) {
  const t = useTranslations('dialogs');
  const locale = useLocale();
  const isFolder = item.type === 'FOLDER';
  const stats = useSubtreeStats(item.id, open && isFolder);
  const deleteForever = useDeleteForever();

  const impact = () => {
    if (!isFolder) return t('impactFile', { name: item.name });
    if (stats.isLoading) return t('calculating');
    if (stats.data) {
      const { folderCount, fileCount, totalSizeBytes } = stats.data;
      if (folderCount === 0 && fileCount === 0) return t('impactEmptyFolder', { name: item.name });
      const parts: string[] = [];
      if (folderCount > 0) parts.push(t('foldersCount', { count: folderCount }));
      if (fileCount > 0) parts.push(t('filesCount', { count: fileCount }));
      return t('impactFolder', {
        name: item.name,
        parts: parts.join(', '),
        size: formatBytes(totalSizeBytes, locale),
      });
    }
    return t('impactFolderUnknown', { name: item.name });
  };

  const confirm = () => {
    deleteForever.mutate(
      { id: item.id },
      {
        onSuccess: () => {
          posthog.capture('item_deleted', {
            item_type: item.type,
            had_contents: isFolder && stats.data
              ? stats.data.fileCount > 0 || stats.data.folderCount > 0
              : undefined,
          });
          toast.success(t('deletedForever', { name: item.name }));
          onOpenChange(false);
        },
        onError: (err) => toast.error(errorMessage(err, t('deleteFailed'))),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('deleteForeverTitle')}</DialogTitle>
          <DialogDescription>{impact()}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={deleteForever.isPending || (isFolder && stats.isLoading)}
            onClick={confirm}
          >
            {deleteForever.isPending ? t('deleting') : t('deleteForever')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
