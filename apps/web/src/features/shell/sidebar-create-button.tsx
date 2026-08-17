'use client';

import { FolderPlus, FolderUp, Plus, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { type ChangeEvent, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NewFolderDialog } from '@/features/items/dialogs/NewFolderDialog';
import { pickedFromFileList } from '@/features/items/uploads/upload-helpers';
import { useUploads } from '@/features/items/uploads/uploads-context';

/** The current folder id from the route (`/folders/:id`), or `null` at the drive root. */
function useCurrentParentId(): string | null {
  const pathname = usePathname();
  const match = pathname.match(/^\/folders\/([^/]+)/);
  return match ? match[1] : null;
}

/**
 * Google-Drive-style "Создать" button at the top of the sidebar: a prominent elevated pill that
 * opens a create menu (new folder / upload files / upload folder), acting on the current folder.
 * Collapses to a round "+" on the icon rail.
 */
export function SidebarCreateButton() {
  const t = useTranslations('create');
  const parentId = useCurrentParentId();
  const { enqueue } = useUploads();
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  const onPicked = (e: ChangeEvent<HTMLInputElement>) => {
    enqueue(pickedFromFileList(e.target.files), parentId);
    e.target.value = ''; // let the same file be re-picked later
  };

  return (
    <div className="px-2 pt-2 pb-3 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
      <input ref={fileInput} type="file" accept="application/pdf" multiple hidden onChange={onPicked} />
      {/* `webkitdirectory` isn't a typed React prop — set it on the DOM node directly. */}
      <input
        ref={(el) => {
          folderInput.current = el;
          if (el) {
            el.setAttribute('webkitdirectory', '');
            el.setAttribute('directory', '');
          }
        }}
        type="file"
        hidden
        onChange={onPicked}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            aria-label={t('create')}
            className="h-11 w-full justify-center gap-2 rounded-lg font-normal text-sm shadow-sm group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:p-0"
          >
            <Plus className="size-4 shrink-0" />
            <span className="group-data-[collapsible=icon]:hidden">{t('create')}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuItem onSelect={() => setNewFolderOpen(true)}>
            <FolderPlus />
            {t('newFolder')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setTimeout(() => fileInput.current?.click(), 0)}>
            <Upload />
            {t('uploadFiles')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setTimeout(() => folderInput.current?.click(), 0)}>
            <FolderUp />
            {t('uploadFolder')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <NewFolderDialog parentId={parentId} open={newFolderOpen} onOpenChange={setNewFolderOpen} />
    </div>
  );
}
