'use client';

import type { ItemDto } from '@dataroom/types';
import { ChevronRight, CornerLeftUp, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FolderGlyph } from '../icons';
import { useEffect, useState } from 'react';
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
import { cn } from '@/lib/utils';
import { errorMessage } from '../errors';
import { useFolderPicker, useMoveItem } from '../hooks';

interface MoveDialogProps {
  item: ItemDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Crumb {
  id: string | null;
  name: string;
}

/**
 * Destination picker: navigate the folder tree and "Move here". The moved folder
 * (and, on the server, its subtree) is not a valid target — the server rejects an
 * illegal move with 400, surfaced as a toast.
 */
export function MoveDialog({ item, open, onOpenChange }: MoveDialogProps) {
  const t = useTranslations('dialogs');
  const [path, setPath] = useState<Crumb[]>([{ id: null, name: t('myDrive') }]);
  const current = path[path.length - 1];
  const folders = useFolderPicker(current.id, open);
  const move = useMoveItem();

  useEffect(() => {
    if (open) setPath([{ id: null, name: t('myDrive') }]);
  }, [open, t]);

  const enter = (folder: ItemDto) => setPath((prev) => [...prev, { id: folder.id, name: folder.name }]);
  const goUp = () => setPath((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));

  const alreadyHere = current.id === item.parentId;
  const intoItself = current.id === item.id;

  const submit = () => {
    move.mutate(
      { id: item.id, parentId: current.id },
      {
        onSuccess: () => {
          toast.success(t('moved', { name: item.name, destination: current.name }));
          onOpenChange(false);
        },
        onError: (err) => toast.error(errorMessage(err, t('moveFailed'))),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('moveTitle', { name: item.name })}</DialogTitle>
          <DialogDescription>{t('moveDescription')}</DialogDescription>
        </DialogHeader>

        {/* Location bar */}
        <div className="flex items-center gap-1 overflow-x-auto rounded-md border bg-muted/40 px-2 py-1.5 text-sm">
          {path.map((crumb, i) => (
            <span key={crumb.id ?? 'root'} className="flex shrink-0 items-center gap-1">
              {i > 0 && <ChevronRight className="size-3.5 text-muted-foreground" />}
              <button
                type="button"
                className={cn(
                  'rounded px-1 py-0.5 hover:bg-accent',
                  i === path.length - 1 ? 'font-medium text-foreground' : 'text-muted-foreground',
                )}
                onClick={() => setPath((prev) => prev.slice(0, i + 1))}
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </div>

        {/* Folder list */}
        <div className="h-56 overflow-y-auto rounded-md border">
          {path.length > 1 && (
            <button
              type="button"
              onClick={goUp}
              className="flex w-full items-center gap-2 border-b px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent"
            >
              <CornerLeftUp className="size-4" /> {t('upOneLevel')}
            </button>
          )}
          {folders.isLoading ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : folders.data && folders.data.length > 0 ? (
            folders.data.map((folder) => {
              const disabled = folder.id === item.id;
              return (
                <button
                  key={folder.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => enter(folder)}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent',
                    disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent',
                  )}
                >
                  <FolderGlyph className="size-4" />
                  <span className="flex-1 truncate">{folder.name}</span>
                  {!disabled && <ChevronRight className="size-4 text-muted-foreground" />}
                </button>
              );
            })
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {t('noSubFolders')}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button type="button" disabled={alreadyHere || intoItself || move.isPending} onClick={submit}>
            {move.isPending ? t('moving') : t('moveHere')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
