'use client';

import { useAuth } from '@clerk/nextjs';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
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
import posthog from 'posthog-js';
import { ApiError } from '@/lib/api-client';
import { itemsApi } from '../api';
import { invalidateDrive } from '../hooks';
import {
  dirOf,
  MAX_UPLOAD_MB,
  orderedDirs,
  type PickedFile,
  putWithProgress,
  UPLOAD_MIME,
  validatePdf,
} from './upload-helpers';

/** How many files transfer to R2 at once (the rest wait in the queue). */
const CONCURRENCY = 3;

export type UploadState = 'queued' | 'uploading' | 'done' | 'error' | 'canceled';

export interface UploadTask {
  id: string;
  name: string;
  /** Path relative to the drop/pick root — shows the folder for folder uploads. */
  relativePath: string;
  size: number;
  state: UploadState;
  progress: number;
  error?: string;
}

/** A file ready to transfer, with its already-resolved destination folder. */
interface Job {
  taskId: string;
  file: File;
  parentId: string | null;
}

interface UploadsContextValue {
  tasks: UploadTask[];
  enqueue: (picked: PickedFile[], rootParentId: string | null) => void;
  cancel: (id: string) => void;
  retry: (id: string) => void;
  remove: (id: string) => void;
  dismissAll: () => void;
}

const UploadsContext = createContext<UploadsContextValue | null>(null);

function messageFor(err: unknown, fallback: string): string {
  if (err instanceof ApiError || err instanceof Error) return err.message;
  return fallback;
}

/**
 * Owns the upload queue for the whole app (mounted above the routes, so transfers
 * survive folder navigation). Exposes `enqueue` + per-task controls; the button,
 * drop overlay, and progress panel all read from here.
 */
export function UploadsProvider({ children }: { children: ReactNode }) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const t = useTranslations('uploads');

  const [tasks, setTasks] = useState<UploadTask[]>([]);

  const queueRef = useRef<Job[]>([]);
  const activeRef = useRef(0);
  const controllers = useRef(new Map<string, AbortController>());
  const pendingItemId = useRef(new Map<string, string>());
  // Per-task Retry action. It re-runs whichever phase failed: pushing the transfer job (upload phase),
  // or the full pipeline incl. directory creation (folder phase) — see `startTransfers`.
  const retryInputs = useRef(new Map<string, () => void>());
  const pumpRef = useRef<() => void>(() => {});
  const startTransfersRef = useRef<
    (entries: { p: PickedFile; taskId: string }[], rootParentId: string | null) => void
  >(() => {});

  const patch = useCallback((id: string, changes: Partial<UploadTask>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...changes } : t)));
  }, []);

  const requireToken = useCallback(async (): Promise<string> => {
    const token = await getToken();
    if (!token) throw new Error(t('sessionExpired'));
    return token;
  }, [getToken, t]);

  const runJob = useCallback(
    async (job: Job) => {
      const { taskId, file } = job;
      patch(taskId, { state: 'uploading', progress: 0, error: undefined });
      const controller = new AbortController();
      controllers.current.set(taskId, controller);
      try {
        const ticket = await itemsApi.presignUpload(await requireToken(), {
          parentId: job.parentId,
          name: file.name,
          sizeBytes: file.size,
          mimeType: UPLOAD_MIME,
        });
        pendingItemId.current.set(taskId, ticket.item.id);
        await putWithProgress(
          ticket.uploadUrl,
          file,
          UPLOAD_MIME,
          (p) => patch(taskId, { progress: p }),
          controller.signal,
          {
            rejected: (status) => t('storageRejected', { status }),
            network: t('networkError'),
          },
        );
        await itemsApi.finalizeUpload(await requireToken(), ticket.item.id);
        patch(taskId, { state: 'done', progress: 100 });
        posthog.capture('file_upload_completed', { file_size_bytes: file.size });
        invalidateDrive(queryClient);
      } catch (err) {
        const aborted = err instanceof DOMException && err.name === 'AbortError';
        patch(
          taskId,
          aborted
            ? { state: 'canceled' }
            : { state: 'error', error: messageFor(err, t('uploadFailed')) },
        );
        // Best-effort: drop the hidden PENDING row (invisible to listings; keeps R2 tidy).
        const pendingId = pendingItemId.current.get(taskId);
        if (pendingId) {
          void requireToken()
            .then((t) => itemsApi.deleteItem(t, pendingId))
            .catch(() => undefined);
        }
      } finally {
        controllers.current.delete(taskId);
        pendingItemId.current.delete(taskId);
        activeRef.current -= 1;
        pumpRef.current();
      }
    },
    [patch, requireToken, queryClient, t],
  );

  const pump = useCallback(() => {
    while (activeRef.current < CONCURRENCY && queueRef.current.length > 0) {
      const job = queueRef.current.shift();
      if (!job) break;
      activeRef.current += 1;
      void runJob(job);
    }
  }, [runJob]);

  useEffect(() => {
    pumpRef.current = pump;
  }, [pump]);

  // Recreate the picked directory tree, then queue the transfers. Split out from `enqueue` so Retry
  // can re-run it for a single file after a folder-phase failure (a failure there leaves no job to
  // re-push, so retrying must redo the directory creation too).
  const startTransfers = useCallback(
    async (entries: { p: PickedFile; taskId: string }[], rootParentId: string | null) => {
      // Recreate the picked directory tree (parents first); a failure errors its files.
      const dirToId = new Map<string, string | null>([['', rootParentId]]);
      try {
        for (const dir of orderedDirs(entries.map((e) => e.p))) {
          const parts = dir.split('/');
          const parentId = dirToId.get(parts.slice(0, -1).join('/')) ?? rootParentId;
          // Uploads auto-suffix on a name clash (`Docs (1)`) so a folder upload never fails —
          // unlike the "New folder" action, which rejects duplicates.
          const folder = await itemsApi.createFolder(
            await requireToken(),
            parentId,
            parts[parts.length - 1],
            'suffix',
          );
          dirToId.set(dir, folder.id);
        }
      } catch (err) {
        // Folder phase failed: error the files, and wire Retry to rerun the whole pipeline per file.
        for (const entry of entries) {
          patch(entry.taskId, { state: 'error', error: messageFor(err, t('uploadFailed')) });
          retryInputs.current.set(entry.taskId, () =>
            startTransfersRef.current([entry], rootParentId),
          );
        }
        return;
      }
      invalidateDrive(queryClient); // new folders are visible immediately

      for (const { p, taskId } of entries) {
        const parentId = dirToId.get(dirOf(p.relativePath)) ?? rootParentId;
        const job: Job = { taskId, file: p.file, parentId };
        // Upload-phase Retry just re-queues the (already-created) transfer.
        retryInputs.current.set(taskId, () => {
          queueRef.current.push(job);
          pumpRef.current();
        });
        queueRef.current.push(job);
      }
      pumpRef.current();
    },
    [patch, requireToken, queryClient, t],
  );

  useEffect(() => {
    startTransfersRef.current = startTransfers;
  }, [startTransfers]);

  const enqueue = useCallback(
    (picked: PickedFile[], rootParentId: string | null) => {
      if (picked.length === 0) return;
      const entries = picked.map((p) => ({
        p,
        taskId: crypto.randomUUID(),
        reason: validatePdf(p.file),
      }));

      setTasks((prev) => [
        ...prev,
        ...entries.map(({ p, taskId, reason }): UploadTask => ({
          id: taskId,
          name: p.file.name,
          relativePath: p.relativePath,
          size: p.file.size,
          state: reason ? 'error' : 'queued',
          progress: 0,
          // `validatePdf` returns a stable reason key ('not-pdf' | 'empty' | 'too-large') —
          // localize it here (the size cap is interpolated for 'too-large').
          error: reason ? t(`reject.${reason}`, { mb: MAX_UPLOAD_MB }) : undefined,
        })),
      ]);

      const valid = entries.filter((e) => !e.reason);
      if (valid.length === 0) return;
      startTransfersRef.current(
        valid.map((e) => ({ p: e.p, taskId: e.taskId })),
        rootParentId,
      );
    },
    [t],
  );

  const cancel = useCallback(
    (id: string) => {
      const controller = controllers.current.get(id);
      if (controller) {
        controller.abort();
        return;
      }
      // Still queued — pull it before it starts.
      queueRef.current = queueRef.current.filter((j) => j.taskId !== id);
      patch(id, { state: 'canceled' });
    },
    [patch],
  );

  const retry = useCallback(
    (id: string) => {
      const run = retryInputs.current.get(id);
      if (!run) return;
      patch(id, { state: 'queued', progress: 0, error: undefined });
      run();
    },
    [patch],
  );

  const remove = useCallback((id: string) => {
    controllers.current.get(id)?.abort();
    queueRef.current = queueRef.current.filter((j) => j.taskId !== id);
    retryInputs.current.delete(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /** Close the panel: abort anything in flight, drop the queue, and forget every task. */
  const dismissAll = useCallback(() => {
    for (const controller of controllers.current.values()) controller.abort();
    queueRef.current = [];
    retryInputs.current.clear();
    setTasks([]);
  }, []);

  const value = useMemo<UploadsContextValue>(
    () => ({ tasks, enqueue, cancel, retry, remove, dismissAll }),
    [tasks, enqueue, cancel, retry, remove, dismissAll],
  );

  return <UploadsContext.Provider value={value}>{children}</UploadsContext.Provider>;
}

export function useUploads(): UploadsContextValue {
  const ctx = useContext(UploadsContext);
  if (!ctx) throw new Error('useUploads must be used within an UploadsProvider');
  return ctx;
}
