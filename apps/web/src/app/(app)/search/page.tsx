import { SearchResults } from '@/features/search/SearchResults';

/** Full "Все результаты" page — term + filters live in the URL. Next passes searchParams as a Promise. */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; modified?: string; person?: string }>;
}) {
  const sp = await searchParams;
  return (
    <SearchResults query={sp.q ?? ''} type={sp.type} modified={sp.modified} person={sp.person} />
  );
}
