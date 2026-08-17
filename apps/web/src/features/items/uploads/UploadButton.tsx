'use client';

import { ChevronDown, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { UploadMenu } from './UploadMenu';

/** Toolbar upload control: opens the shared files/folder menu, targeting `parentId`. */
export function UploadButton({ parentId }: { parentId: string | null }) {
  const t = useTranslations('uploads');
  return (
    <UploadMenu
      parentId={parentId}
      trigger={
        <Button size="sm">
          <Upload />
          <span className="hidden sm:inline">{t('upload')}</span>
          <ChevronDown className="opacity-70" />
        </Button>
      }
    />
  );
}
