import { redirect } from 'next/navigation';

/**
 * Legacy signed-in shared route. "Shared with me" no longer has its own page — a grantee now browses
 * the resource inline on `/personal` (see {@link SharedInlineDrive}). Old links / bookmarks redirect
 * there so they keep resolving.
 */
export default async function SharedResourcePage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  redirect(`/personal?share=${encodeURIComponent(shareId)}`);
}
