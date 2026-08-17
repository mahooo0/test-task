import { PersonalHome } from '@/features/home/PersonalHome';

/**
 * "Личные" — the Google Drive-style welcome dashboard over the caller's own drive. `?share=<id>`
 * opens a resource shared with you inline (grantee browse); `?highlight=<id>` scrolls the matching
 * "Доступно мне" card into view and pulses it (used by the "shared with you" toast's View action).
 */
export default async function PersonalPage({
  searchParams,
}: {
  searchParams: Promise<{ share?: string; highlight?: string }>;
}) {
  const { share, highlight } = await searchParams;
  return <PersonalHome initialShareId={share ?? null} highlightShareId={highlight ?? null} />;
}
