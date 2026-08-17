'use client';

import { useTranslations } from 'next-intl';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
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
import { errorMessage } from '../errors';
import { useCreateFolder, useFolderPicker } from '../hooks';

interface NewFolderDialogProps {
  parentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewFolderDialog({ parentId, open, onOpenChange }: NewFolderDialogProps) {
  const t = useTranslations('dialogs');
  const [name, setName] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const createFolder = useCreateFolder();

  // Sibling folders in this directory — lets us flag a name clash live instead of only on submit.
  // The server is still the authority (it also rejects a clash with a file or beyond this window).
  const { data: siblings } = useFolderPicker(parentId, open);
  const takenNames = useMemo(() => new Set((siblings ?? []).map((f) => f.name)), [siblings]);

  const trimmed = name.trim();
  const duplicate = trimmed.length > 0 && takenNames.has(trimmed);
  const message = duplicate ? t('folderExists', { name: trimmed }) : submitError;

  useEffect(() => {
    if (open) {
      setName('');
      setSubmitError(null);
    }
  }, [open]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!trimmed || duplicate) return;
    createFolder.mutate(
      { parentId, name: trimmed },
      {
        onSuccess: (item) => {
          toast.success(t('folderCreated', { name: item.name }));
          posthog.capture('folder_created', {
            has_parent: parentId !== null,
            item_type: 'FOLDER',
          });
          onOpenChange(false);
        },
        // Keep the dialog open and surface the reason inline (e.g. a clash with an existing file).
        onError: (err) => setSubmitError(errorMessage(err, t('createFolderFailed'))),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{t('newFolderTitle')}</DialogTitle>
            <DialogDescription>{t('newFolderDescription')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            <Label htmlFor="new-folder-name">{t('name')}</Label>
            <Input
              id="new-folder-name"
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSubmitError(null);
              }}
              placeholder={t('untitledFolder')}
              maxLength={255}
              aria-invalid={message ? true : undefined}
              aria-describedby={message ? 'new-folder-error' : undefined}
            />
            {message && (
              <p id="new-folder-error" className="text-destructive text-sm">
                {message}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={!trimmed || duplicate || createFolder.isPending}>
              {createFolder.isPending ? t('creating') : t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
