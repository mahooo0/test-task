'use client';

import type { ItemDto } from '@dataroom/types';
import { useTranslations } from 'next-intl';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import posthog from 'posthog-js';
import { conflictSuggestion, errorMessage } from '../errors';
import { useRenameItem } from '../hooks';

interface RenameDialogProps {
  item: ItemDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RenameDialog({ item, open, onOpenChange }: RenameDialogProps) {
  const t = useTranslations('dialogs');
  const [name, setName] = useState(item.name);
  const rename = useRenameItem();
  const inputRef = useRef<HTMLInputElement>(null);
  const noun = item.type === 'FOLDER' ? t('folder') : t('file');

  useEffect(() => {
    if (!open) return;
    setName(item.name);
    // Focus + pre-select so typing replaces the name — but for files select only the basename,
    // leaving the extension intact (a rename rarely means changing ".pdf").
    const dot = item.type === 'FILE' ? item.name.lastIndexOf('.') : -1;
    const selectionEnd = dot > 0 ? dot : item.name.length;
    // Defer past Radix's open-focus and the reset value's paint before selecting.
    const frame = requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      input.setSelectionRange(0, selectionEnd);
    });
    return () => cancelAnimationFrame(frame);
  }, [open, item.name, item.type]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === item.name) {
      onOpenChange(false);
      return;
    }
    rename.mutate(
      { id: item.id, name: trimmed },
      {
        onSuccess: () => {
          toast.success(t('renamed'));
          posthog.capture('item_renamed', { item_type: item.type });
          onOpenChange(false);
        },
        onError: (err) => {
          const suggestion = conflictSuggestion(err);
          if (suggestion) {
            setName(suggestion);
            toast.error(t('nameTaken', { suggestion }));
          } else {
            toast.error(errorMessage(err, t('renameFailed')));
          }
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{t('renameTitle', { noun })}</DialogTitle>
            <DialogDescription>{t('renameDescription', { name: item.name })}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            <Label htmlFor="rename-name">{t('name')}</Label>
            <Input
              id="rename-name"
              ref={inputRef}
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={255}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={!name.trim() || rename.isPending}>
              {rename.isPending ? t('saving') : t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
