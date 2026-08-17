import type { ReactNode } from 'react';
import { DetailsPanelProvider } from '@/features/items/details/details-panel';
import { DriveDndProvider } from '@/features/items/dnd/DriveDndProvider';
import { PdfPreviewProvider } from '@/features/items/preview/pdf-preview';
import { DropOverlay } from '@/features/items/uploads/DropOverlay';
import { DropZoneProvider } from '@/features/items/uploads/drop-zone';
import { UploadProgress } from '@/features/items/uploads/UploadProgress';
import { UploadsProvider } from '@/features/items/uploads/uploads-context';
import { NewShareNotifier } from '@/features/shares/NewShareNotifier';
import { AppShell } from '@/features/shell/app-shell';

/**
 * Wraps the authenticated app (drive) in the sidebar + header shell. The uploads
 * provider sits above the shell so in-flight transfers survive folder navigation;
 * the drop overlay + progress panel render app-wide. `DropZoneProvider` owns the
 * file-drag state (shared by the empty state's highlight and the drop overlay);
 * `DriveDndProvider` wraps the shell so a drive item can be dragged onto the tree.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <UploadsProvider>
      <DropZoneProvider>
        <PdfPreviewProvider>
          <DetailsPanelProvider>
            <DriveDndProvider>
              <AppShell>{children}</AppShell>
              <NewShareNotifier />
            </DriveDndProvider>
          </DetailsPanelProvider>
        </PdfPreviewProvider>
        <DropOverlay />
        <UploadProgress />
      </DropZoneProvider>
    </UploadsProvider>
  );
}
