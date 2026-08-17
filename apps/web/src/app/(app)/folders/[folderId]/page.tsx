import { DriveView } from '@/features/items/DriveView';

/** Drive at a specific folder. Next 16 passes route params as a Promise. */
export default async function FolderPage({ params }: { params: Promise<{ folderId: string }> }) {
  const { folderId } = await params;
  return <DriveView parentId={folderId} />;
}
