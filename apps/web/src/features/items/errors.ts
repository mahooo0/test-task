import { ApiError } from '@/lib/api-client';

/** On a name-conflict (409) the API returns `details.suggestedName`; pull it out or null. */
export function conflictSuggestion(err: unknown): string | null {
  if (err instanceof ApiError && err.code === 'CONFLICT') {
    const details = err.details as { suggestedName?: string } | undefined;
    return details?.suggestedName ?? null;
  }
  return null;
}

/** The server's message if it's an ApiError, else a caller-supplied fallback. */
export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError && err.message ? err.message : fallback;
}
