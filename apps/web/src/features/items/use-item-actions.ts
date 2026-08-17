'use client';

import type { ItemDto } from '@dataroom/types';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { errorMessage } from './errors';
import { useFileActions, useToggleStar } from './hooks';
import { usePdfPreview } from './preview/pdf-preview';

/**
 * Open / download / star handlers bound to a single item, shared by the list row and the grid card so
 * both surface files identically. "Open" launches the in-app PDF viewer; "star" toggles the item in
 * "Помеченные". (Deleting goes through the {@link import('./dialogs/TrashDialog').TrashDialog} confirm.)
 */
export function useItemActions(item: ItemDto) {
  const t = useTranslations('items');
  const te = useTranslations('errors');
  const { open } = usePdfPreview();
  const { download } = useFileActions();
  const star = useToggleStar();
  return {
    openFile: () => open(item),
    toggleStar: () =>
      star.mutate(
        { id: item.id, starred: !item.starred },
        {
          onSuccess: (updated) =>
            toast.success(
              updated.starred
                ? t('starredAdded', { name: item.name })
                : t('starredRemoved', { name: item.name }),
            ),
          onError: (err) => toast.error(errorMessage(err, te('updateFailed'))),
        },
      ),
    downloadFile: () =>
      download(item.id).catch((err) => toast.error(errorMessage(err, te('downloadFailed')))),
  };
}
