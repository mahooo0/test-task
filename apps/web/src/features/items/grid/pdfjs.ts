/**
 * Client-only pdf.js access: page-1 thumbnails for grid cards ({@link renderFirstPage}) and the
 * full document render for the in-app viewer ({@link loadPdfDocument} + {@link renderPdfPage}).
 *
 * pdf.js touches browser globals at import time, and Next evaluates client
 * modules during SSR — so we never import `pdfjs-dist` at the top level (the
 * `import type` below is erased at build, no runtime import). Instead it's loaded
 * lazily inside {@link getPdfjs}, which also keeps the (large) pdf.js bundle out
 * of everything except these render paths.
 *
 * The worker asset is bundled locally via Turbopack's
 * `new URL(..., import.meta.url)` resolution — no CDN, so it stays within CSP.
 */

// Type-only import — erased at compile time, so it does not pull pdf.js into the top-level bundle.
import type { PDFDocumentProxy } from 'pdfjs-dist';

let workerConfigured = false;

async function getPdfjs() {
  const pdfjs = await import('pdfjs-dist');
  if (!workerConfigured) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString();
    workerConfigured = true;
  }
  return pdfjs;
}

export interface RenderedPage {
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Render page 1 of a PDF (from bytes) to a PNG data URL, fit to `targetWidth`
 * CSS pixels and scaled by the device pixel ratio (capped at 2) for crispness.
 *
 * We hand pdf.js the whole file (`disableRange`/`disableStream`) because the
 * presigned R2 URL is single-use and range-unfriendly (R2 CORS exposes only
 * `ETag`), and fetching up front also sidesteps the 15-minute URL expiry.
 * The input `data` buffer is transferred to the pdf.js worker — do not reuse it.
 */
export async function renderFirstPage(data: ArrayBuffer, targetWidth = 320): Promise<RenderedPage> {
  const pdfjs = await getPdfjs();
  const task = pdfjs.getDocument({ data, disableRange: true, disableStream: true });
  try {
    const pdf = await task.promise;
    const page = await pdf.getPage(1);
    const dpr = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    const unscaled = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: (targetWidth * dpr) / unscaled.width });

    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    // pdf.js v6 derives the 2D context from the canvas itself.
    await page.render({ canvas, viewport }).promise;
    return { dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
  } finally {
    void task.destroy();
  }
}

/**
 * Load a full PDF document from its bytes and keep it open, so the viewer can render any page on
 * demand. The whole file is handed over (`disableRange`/`disableStream`) — same reasons as {@link
 * renderFirstPage}. Call the returned `destroy` when the viewer closes to free the worker document.
 */
export async function loadPdfDocument(
  data: ArrayBuffer,
): Promise<{ pdf: PDFDocumentProxy; destroy: () => void }> {
  const pdfjs = await getPdfjs();
  const task = pdfjs.getDocument({ data, disableRange: true, disableStream: true });
  const pdf = await task.promise;
  return { pdf, destroy: () => void task.destroy() };
}

/**
 * Render one page of an already-loaded document into `canvas`, fit to `cssWidth` CSS px and scaled by
 * the device pixel ratio (capped at 2) so it stays crisp. The canvas keeps its intrinsic bitmap size;
 * display it with `w-full h-auto` to scale responsively.
 */
export async function renderPdfPage(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  cssWidth: number,
): Promise<void> {
  const page = await pdf.getPage(pageNumber);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const unscaled = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: (cssWidth * dpr) / unscaled.width });
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvas, viewport }).promise;
}
