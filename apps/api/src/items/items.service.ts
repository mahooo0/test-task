import { Injectable } from '@nestjs/common';
import { Prisma, type Item } from '@prisma/client';
import type {
  BreadcrumbDto,
  ContentUrlDto,
  ItemDto,
  ItemSortField,
  Paginated,
  SortDirection,
  SubtreeStatsDto,
  UploadTicketDto,
} from '@dataroom/types';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import { StorageService } from '../storage/storage.service';
import { type ItemCursor, decodeCursor, encodeCursor } from './items.cursor';
import type { PresignUploadDto } from './dto/presign-upload.dto';
import { toItemDto, type ItemSource } from './items.mapper';

/** How many times to retry name allocation when a concurrent create wins the P2002 race. */
const MAX_NAME_ATTEMPTS = 5;

/** Uploads are PDF-only (this is a due-diligence Data Room). */
const ALLOWED_MIME = 'application/pdf';

/**
 * Upload size cap. Checked at presign against the client-reported size; finalize
 * re-reads the true size from R2 and never trusts the client.
 */
const MAX_UPLOAD_MB = 100;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/** How long a trashed item survives before it's permanently purged (Google-Drive-style). */
const TRASH_RETENTION_DAYS = 30;
const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;

@Injectable()
export class ItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Lists one folder level with keyset pagination. Folders always group first (`type ASC`); the
   * chosen `sort` field then orders within each group in `dir`, tie-broken by `id`. The cursor is
   * the full `(type, sortVal, id)` position (+ the sort context) so paging is stable under writes
   * and correct across the folder→file boundary in every order. `name` reads straight off the
   * `(dataRoomId, parentId, type, name)` index; `modified`/`size` sort the single (already
   * parent-filtered, hence small) level — no cross-folder scan.
   */
  async listChildren(
    ownerId: string,
    parentId: string | null,
    rawCursor: string | null,
    limit: number,
    sort: ItemSortField = 'name',
    dir: SortDirection = 'asc',
  ): Promise<Paginated<ItemDto>> {
    const dataRoomId = await this.getRoomId(ownerId);
    return this.listChildrenInRoom(
      dataRoomId,
      parentId,
      rawCursor,
      limit,
      sort,
      dir,
    );
  }

  /**
   * Room-scoped variant of {@link listChildren} — the caller has already resolved (and authorized)
   * the room. Used by the owner path (after `getRoomId`) and the shared-read path (after resolving a
   * share to its room + verifying the parent is in scope). No ownership check lives here.
   */
  async listChildrenInRoom(
    dataRoomId: string,
    parentId: string | null,
    rawCursor: string | null,
    limit: number,
    sort: ItemSortField = 'name',
    dir: SortDirection = 'asc',
  ): Promise<Paginated<ItemDto>> {
    if (parentId !== null) {
      await this.getActiveFolderOrThrow(dataRoomId, parentId);
    }

    const cursor = rawCursor ? decodeCursor(rawCursor) : null;
    if (cursor && (cursor.sort !== sort || cursor.dir !== dir)) {
      throw new AppException('cursor.mismatchedSort');
    }

    // `type ASC` stays the leading key (folders first); the chosen column + `id` tiebreak carry the
    // direction. The keyset predicate mirrors that: past the whole type group, or — within the same
    // type — strictly beyond the cursor's `(sortVal, id)` in the sort direction.
    const col = SORT_COLUMN[sort];
    const cmp = dir === 'asc' ? Prisma.raw('>') : Prisma.raw('<');
    const order = dir === 'asc' ? Prisma.raw('ASC') : Prisma.raw('DESC');
    const keyset = cursor
      ? Prisma.sql`AND (
          type > ${cursor.type}::"ItemType"
          OR (type = ${cursor.type}::"ItemType"
              AND (${col}, id) ${cmp} (${sortValueBinding(sort, cursor.sortVal)}, ${cursor.id}))
        )`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<ItemSource[]>(Prisma.sql`
      SELECT id, "dataRoomId", "parentId", type, name, "sizeBytes", "mimeType", "starred", "createdAt", "updatedAt",
        -- Does this folder hold a subfolder? Drives the sidebar tree's expand affordance. Computed
        -- for folders only (files are leaves ⇒ false), so the file-heavy drive listing pays nothing.
        CASE WHEN type = 'FOLDER' THEN EXISTS (
          SELECT 1 FROM "items" child
          WHERE child."parentId" = "items".id AND child.type = 'FOLDER' AND child.status = 'ACTIVE'
        ) ELSE false END AS "hasSubfolders"
      FROM "items"
      WHERE "dataRoomId" = ${dataRoomId}
        AND "parentId" IS NOT DISTINCT FROM ${parentId}
        AND status = 'ACTIVE'
        ${keyset}
      ORDER BY type ASC, ${col} ${order}, id ${order}
      LIMIT ${limit + 1}
    `);

    const hasNext = rows.length > limit;
    const page = hasNext ? rows.slice(0, limit) : rows;
    const last = page.at(-1);
    return {
      items: page.map(toItemDto),
      nextCursor:
        hasNext && last ? encodeCursor(rowCursor(sort, dir, last)) : null,
    };
  }

  /**
   * Flat, cross-folder name search for the ⌘K palette. Case-insensitive substring match over every
   * ACTIVE item in the caller's room; LIKE metacharacters in the term are escaped (paired with the
   * `ESCAPE '\'` clause) so `%`/`_` typed by the user match literally. Folders group first, then name
   * — the top `limit` only. This is a quick-jump list, not a paginated view.
   */
  async searchItems(
    ownerId: string,
    rawQuery: string,
    limit: number,
  ): Promise<ItemDto[]> {
    const query = rawQuery.trim();
    const dataRoomId = await this.getRoomId(ownerId);
    // Empty term ⇒ no name predicate, so the whole room comes back (name-ordered) for filter-only
    // browsing; a term adds a case-insensitive substring match (LIKE metacharacters escaped).
    const nameFilter =
      query.length > 0
        ? Prisma.sql`AND name ILIKE ${`%${escapeLike(query)}%`} ESCAPE '\\'`
        : Prisma.empty;
    const rows = await this.prisma.$queryRaw<ItemSource[]>(Prisma.sql`
      SELECT id, "dataRoomId", "parentId", type, name, "sizeBytes", "mimeType", "starred", "createdAt", "updatedAt"
      FROM "items"
      WHERE "dataRoomId" = ${dataRoomId}
        AND status = 'ACTIVE'
        ${nameFilter}
      ORDER BY type ASC, name ASC, id ASC
      LIMIT ${limit}
    `);
    return rows.map(toItemDto);
  }

  /** The "Помеченные" view — every ACTIVE starred item in the room, folders first then name. */
  async listStarred(ownerId: string): Promise<ItemDto[]> {
    const dataRoomId = await this.getRoomId(ownerId);
    const rows = await this.prisma.$queryRaw<ItemSource[]>(Prisma.sql`
      SELECT id, "dataRoomId", "parentId", type, name, "sizeBytes", "mimeType", "starred", "createdAt", "updatedAt"
      FROM "items"
      WHERE "dataRoomId" = ${dataRoomId}
        AND status = 'ACTIVE'
        AND starred = true
      ORDER BY type ASC, name ASC, id ASC
    `);
    return rows.map(toItemDto);
  }

  /**
   * Creates a folder. `onConflict` decides what happens when the name already belongs to an ACTIVE
   * sibling:
   *  - `'error'` (default, the "New folder" action): reject with 409 so the UI can say the name is
   *    taken — the user picks a different one rather than getting a silent `Reports (1)`.
   *  - `'suffix'` (folder uploads): auto-suffix (`Reports (1)`) so a clashing upload never fails.
   */
  async createFolder(
    ownerId: string,
    parentId: string | null,
    name: string,
    onConflict: 'error' | 'suffix' = 'error',
  ): Promise<ItemDto> {
    const dataRoomId = await this.getRoomId(ownerId);
    if (parentId !== null) {
      await this.getActiveFolderOrThrow(dataRoomId, parentId);
    }
    const desired = name.trim();

    const insert = (finalName: string) =>
      this.prisma.item.create({
        data: {
          dataRoomId,
          parentId,
          type: 'FOLDER',
          status: 'ACTIVE',
          name: finalName,
          uploadedById: ownerId,
        },
      });
    const isUniqueViolation = (err: unknown) =>
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002';

    if (onConflict === 'error') {
      const clash = await this.prisma.item.findFirst({
        where: { dataRoomId, parentId, name: desired, status: 'ACTIVE' },
        select: { id: true },
      });
      if (clash) throw new AppException('items.nameConflict');
      try {
        return toItemDto(await insert(desired));
      } catch (err) {
        // Lost a concurrent same-name race — the partial unique index rejected the insert.
        if (isUniqueViolation(err))
          throw new AppException('items.nameConflict');
        throw err;
      }
    }

    // onConflict === 'suffix' — auto-suffix on a clash, retrying if a race grabs the suffix first.
    for (let attempt = 0; attempt < MAX_NAME_ATTEMPTS; attempt++) {
      const finalName = await this.resolveName(dataRoomId, parentId, desired, {
        isFile: false,
      });
      try {
        return toItemDto(await insert(finalName));
      } catch (err) {
        if (isUniqueViolation(err)) continue;
        throw err;
      }
    }
    throw new AppException('items.folderNameExhausted');
  }

  async getItem(ownerId: string, itemId: string): Promise<ItemDto> {
    const dataRoomId = await this.getRoomId(ownerId);
    return this.getItemInRoom(dataRoomId, itemId);
  }

  /** Room-scoped {@link getItem} — ownership already resolved by the caller. */
  async getItemInRoom(dataRoomId: string, itemId: string): Promise<ItemDto> {
    return toItemDto(await this.findActiveItemOrThrow(dataRoomId, itemId));
  }

  /** Ancestor trail from the room root down to (and including) the item. */
  async getBreadcrumb(
    ownerId: string,
    itemId: string,
  ): Promise<BreadcrumbDto[]> {
    const dataRoomId = await this.getRoomId(ownerId);
    return this.getBreadcrumbInRoom(dataRoomId, itemId);
  }

  /** Room-scoped {@link getBreadcrumb} — ownership already resolved by the caller. */
  async getBreadcrumbInRoom(
    dataRoomId: string,
    itemId: string,
  ): Promise<BreadcrumbDto[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{ id: string; name: string }>
    >(Prisma.sql`
      WITH RECURSIVE chain AS (
        SELECT id, "parentId", name, 0 AS depth
        FROM "items"
        WHERE id = ${itemId} AND "dataRoomId" = ${dataRoomId} AND status = 'ACTIVE'
        UNION ALL
        SELECT p.id, p."parentId", p.name, c.depth + 1
        FROM "items" p JOIN chain c ON p.id = c."parentId"
        WHERE p.status = 'ACTIVE'
      )
      SELECT id, name FROM chain ORDER BY depth DESC
    `);
    if (rows.length === 0) {
      throw new AppException('items.notFound');
    }
    return rows.map((r) => ({ id: r.id, name: r.name }));
  }

  /** Subtree size + counts for an item (its contents), via one recursive CTE. */
  async getStats(ownerId: string, itemId: string): Promise<SubtreeStatsDto> {
    const dataRoomId = await this.getRoomId(ownerId);
    await this.findActiveItemOrThrow(dataRoomId, itemId);
    return this.computeSubtreeStats(dataRoomId, itemId);
  }

  /** Rename and/or move. Rejects a name clash with `409 + suggestedName` for the UI. */
  async updateItem(
    ownerId: string,
    itemId: string,
    changes: { name?: string; parentId?: string | null; starred?: boolean },
  ): Promise<ItemDto> {
    const dataRoomId = await this.getRoomId(ownerId);
    const item = await this.findActiveItemOrThrow(dataRoomId, itemId);

    const trimmed = changes.name?.trim();
    const newName = trimmed && trimmed.length > 0 ? trimmed : item.name;
    const moving =
      changes.parentId !== undefined && changes.parentId !== item.parentId;
    const targetParentId =
      changes.parentId !== undefined ? changes.parentId : item.parentId;

    if (moving && targetParentId !== null) {
      await this.getActiveFolderOrThrow(dataRoomId, targetParentId);
      if (
        item.type === 'FOLDER' &&
        (targetParentId === item.id ||
          (await this.isSubtreeDescendant(item.id, targetParentId)))
      ) {
        throw new AppException('items.moveIntoSelf');
      }
    }

    if (newName !== item.name || moving) {
      const clash = await this.prisma.item.findFirst({
        where: {
          dataRoomId,
          parentId: targetParentId,
          name: newName,
          status: 'ACTIVE',
          id: { not: item.id },
        },
        select: { id: true },
      });
      if (clash) {
        throw await this.nameConflict(
          dataRoomId,
          targetParentId,
          newName,
          item.id,
          item.type === 'FILE',
        );
      }
    }

    try {
      const updated = await this.prisma.item.update({
        where: { id: item.id },
        data: {
          name: newName,
          parentId: targetParentId,
          ...(changes.starred !== undefined
            ? { starred: changes.starred }
            : {}),
        },
      });
      return toItemDto(updated);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw await this.nameConflict(
          dataRoomId,
          targetParentId,
          newName,
          item.id,
          item.type === 'FILE',
        );
      }
      throw err;
    }
  }

  /**
   * Move an item to the Trash — soft-deletes its whole subtree (status → TRASHED). Blobs are kept
   * so a restore is lossless; only the ACTIVE-only read paths need no change, since a TRASHED row
   * is invisible to all of them. Only ACTIVE rows are touched, so a descendant trashed separately
   * (earlier) keeps its own `deletedAt` and won't be swept back up when this item is restored.
   */
  async trashItem(ownerId: string, itemId: string): Promise<void> {
    const dataRoomId = await this.getRoomId(ownerId);
    await this.purgeExpiredTrash(dataRoomId);
    const item = await this.prisma.item.findFirst({
      where: { id: itemId, dataRoomId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!item) {
      throw new AppException('items.notFound');
    }
    const now = new Date();
    await this.prisma.$executeRaw(Prisma.sql`
      WITH RECURSIVE sub AS (
        SELECT id FROM "items" WHERE id = ${item.id}
        UNION ALL
        SELECT i.id FROM "items" i JOIN sub ON i."parentId" = sub.id
      )
      UPDATE "items"
        SET status = 'TRASHED', "deletedAt" = ${now}, "updatedAt" = ${now}
        WHERE id IN (SELECT id FROM sub) AND status = 'ACTIVE'
    `);
  }

  /**
   * Restore a trashed item and its whole (still-trashed) subtree back to ACTIVE. Renames the restored
   * root if an ACTIVE sibling now holds its name (the partial unique index is ACTIVE-only, so a clash
   * is possible after something new took the name while this sat in the Trash).
   */
  async restoreItem(ownerId: string, itemId: string): Promise<ItemDto> {
    const dataRoomId = await this.getRoomId(ownerId);
    const item = await this.prisma.item.findFirst({
      where: { id: itemId, dataRoomId, status: 'TRASHED' },
      select: { id: true, name: true, parentId: true, type: true },
    });
    if (!item) {
      throw new AppException('trash.notFound');
    }
    const name = await this.resolveName(dataRoomId, item.parentId, item.name, {
      excludeId: item.id,
      isFile: item.type === 'FILE',
    });
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.item.update({ where: { id: item.id }, data: { name } }),
      this.prisma.$executeRaw(Prisma.sql`
        WITH RECURSIVE sub AS (
          SELECT id FROM "items" WHERE id = ${item.id}
          UNION ALL
          SELECT i.id FROM "items" i JOIN sub ON i."parentId" = sub.id
        )
        UPDATE "items"
          SET status = 'ACTIVE', "deletedAt" = NULL, "updatedAt" = ${now}
          WHERE id IN (SELECT id FROM sub) AND status = 'TRASHED'
      `),
    ]);
    const restored = await this.prisma.item.findUniqueOrThrow({
      where: { id: item.id },
    });
    return toItemDto(restored);
  }

  /** The Trash: every trashed *root* (its parent isn't itself trashed), newest-deleted first. */
  async listTrash(ownerId: string): Promise<ItemDto[]> {
    const dataRoomId = await this.getRoomId(ownerId);
    await this.purgeExpiredTrash(dataRoomId);
    const rows = await this.prisma.$queryRaw<ItemSource[]>(Prisma.sql`
      SELECT i.id, i."dataRoomId", i."parentId", i.type, i.name, i."sizeBytes", i."mimeType",
             i."starred", i."createdAt", i."updatedAt", i."deletedAt"
      FROM "items" i
      LEFT JOIN "items" p ON p.id = i."parentId"
      WHERE i."dataRoomId" = ${dataRoomId}
        AND i.status = 'TRASHED'
        AND (i."parentId" IS NULL OR p.status <> 'TRASHED')
      ORDER BY i."deletedAt" DESC, i.id
    `);
    return rows.map(toItemDto);
  }

  /** Permanently delete a trashed item (its whole subtree via the FK) and its R2 blobs — irreversible. */
  async deleteForever(ownerId: string, itemId: string): Promise<void> {
    const dataRoomId = await this.getRoomId(ownerId);
    const item = await this.prisma.item.findFirst({
      where: { id: itemId, dataRoomId, status: 'TRASHED' },
      select: { id: true },
    });
    if (!item) {
      throw new AppException('trash.notFound');
    }
    // Drop every stored blob under this node BEFORE the row delete — a crash then leaves reachable
    // rows to retry, never an orphan blob.
    const keys = await this.collectStorageKeys(item.id);
    await this.storage.deleteObjects(keys);
    await this.prisma.item.delete({ where: { id: item.id } });
  }

  /** Empty the Trash: permanently delete every TRASHED row in the room (and its blobs). */
  async emptyTrash(ownerId: string): Promise<void> {
    const dataRoomId = await this.getRoomId(ownerId);
    const rows = await this.prisma.item.findMany({
      where: { dataRoomId, status: 'TRASHED', storageKey: { not: null } },
      select: { storageKey: true },
    });
    const keys = rows
      .map((r) => r.storageKey)
      .filter((k): k is string => k !== null);
    await this.storage.deleteObjects(keys);
    await this.prisma.item.deleteMany({
      where: { dataRoomId, status: 'TRASHED' },
    });
  }

  /**
   * Permanently drops trashed items older than {@link TRASH_RETENTION_DAYS} (a root + its subtree
   * share one `deletedAt`, so they expire together) plus their R2 blobs. Runs lazily on trash
   * reads/writes — no scheduler needed. The cutoff is passed as an ISO string cast to a naive
   * `timestamp`: `deletedAt` is a naive-UTC column, so it must NOT be compared against a `Date`-bound
   * param / `timestamptz` (that mismatched under the server TZ — see the C2 restore fix).
   */
  private async purgeExpiredTrash(dataRoomId: string): Promise<void> {
    const cutoff = new Date(Date.now() - TRASH_RETENTION_MS).toISOString();
    const rows = await this.prisma.$queryRaw<
      Array<{ storageKey: string }>
    >(Prisma.sql`
      SELECT "storageKey" FROM "items"
      WHERE "dataRoomId" = ${dataRoomId} AND status = 'TRASHED'
        AND "deletedAt" < ${cutoff}::timestamp AND "storageKey" IS NOT NULL
    `);
    if (rows.length > 0) {
      await this.storage.deleteObjects(rows.map((r) => r.storageKey));
    }
    await this.prisma.$executeRaw(Prisma.sql`
      DELETE FROM "items"
      WHERE "dataRoomId" = ${dataRoomId} AND status = 'TRASHED' AND "deletedAt" < ${cutoff}::timestamp
    `);
  }

  /**
   * Aggregates size + item counts over everything nested under `rootId`
   * (`null` ⇒ the whole room). One indexed recursive CTE, no denormalized counters.
   */
  async computeSubtreeStats(
    dataRoomId: string,
    rootId: string | null,
  ): Promise<SubtreeStatsDto> {
    const rows = await this.prisma.$queryRaw<
      Array<{ file_count: bigint; folder_count: bigint; total_bytes: bigint }>
    >(Prisma.sql`
      WITH RECURSIVE subtree AS (
        SELECT id, "parentId", type, "sizeBytes"
        FROM "items"
        WHERE "dataRoomId" = ${dataRoomId}
          AND status = 'ACTIVE'
          AND "parentId" IS NOT DISTINCT FROM ${rootId}
        UNION ALL
        SELECT i.id, i."parentId", i.type, i."sizeBytes"
        FROM "items" i JOIN subtree s ON i."parentId" = s.id
        WHERE i.status = 'ACTIVE'
      )
      SELECT
        COUNT(*) FILTER (WHERE type = 'FILE')                              AS file_count,
        COUNT(*) FILTER (WHERE type = 'FOLDER')                            AS folder_count,
        COALESCE(SUM("sizeBytes") FILTER (WHERE type = 'FILE'), 0)::bigint AS total_bytes
      FROM subtree
    `);
    const row = rows[0];
    return {
      fileCount: Number(row.file_count),
      folderCount: Number(row.folder_count),
      totalSizeBytes: Number(row.total_bytes),
    };
  }

  // ── Uploads (R2 presigned; the API never proxies bytes) ───────────────────────

  /**
   * Step 1 of an upload: validate (PDF + size), reserve the name, create a hidden
   * PENDING file row, and return a presigned PUT URL. N files ⇒ N calls; the client
   * fans them out and a same-name clash auto-suffixes silently (never a mid-batch dialog).
   */
  async presignUpload(
    ownerId: string,
    dto: PresignUploadDto,
  ): Promise<UploadTicketDto> {
    if (!this.storage.isConfigured()) {
      throw new AppException('upload.storageUnavailable');
    }
    if (dto.mimeType.trim().toLowerCase() !== ALLOWED_MIME) {
      throw new AppException('upload.onlyPdf');
    }
    if (dto.sizeBytes > MAX_UPLOAD_BYTES) {
      throw new AppException('upload.tooLarge', {
        params: { maxMb: MAX_UPLOAD_MB },
      });
    }

    const dataRoomId = await this.getRoomId(ownerId);
    const parentId = dto.parentId ?? null;
    if (parentId !== null) {
      await this.getActiveFolderOrThrow(dataRoomId, parentId);
    }
    const desired = dto.name.trim();

    for (let attempt = 0; attempt < MAX_NAME_ATTEMPTS; attempt++) {
      const finalName = await this.resolveName(dataRoomId, parentId, desired, {
        isFile: true,
      });
      let created: Item;
      try {
        created = await this.prisma.item.create({
          data: {
            dataRoomId,
            parentId,
            type: 'FILE',
            status: 'PENDING',
            name: finalName,
            mimeType: ALLOWED_MIME,
            uploadedById: ownerId,
          },
        });
      } catch (err) {
        // Lost a concurrent same-name race — recompute the suffix and retry.
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          continue;
        }
        throw err;
      }

      // Key off the immutable row id: rename/move never touch R2 and keys never collide.
      const storageKey = `rooms/${dataRoomId}/${created.id}/${sanitizeKeySegment(finalName)}`;
      const updated = await this.prisma.item.update({
        where: { id: created.id },
        data: { storageKey },
      });
      const { url, expiresAt } = await this.storage.presignPut(
        storageKey,
        ALLOWED_MIME,
      );
      return {
        item: toItemDto(updated),
        uploadUrl: url,
        storageKey,
        expiresAt,
      };
    }
    throw new AppException('upload.fileNameExhausted');
  }

  /**
   * Step 2 of an upload: the browser confirms the R2 PUT. We HEAD the object for its
   * authoritative size, stamp `uploadedAt`, and flip PENDING→ACTIVE (only now is the
   * file visible). A rare ACTIVE-sibling clash at activation re-resolves the name.
   */
  async finalizeUpload(ownerId: string, itemId: string): Promise<ItemDto> {
    const dataRoomId = await this.getRoomId(ownerId);
    const item = await this.prisma.item.findFirst({
      where: { id: itemId, dataRoomId, type: 'FILE', status: 'PENDING' },
    });
    if (!item || !item.storageKey) {
      throw new AppException('upload.pendingNotFound');
    }

    const size = await this.storage.headContentLength(item.storageKey);
    if (size === null) {
      throw new AppException('upload.notReceived');
    }

    let name = item.name;
    for (let attempt = 0; attempt < MAX_NAME_ATTEMPTS; attempt++) {
      try {
        const finalized = await this.prisma.item.update({
          where: { id: item.id },
          data: {
            name,
            status: 'ACTIVE',
            sizeBytes: BigInt(size),
            uploadedAt: new Date(),
          },
        });
        return toItemDto(finalized);
      } catch (err) {
        // Another file with this name went ACTIVE while we uploaded — re-suffix and retry.
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          name = await this.resolveName(dataRoomId, item.parentId, name, {
            excludeId: item.id,
            isFile: true,
          });
          continue;
        }
        throw err;
      }
    }
    throw new AppException('upload.finalizeNameExhausted');
  }

  /** A short-lived presigned URL to read a file — inline for preview, attachment for download. */
  async getContentUrl(
    ownerId: string,
    itemId: string,
    disposition: 'inline' | 'attachment',
  ): Promise<ContentUrlDto> {
    const dataRoomId = await this.getRoomId(ownerId);
    return this.getContentUrlInRoom(dataRoomId, itemId, disposition);
  }

  /** Room-scoped {@link getContentUrl} — ownership already resolved by the caller. */
  async getContentUrlInRoom(
    dataRoomId: string,
    itemId: string,
    disposition: 'inline' | 'attachment',
  ): Promise<ContentUrlDto> {
    const item = await this.findActiveItemOrThrow(dataRoomId, itemId);
    if (item.type !== 'FILE' || !item.storageKey) {
      throw new AppException('items.onlyFilesDownloadable');
    }
    return this.storage.presignGet(item.storageKey, {
      filename: item.name,
      contentType: item.mimeType ?? ALLOWED_MIME,
      disposition,
    });
  }

  // ── internals ────────────────────────────────────────────────────────────────

  /** The caller owns exactly one room; resolve its id (fail closed if somehow missing). */
  private async getRoomId(ownerId: string): Promise<string> {
    const room = await this.prisma.dataRoom.findUnique({
      where: { ownerId },
      select: { id: true },
    });
    if (!room) {
      throw new AppException('room.notFound');
    }
    return room.id;
  }

  private async findActiveItemOrThrow(
    dataRoomId: string,
    itemId: string,
  ): Promise<Item> {
    const item = await this.prisma.item.findFirst({
      where: { id: itemId, dataRoomId, status: 'ACTIVE' },
    });
    if (!item) {
      throw new AppException('items.notFound');
    }
    return item;
  }

  private async getActiveFolderOrThrow(
    dataRoomId: string,
    folderId: string,
  ): Promise<Item> {
    const folder = await this.prisma.item.findFirst({
      where: { id: folderId, dataRoomId, type: 'FOLDER', status: 'ACTIVE' },
    });
    if (!folder) {
      throw new AppException('items.folderNotFound');
    }
    return folder;
  }

  /**
   * Containment check for shared reads: is `nodeId` the shared root `rootId` itself, or anywhere
   * inside its subtree? Guards against a grantee escaping a shared folder by passing an out-of-scope
   * id (a node in a sibling folder — or another room — is never within the subtree, so this is false).
   */
  async isWithinSubtree(rootId: string, nodeId: string): Promise<boolean> {
    if (rootId === nodeId) return true;
    return this.isSubtreeDescendant(rootId, nodeId);
  }

  /** True if `nodeId` sits anywhere inside `ancestorId`'s subtree (walks parents up). */
  private async isSubtreeDescendant(
    ancestorId: string,
    nodeId: string,
  ): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      WITH RECURSIVE chain AS (
        SELECT id, "parentId" FROM "items" WHERE id = ${nodeId}
        UNION ALL
        SELECT p.id, p."parentId" FROM "items" p JOIN chain c ON p.id = c."parentId"
      )
      SELECT id FROM chain WHERE id = ${ancestorId} LIMIT 1
    `);
    return rows.length > 0;
  }

  /** Every non-null storageKey under `rootId` (inclusive) — PENDING and ACTIVE alike. */
  private async collectStorageKeys(rootId: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<Array<{ storageKey: string }>>(
      Prisma.sql`
        WITH RECURSIVE sub AS (
          SELECT id, "parentId", "storageKey" FROM "items" WHERE id = ${rootId}
          UNION ALL
          SELECT i.id, i."parentId", i."storageKey"
          FROM "items" i JOIN sub ON i."parentId" = sub.id
        )
        SELECT "storageKey" FROM sub WHERE "storageKey" IS NOT NULL
      `,
    );
    return rows.map((r) => r.storageKey);
  }

  /**
   * First free name among ACTIVE siblings (case-sensitive, Drive-style): the desired
   * name if free, else `base (n)` with a file's extension preserved before the suffix.
   */
  private async resolveName(
    dataRoomId: string,
    parentId: string | null,
    desired: string,
    opts: { excludeId?: string; isFile: boolean },
  ): Promise<string> {
    const siblings = await this.prisma.item.findMany({
      where: {
        dataRoomId,
        parentId,
        status: 'ACTIVE',
        ...(opts.excludeId ? { id: { not: opts.excludeId } } : {}),
      },
      select: { name: true },
    });
    const taken = new Set(siblings.map((s) => s.name));
    if (!taken.has(desired)) {
      return desired;
    }
    const { base, ext } = splitName(desired, opts.isFile);
    for (let n = 1; ; n++) {
      const candidate = `${base} (${n})${ext}`;
      if (!taken.has(candidate)) {
        return candidate;
      }
    }
  }

  private async nameConflict(
    dataRoomId: string,
    parentId: string | null,
    name: string,
    excludeId: string,
    isFile: boolean,
  ): Promise<AppException> {
    const suggestedName = await this.resolveName(dataRoomId, parentId, name, {
      excludeId,
      isFile,
    });
    return new AppException('items.nameConflict', {
      details: { suggestedName },
    });
  }
}

/**
 * Splits a file's trailing extension off the base so a dedupe suffix lands before the
 * dot (`report.pdf → report (1).pdf`). Folders (and dotfiles like `.env`) have no
 * extension and suffix at the very end.
 */
function splitName(
  name: string,
  isFile: boolean,
): { base: string; ext: string } {
  if (!isFile) return { base: name, ext: '' };
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return { base: name, ext: '' };
  return { base: name.slice(0, dot), ext: name.slice(dot) };
}

/**
 * Escapes LIKE/ILIKE metacharacters (`\`, `%`, `_`) so a user's search term matches literally — a
 * typed `%` finds a real percent sign, not "anything". Paired with an `ESCAPE '\'` clause in the query.
 */
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** Cosmetic trailing segment of a storageKey — strip forward slashes + control chars. */
function sanitizeKeySegment(name: string): string {
  const cleaned = Array.from(name)
    .map((ch) => (ch === '/' || ch < ' ' ? '_' : ch))
    .join('')
    .trim();
  return cleaned.length > 0 ? cleaned : 'file';
}

/**
 * The sort column expression per field. Fixed fragments (never user text), so `Prisma.raw` is safe.
 * `size` coalesces the nullable `sizeBytes` (folders have none) to 0 so keyset row-value comparisons
 * never hit a NULL — folders then order among themselves by `id` under a size sort.
 */
const SORT_COLUMN: Record<ItemSortField, Prisma.Sql> = {
  name: Prisma.raw('name'),
  modified: Prisma.raw('"updatedAt"'),
  created: Prisma.raw('"createdAt"'),
  size: Prisma.raw('COALESCE("sizeBytes", 0)'),
};

/**
 * Binds a cursor's `sortVal` with the cast that matches its column, so the row-value compare lines
 * up. `updatedAt` is `timestamp WITHOUT time zone` (Prisma's default) — a naive UTC wall-clock — and
 * the cursor is `Date.toISOString()` (UTC + `Z`). We cast to `::timestamp` (NOT `::timestamptz`) so
 * the `Z` is dropped and both sides stay naive-UTC; a `::timestamptz` cast would reinterpret the
 * naive column in the server's local zone and silently mis-order paging (e.g. under Asia/Baku).
 */
function sortValueBinding(
  sort: ItemSortField,
  val: string | number,
): Prisma.Sql {
  switch (sort) {
    case 'name':
      return Prisma.sql`${String(val)}`;
    case 'modified':
    case 'created':
      return Prisma.sql`${String(val)}::timestamp`;
    case 'size':
      return Prisma.sql`${BigInt(val)}::bigint`;
  }
}

/** The keyset cursor for a listing row under the given sort. */
function rowCursor(
  sort: ItemSortField,
  dir: SortDirection,
  row: ItemSource,
): ItemCursor {
  const sortVal =
    sort === 'name'
      ? row.name
      : sort === 'modified'
        ? row.updatedAt.toISOString()
        : sort === 'created'
          ? row.createdAt.toISOString()
          : Number(row.sizeBytes ?? 0);
  return { sort, dir, type: row.type, sortVal, id: row.id };
}
