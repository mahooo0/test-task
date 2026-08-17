/** Client-side upload guards + browser plumbing shared by the uploads engine. */

export const UPLOAD_MIME = 'application/pdf';
export const MAX_UPLOAD_MB = 100;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/** Why a picked file was rejected — a stable code the UI maps to a localized message. */
export type PdfRejectReason = 'not-pdf' | 'empty' | 'too-large';

/** Returns a rejection reason code, or null if the file is an acceptable PDF. */
export function validatePdf(file: File): PdfRejectReason | null {
  const isPdf = file.type === UPLOAD_MIME || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) return 'not-pdf';
  if (file.size === 0) return 'empty';
  if (file.size > MAX_UPLOAD_BYTES) return 'too-large';
  return null;
}

/** Localized failure messages the caller supplies (this module can't call hooks). */
export interface PutErrorText {
  /** Non-2xx response from storage (carries the HTTP status). */
  rejected: (status: number) => string;
  /** Transport-level failure (no response). */
  network: string;
}

/**
 * PUT a file straight to a presigned R2 URL with progress. Uses `XMLHttpRequest`
 * (not `fetch`, which can't report upload progress). The `Content-Type` must match
 * what the server signed. Rejects with an `AbortError` when the signal fires.
 */
export function putWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (percent: number) => void,
  signal: AbortSignal,
  errorText: PutErrorText,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(errorText.rejected(xhr.status)));
    };
    xhr.onerror = () => reject(new Error(errorText.network));
    xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(file);
  });
}

/** A file plus its path relative to the drop/pick root ("Reports/Q1/a.pdf" or "a.pdf"). */
export interface PickedFile {
  file: File;
  relativePath: string;
}

/** Directory portion of a relative path ("Reports/Q1/a.pdf" → "Reports/Q1"; "a.pdf" → ""). */
export function dirOf(relativePath: string): string {
  const slash = relativePath.lastIndexOf('/');
  return slash === -1 ? '' : relativePath.slice(0, slash);
}

/**
 * Every directory that must exist for a batch, each ancestor included, ordered
 * shallowest-first so parents are created before children.
 */
export function orderedDirs(picked: PickedFile[]): string[] {
  const dirs = new Set<string>();
  for (const p of picked) {
    const dir = dirOf(p.relativePath);
    if (!dir) continue;
    const parts = dir.split('/');
    for (let i = 1; i <= parts.length; i++) dirs.add(parts.slice(0, i).join('/'));
  }
  return [...dirs].sort((a, b) => a.split('/').length - b.split('/').length);
}

/** Normalize an `<input>` FileList (directory picks carry `webkitRelativePath`). */
export function pickedFromFileList(list: FileList | null): PickedFile[] {
  if (!list) return [];
  return Array.from(list).map((file) => ({
    file,
    relativePath:
      (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
  }));
}

/** Normalize a drag-drop `DataTransfer`, walking dropped directories recursively. */
export async function pickedFromDataTransfer(dt: DataTransfer): Promise<PickedFile[]> {
  const entries: FileSystemEntry[] = [];
  for (const item of Array.from(dt.items)) {
    if (item.kind !== 'file') continue;
    const entry = item.webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }
  // Browsers without the entries API (or plain file drags) → flat file list.
  if (entries.length === 0) {
    return Array.from(dt.files).map((file) => ({ file, relativePath: file.name }));
  }
  const out: PickedFile[] = [];
  await Promise.all(entries.map((entry) => walkEntry(entry, '', out)));
  return out;
}

function walkEntry(entry: FileSystemEntry, prefix: string, out: PickedFile[]): Promise<void> {
  if (entry.isFile) {
    return new Promise((resolve) => {
      (entry as FileSystemFileEntry).file(
        (file) => {
          out.push({ file, relativePath: prefix + entry.name });
          resolve();
        },
        () => resolve(),
      );
    });
  }
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  const dirPrefix = `${prefix + entry.name}/`;
  const children: FileSystemEntry[] = [];
  return new Promise((resolve) => {
    // readEntries returns in chunks; keep calling until it yields an empty batch.
    const readBatch = () => {
      reader.readEntries(
        (batch) => {
          if (batch.length === 0) {
            void Promise.all(children.map((c) => walkEntry(c, dirPrefix, out))).then(() =>
              resolve(),
            );
          } else {
            children.push(...batch);
            readBatch();
          }
        },
        () => resolve(),
      );
    };
    readBatch();
  });
}
