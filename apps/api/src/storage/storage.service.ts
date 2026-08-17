import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../common/exceptions/app.exception';

/** S3 `DeleteObjects` accepts at most 1000 keys per call. */
const DELETE_BATCH = 1000;

interface PresignedUrl {
  url: string;
  /** ISO timestamp after which the URL is no longer valid. */
  expiresAt: string;
}

/**
 * Thin wrapper over Cloudflare R2 (S3-compatible) used for **presigned transfers only** —
 * the browser PUTs/GETs bytes directly, the API never proxies them. Constructed lazily:
 * if the R2_* env is blank the client is `null` and signing throws `503` (the app still
 * boots and every non-upload route keeps working).
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client | null;
  private readonly bucket: string;
  private readonly expiresIn: number;

  constructor(config: ConfigService) {
    const accountId = config.get<string>('R2_ACCOUNT_ID') ?? '';
    const accessKeyId = config.get<string>('R2_ACCESS_KEY_ID') ?? '';
    const secretAccessKey = config.get<string>('R2_SECRET_ACCESS_KEY') ?? '';
    const endpoint = config.get<string>('R2_ENDPOINT') ?? '';
    this.bucket = config.get<string>('R2_BUCKET') ?? 'dataroom';
    this.expiresIn = config.get<number>('R2_PRESIGN_EXPIRES') ?? 900;

    if (accountId && accessKeyId && secretAccessKey && endpoint) {
      // R2 quirk: region must be the literal "auto".
      this.client = new S3Client({
        region: 'auto',
        endpoint,
        credentials: { accessKeyId, secretAccessKey },
      });
    } else {
      this.client = null;
      this.logger.warn(
        'R2 is not configured (R2_* env is blank) — uploads/downloads will return 503 until credentials are set.',
      );
    }
  }

  /** Whether object storage is wired up (credentials present). */
  isConfigured(): boolean {
    return this.client !== null;
  }

  /** Presigned PUT for a direct browser→R2 upload. The client MUST send this Content-Type. */
  presignPut(key: string, contentType: string): Promise<PresignedUrl> {
    return this.sign(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      }),
    );
  }

  /** Presigned GET that forces the given content type + disposition (inline preview / download). */
  presignGet(
    key: string,
    opts: {
      filename: string;
      contentType: string;
      disposition: 'inline' | 'attachment';
    },
  ): Promise<PresignedUrl> {
    // RFC 5987 filename* keeps non-ASCII names intact across browsers.
    const encoded = encodeURIComponent(opts.filename);
    return this.sign(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentType: opts.contentType,
        ResponseContentDisposition: `${opts.disposition}; filename*=UTF-8''${encoded}`,
      }),
    );
  }

  /**
   * HEAD the object to read its authoritative byte length. Returns `null` if the object
   * isn't there yet (used by finalize to reject an upload that never landed).
   */
  async headContentLength(key: string): Promise<number | null> {
    const client = this.clientOrThrow();
    try {
      const res = await client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return res.ContentLength ?? null;
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }

  /**
   * Best-effort delete of many keys (batched at 1000). No-op when storage is unconfigured
   * or the list is empty — a stranded blob is wasted cost, never a correctness bug.
   */
  async deleteObjects(keys: string[]): Promise<void> {
    if (!this.client || keys.length === 0) return;
    for (let i = 0; i < keys.length; i += DELETE_BATCH) {
      const batch = keys.slice(i, i + DELETE_BATCH);
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
        }),
      );
    }
  }

  private async sign(
    command: PutObjectCommand | GetObjectCommand,
  ): Promise<PresignedUrl> {
    const url = await getSignedUrl(this.clientOrThrow(), command, {
      expiresIn: this.expiresIn,
    });
    return {
      url,
      expiresAt: new Date(Date.now() + this.expiresIn * 1000).toISOString(),
    };
  }

  private clientOrThrow(): S3Client {
    if (!this.client) {
      throw new AppException('upload.storageUnavailable');
    }
    return this.client;
  }
}

/** S3/R2 signal that a key doesn't exist (HeadObject 404 / NotFound / NoSuchKey). */
function isNotFound(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const name = 'name' in err ? (err as { name?: string }).name : undefined;
  if (name === 'NotFound' || name === 'NoSuchKey') return true;
  const status =
    '$metadata' in err
      ? (err as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode
      : undefined;
  return status === 404;
}
