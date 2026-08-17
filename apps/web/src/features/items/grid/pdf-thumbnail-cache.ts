import { itemsApi } from '../api';
import { renderFirstPage } from './pdfjs';

/** Target thumbnail width in CSS px (rendered at ×DPR inside {@link renderFirstPage}). */
const THUMBNAIL_WIDTH = 320;
/** Mirror the upload engine's limiter — cap simultaneous presign+fetch+render jobs. */
const MAX_CONCURRENT = 3;

export type ThumbnailState =
  | { status: 'loading' }
  | { status: 'ready'; dataUrl: string }
  | { status: 'error' };

type Entry =
  | { status: 'ready'; dataUrl: string }
  | { status: 'error' }
  | { status: 'loading'; promise: Promise<void> };

/**
 * Rendered page-1 thumbnails, keyed by (immutable) item id. Items are content-
 * immutable once uploaded, so an id is a safe cache key; the rendered data URL is
 * cached — never the single-use presigned URL — so re-scroll/re-mount is free.
 */
const cache = new Map<string, Entry>();

let active = 0;
const waiting: Array<() => void> = [];

function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => waiting.push(resolve));
}

function release(): void {
  active -= 1;
  const next = waiting.shift();
  if (next) {
    active += 1;
    next();
  }
}

export function getCachedThumbnail(id: string): ThumbnailState | undefined {
  const entry = cache.get(id);
  if (!entry) return undefined;
  if (entry.status === 'ready') return { status: 'ready', dataUrl: entry.dataUrl };
  if (entry.status === 'error') return { status: 'error' };
  return { status: 'loading' };
}

/**
 * Render (or return the cached) page-1 thumbnail for a file. Concurrent callers
 * for the same id share one render; failures cache as `error` so a broken or
 * expired file falls back to an icon without re-fetching in a loop.
 */
export async function loadThumbnail(
  id: string,
  getToken: () => Promise<string | null>,
): Promise<ThumbnailState> {
  const existing = cache.get(id);
  if (existing) {
    if (existing.status === 'loading') await existing.promise;
    return getCachedThumbnail(id) ?? { status: 'error' };
  }

  const promise = (async () => {
    await acquire();
    try {
      const { url } = await itemsApi.previewUrl(await getToken(), id);
      const bytes = await fetch(url).then((res) => {
        if (!res.ok) throw new Error(`thumbnail fetch failed: ${res.status}`);
        return res.arrayBuffer();
      });
      const { dataUrl } = await renderFirstPage(bytes, THUMBNAIL_WIDTH);
      cache.set(id, { status: 'ready', dataUrl });
    } catch {
      cache.set(id, { status: 'error' });
    } finally {
      release();
    }
  })();

  cache.set(id, { status: 'loading', promise });
  await promise;
  return getCachedThumbnail(id) ?? { status: 'error' };
}
