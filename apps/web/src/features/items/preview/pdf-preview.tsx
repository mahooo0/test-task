'use client';

import { useAuth } from '@clerk/nextjs';
import type { ItemDto } from '@dataroom/types';
import { Download, Info, RefreshCw, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn, getInitials } from '@/lib/utils';
import { itemsApi } from '../api';
import { errorMessage } from '../errors';
import { formatBytes, formatDate } from '../format';
import { loadPdfDocument, renderPdfPage } from '../grid/pdfjs';
import { DateHint, ItemIcon, OwnerCell } from '../presentation';

/** Width (CSS px) each page is rendered at; displayed `w-full` so it scales down to the container. */
const PAGE_WIDTH = 820;

/**
 * Where the viewer fetches a file's bytes + who owns it — so the SAME in-app viewer serves the owner's
 * own drive AND a shared resource (public link or "shared with me"). Defaults to the owner's endpoints;
 * {@link SharedBrowser} passes a source backed by the public/grantee endpoints + the sharer as owner.
 */
export interface PreviewSource {
  /** Resolve a short-lived presigned URL to read the file inline. */
  previewUrl: (itemId: string) => Promise<string>;
  /** Resolve a short-lived presigned URL to download the file. */
  downloadUrl: (itemId: string) => Promise<string>;
  /** Owner shown in the details panel; omitted ⇒ the current user ("you"). */
  owner?: { name: string; avatarUrl: string | null };
}

interface PdfPreviewContextValue {
  /** The file currently open in the viewer, or `null`. */
  item: ItemDto | null;
  /** Open the in-app viewer for a file (folders are ignored). An optional source overrides the owner's. */
  open: (item: ItemDto, source?: PreviewSource) => void;
  close: () => void;
}

const PdfPreviewContext = createContext<PdfPreviewContextValue | null>(null);

/**
 * Owns the in-app PDF viewer for the whole app: any list row / grid card / search hit calls
 * `open(item)` (via {@link import('../use-item-actions').useItemActions}) instead of punching out to a
 * browser tab. The viewer + its "Сведения" panel render here, above the routes.
 */
export function PdfPreviewProvider({ children }: { children: ReactNode }) {
  const { getToken } = useAuth();
  const [open, setOpenState] = useState<{ item: ItemDto; source: PreviewSource } | null>(null);

  // The default source reads the caller's OWN drive via the Clerk-scoped item endpoints.
  const ownerSource = useMemo<PreviewSource>(
    () => ({
      previewUrl: async (id) => (await itemsApi.previewUrl(await getToken(), id)).url,
      downloadUrl: async (id) => (await itemsApi.downloadUrl(await getToken(), id)).url,
    }),
    [getToken],
  );

  const openFile = useCallback(
    (item: ItemDto, source?: PreviewSource) => {
      if (item.type === 'FILE') setOpenState({ item, source: source ?? ownerSource });
    },
    [ownerSource],
  );
  const close = useCallback(() => setOpenState(null), []);
  const value = useMemo<PdfPreviewContextValue>(
    () => ({ item: open?.item ?? null, open: openFile, close }),
    [open, openFile, close],
  );

  return (
    <PdfPreviewContext.Provider value={value}>
      {children}
      <Dialog open={open !== null} onOpenChange={(next) => !next && close()}>
        {open && <PreviewSurface item={open.item} source={open.source} onClose={close} />}
      </Dialog>
    </PdfPreviewContext.Provider>
  );
}

export function usePdfPreview(): PdfPreviewContextValue {
  const ctx = useContext(PdfPreviewContext);
  if (!ctx) throw new Error('usePdfPreview must be used within a PdfPreviewProvider');
  return ctx;
}

type DocState =
  | { status: 'loading' }
  | { status: 'ready'; pdf: PDFDocumentProxy; numPages: number }
  | { status: 'error'; message: string };

/** Fetch + parse the PDF for `item`; destroys the document (and cancels a stale load) on change/close. */
function usePdfDocument(
  item: ItemDto,
  source: PreviewSource,
): { doc: DocState; retry: () => void } {
  const t = useTranslations('preview');
  const [state, setState] = useState<DocState>({ status: 'loading' });
  // Bumped to retry the same file after an error.
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    let destroyDoc: (() => void) | undefined;
    setState({ status: 'loading' });
    (async () => {
      try {
        const url = await source.previewUrl(item.id);
        const bytes = await fetch(url).then((res) => {
          if (!res.ok) throw new Error(t('loadFailed', { status: res.status }));
          return res.arrayBuffer();
        });
        const { pdf, destroy } = await loadPdfDocument(bytes);
        destroyDoc = destroy;
        if (alive) setState({ status: 'ready', pdf, numPages: pdf.numPages });
        else destroy();
      } catch (err) {
        if (alive) setState({ status: 'error', message: errorMessage(err, t('openFailed')) });
      }
    })();
    return () => {
      alive = false;
      destroyDoc?.();
    };
  }, [item.id, source, attempt, t]);

  return { doc: state, retry };
}

/** The full-screen viewer surface — toolbar, scrollable page column, and the details panel. */
function PreviewSurface({
  item,
  source,
  onClose,
}: {
  item: ItemDto;
  source: PreviewSource;
  onClose: () => void;
}) {
  const { doc, retry } = usePdfDocument(item, source);
  const t = useTranslations('preview');
  const [showDetails, setShowDetails] = useState(true);

  const onDownload = () =>
    source
      .downloadUrl(item.id)
      .then((url) => {
        // Presigned URL carries Content-Disposition: attachment, so an anchor click downloads it.
        const a = document.createElement('a');
        a.href = url;
        a.rel = 'noopener';
        a.target = '_blank';
        a.click();
      })
      .catch((err) => toast.error(errorMessage(err, t('downloadFailed'))));

  return (
    <DialogContent
      showCloseButton={false}
      // Override the centered modal into a full-screen surface.
      className="flex h-[100dvh] w-screen max-w-none flex-col gap-0 rounded-none border-0 bg-background p-0 ring-0 sm:max-w-none"
    >
      <DialogDescription className="sr-only">{t('previewPdf')}</DialogDescription>

      {/* Toolbar */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <ItemIcon item={item} className="size-5 shrink-0" />
        <DialogTitle className="min-w-0 truncate font-medium text-sm">{item.name}</DialogTitle>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {doc.status === 'ready' && (
            <span className="mr-1 hidden text-muted-foreground text-sm sm:inline">
              {t('pagesShort', { count: doc.numPages })}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('details')}
            aria-pressed={showDetails}
            className={cn(showDetails && 'bg-accent text-accent-foreground')}
            onClick={() => setShowDetails((v) => !v)}
          >
            <Info />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={t('download')} onClick={onDownload}>
            <Download />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={t('close')} onClick={onClose}>
            <X />
          </Button>
        </div>
      </div>

      {/* Body: page column + details panel */}
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-auto bg-muted/40 px-4 py-6">
          {doc.status === 'loading' ? (
            <PageColumnState>
              <RefreshCw className="size-5 animate-spin text-muted-foreground" />
              <span>{t('loading')}</span>
            </PageColumnState>
          ) : doc.status === 'error' ? (
            <PageColumnState>
              <span>{doc.message}</span>
              <Button variant="outline" size="sm" onClick={retry}>
                <RefreshCw />
                {t('retry')}
              </Button>
            </PageColumnState>
          ) : (
            <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4">
              {Array.from({ length: doc.numPages }, (_, i) => (
                <PdfPage key={i} pdf={doc.pdf} pageNumber={i + 1} />
              ))}
            </div>
          )}
        </div>

        {showDetails && <DetailsPanel item={item} doc={doc} owner={source.owner} />}
      </div>
    </DialogContent>
  );
}

/** Centered status line for the page column (loading / error). */
function PageColumnState({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground text-sm">
      {children}
    </div>
  );
}

/**
 * One rendered page. Rendering starts only once the placeholder scrolls near the viewport (so a big
 * PDF doesn't rasterize every page at once); the reserved height keeps the scroll position stable.
 */
function PdfPage({ pdf, pageNumber }: { pdf: PDFDocumentProxy; pageNumber: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shouldRender, setShouldRender] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShouldRender(true);
          io.disconnect();
        }
      },
      { rootMargin: '1000px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!shouldRender) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let alive = true;
    renderPdfPage(pdf, pageNumber, canvas, PAGE_WIDTH)
      .then(() => alive && setDone(true))
      .catch(() => alive && setDone(true));
    return () => {
      alive = false;
    };
  }, [shouldRender, pdf, pageNumber]);

  return (
    <div
      ref={wrapRef}
      className={cn(
        'w-full overflow-hidden rounded-sm shadow-md ring-1 ring-black/5',
        done ? 'bg-white' : 'min-h-[60vh] animate-pulse bg-muted',
      )}
    >
      <canvas ref={canvasRef} className={cn('h-auto w-full', !done && 'invisible')} />
    </div>
  );
}

/** The "Сведения" side panel: type, size, page count, owner, and dates. */
function DetailsPanel({
  item,
  doc,
  owner,
}: {
  item: ItemDto;
  doc: DocState;
  /** The sharer, on a shared file; omitted ⇒ the current user owns it. */
  owner?: { name: string; avatarUrl: string | null };
}) {
  const t = useTranslations('preview');
  const locale = useLocale();
  return (
    <aside className="hidden w-72 shrink-0 flex-col gap-5 overflow-auto border-l p-5 sm:flex">
      <div className="flex items-center gap-2">
        <ItemIcon item={item} className="size-5 shrink-0" />
        <h2 className="min-w-0 truncate font-medium text-sm">{item.name}</h2>
      </div>
      <dl className="flex flex-col gap-4">
        <Detail label={t('type')} value="PDF" />
        <Detail label={t('size')} value={formatBytes(item.sizeBytes, locale)} />
        {doc.status === 'ready' && <Detail label={t('pages')} value={String(doc.numPages)} />}
        <Detail label={t('owner')}>
          {owner ? (
            <span className="flex min-w-0 items-center gap-2">
              <Avatar className="size-6 shrink-0">
                {owner.avatarUrl && <AvatarImage src={owner.avatarUrl} alt="" />}
                <AvatarFallback className="text-[10px]">{getInitials(owner.name)}</AvatarFallback>
              </Avatar>
              <span className="truncate text-muted-foreground text-sm">{owner.name}</span>
            </span>
          ) : (
            <OwnerCell />
          )}
        </Detail>
        <Detail label={t('createdAt')}>
          <DateHint iso={item.createdAt}>{formatDate(item.createdAt, locale)}</DateHint>
        </Detail>
        <Detail label={t('updatedAt')}>
          <DateHint iso={item.updatedAt}>{formatDate(item.updatedAt, locale)}</DateHint>
        </Detail>
      </dl>
    </aside>
  );
}

/** A single label/value row in the details panel. */
function Detail({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm">{children ?? value}</dd>
    </div>
  );
}
