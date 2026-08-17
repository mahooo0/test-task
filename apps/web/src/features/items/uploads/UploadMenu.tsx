'use client';

import { FolderUp, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { type ChangeEvent, useRef } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { pickedFromFileList } from './upload-helpers';
import { useUploads } from './uploads-context';

interface UploadMenuProps {
  /** Destination folder for the picked files (`null` = room root). */
  parentId: string | null;
  /** The clickable element that opens the menu (rendered `asChild`). */
  trigger: ReactNode;
  align?: 'start' | 'center' | 'end';
  filesLabel?: string;
  folderLabel?: string;
  contentClassName?: string;
}

/**
 * Upload dropdown shared by the toolbar button and the empty state: pick files
 * (multi PDF) or a whole folder, into `parentId`. Owns the two hidden inputs and
 * the queue hand-off; callers only supply the trigger element and labels.
 */
export function UploadMenu({
  parentId,
  trigger,
  align = 'end',
  filesLabel,
  folderLabel,
  contentClassName,
}: UploadMenuProps) {
  const { enqueue } = useUploads();
  const t = useTranslations('uploads');
  const filesText = filesLabel ?? t('files');
  const folderText = folderLabel ?? t('folder');
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  const onPicked = (e: ChangeEvent<HTMLInputElement>) => {
    enqueue(pickedFromFileList(e.target.files), parentId);
    e.target.value = ''; // let the same file be re-picked later
  };

  return (
    <>
      <input
        ref={fileInput}
        type="file"
        accept="application/pdf"
        multiple
        hidden
        onChange={onPicked}
      />
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
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        <DropdownMenuContent align={align} className={cn('w-44', contentClassName)}>
          <DropdownMenuItem onSelect={() => setTimeout(() => fileInput.current?.click(), 0)}>
            <Upload />
            {filesText}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setTimeout(() => folderInput.current?.click(), 0)}>
            <FolderUp />
            {folderText}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
