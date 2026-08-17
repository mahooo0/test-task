'use client';

import type { ItemDto } from '@dataroom/types';
import { useTranslations } from 'next-intl';
import { type FormEvent, useEffect, useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api-client';
import { conflictSuggestion, errorMessage } from '../errors';
import { useMoveItem } from '../hooks';

/** A drop that hit a same-named item in the destination. Resolve by renaming as part of the move. */
export interface MoveConflict {
  item: ItemDto;
  parentId: string | null;
  destName: string;
  suggestedName: string;
}

/**
 * Shown when dragging an item onto a folder that already has one with the same name (server 409).
 * The name field is pre-filled with the backend's suggestion ("name (1)"); confirming moves + renames
 * in one PATCH. If the new name also clashes, the field re-primes with the next suggestion. Cancel
 * leaves the item where it was.
 */
export function MoveConflictDialog({
  conflict,
  onClose,
}: {
  conflict: MoveConflict | null;
  onClose: () => void;
}) {
  const t = useTranslations('dialogs');
  const [name, setName] = useState('');
  const move = useMoveItem();

  useEffect(() => {
    if (conflict) setName(conflict.suggestedName);
  }, [conflict]);

  if (!conflict) return null;
  const { item, parentId, destName } = conflict;
  const noun = item.type === 'FOLDER' ? t('folder') : t('file');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    move.mutate(
      { id: item.id, parentId, name: trimmed },
      {
        onSuccess: () => {
          toast.success(t('moved', { name: trimmed, destination: destName }));
          onClose();
        },
        onError: (err) => {
          const next = conflictSuggestion(err);
          if (next) {
            setName(next);
            toast.error(t('alsoTaken', { name: trimmed, suggestion: next }));
            return;
          }
          toast.error(errorMessage(err, t('moveFailed')));
          // The item or destination is gone (deleted/moved elsewhere) — nothing left to resolve here.
          if (err instanceof ApiError && err.status === 404) onClose();
        },
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{t('conflictTitle')}</DialogTitle>
            <DialogDescription>
              {t('conflictDescription', { dest: destName, noun, name: item.name })}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            <Label htmlFor="move-conflict-name">{t('name')}</Label>
            <Input
              id="move-conflict-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={255}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={!name.trim() || move.isPending}>
              {move.isPending ? t('moving') : t('moveHere')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
