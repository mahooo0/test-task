'use client';

import type { ItemDto } from '@dataroom/types';
import { useState } from 'react';
import { ShareDialog } from '@/features/shares/ShareDialog';
import { MoveDialog } from './dialogs/MoveDialog';
import { TrashDialog } from './dialogs/TrashDialog';
import { NewFolderDialog } from './dialogs/NewFolderDialog';
import { RenameDialog } from './dialogs/RenameDialog';
import type { ItemAction } from './ItemActionsMenu';

/** Which drive dialog is open: the "new folder" dialog, or an action targeting a specific item. */
export type DriveDialogState = { type: 'new' } | { type: ItemAction; item: ItemDto } | null;

/** Local dialog state + the handlers a listing needs (open "new folder", route a row action, close). */
export function useDriveDialogs() {
  const [dialog, setDialog] = useState<DriveDialogState>(null);
  return {
    dialog,
    openNew: () => setDialog({ type: 'new' }),
    onAction: (action: ItemAction, item: ItemDto) => setDialog({ type: action, item }),
    close: (open: boolean) => {
      if (!open) setDialog(null);
    },
  };
}

/** Renders the currently-open drive dialog (new folder / rename / move / delete-to-trash confirm). */
export function DriveDialogs({
  parentId,
  dialog,
  onOpenChange,
}: {
  parentId: string | null;
  dialog: DriveDialogState;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <>
      <NewFolderDialog parentId={parentId} open={dialog?.type === 'new'} onOpenChange={onOpenChange} />
      {dialog?.type === 'share' && <ShareDialog item={dialog.item} open onOpenChange={onOpenChange} />}
      {dialog?.type === 'rename' && <RenameDialog item={dialog.item} open onOpenChange={onOpenChange} />}
      {dialog?.type === 'move' && <MoveDialog item={dialog.item} open onOpenChange={onOpenChange} />}
      {dialog?.type === 'delete' && <TrashDialog item={dialog.item} open onOpenChange={onOpenChange} />}
    </>
  );
}
