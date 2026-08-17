# Data Room — Architecture

The blueprint for a Google-Drive-like app to securely store, organize, and **share** PDF documents. This document is the single source of truth the team implements against, feature by feature.

---

## 1. Overview & Principles

Data Room is a per-user **drive**: each user has exactly **one Data Room** (auto-created on registration / first Google login), holding a tree of **Items** (folders and PDF files). Owners upload, organize, and share; recipients get **read-only** access to a shared node and everything nested under it, via either a public link or a per-email grant.

**Right-sized is the governing constraint.** This is an MVP built by one engineer in a bounded budget and evaluated on (1) UX & functionality, (2) design polish, (3) code quality. Architecture serves those, in that order.

Principles:

- **Boring, idiomatic patterns.** Standard NestJS module-per-domain on the API, standard React Query + react-router on the web. A senior would ship exactly this.
- **No enterprise ceremony.** No CQRS, event sourcing, message queues, microservices, DDD aggregates, or distributed caching. Clean layering and clear module boundaries are the only structural investment.
- **The database and the presigned-URL contract are the two hard edges.** Everything else is replaceable glue.
- **The browser moves file bytes, never the API.** The API issues presigned R2 URLs and owns metadata only.
- **Compute on demand until proven hot.** Subtree stats via a recursive CTE, not denormalized counters. The upgrade path is documented, not built.
- **Fail safe, don't leak.** Unauthorized reads return `404`, not `403`, so private resources never reveal their existence.
- **Design for the two future asks without building them:** the `role` column already carries `EDITOR`, and search/versioning have defined seams — none are implemented now.

> **DECISION — one Data Room per user** (supersedes the multi-room phrasing in the §7 API tables and §8 routes, which are reconciled when the Items feature is built):
> - `DataRoom.ownerId` is **unique**; the room is **auto-created** inside the same transaction as the account (register or first Google login). The app has **no room create/delete surface** — only the drive within it, plus rename.
> - Owner-side item/file paths are **scoped implicitly to the session user's room** and omit `:roomId`: `GET /me/room`, `GET /me/room/stats`, `PATCH /me/room` (rename); `/items`, `POST /folders`, `/uploads/presign`, `/items/:id/*`.
> - Frontend has **no `/rooms` list or switcher**: `/` is the drive root, `/folders/:folderId`, `/files/:fileId`. React Query keys drop the `roomId` argument.
> - The `Share` model is unchanged — a whole-room share is `resourceType = ROOM` with the user's room id; folder/file shares are `resourceType = ITEM`.

---

## 2. Monorepo Layout

pnpm workspaces. Three publishable/consumable units plus tooling.

```
dataroom/
├── apps/
│   ├── api/                     # NestJS 11 + Prisma 6 + PostgreSQL
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   ├── src/                 # see §3
│   │   ├── test/
│   │   └── package.json
│   └── web/                     # Vite + React 19 + TS + Tailwind + shadcn/ui
│       ├── src/                 # see §8
│       ├── index.html
│       └── package.json
├── packages/
│   └── types/                   # @dataroom/types — shared enums + API DTOs
│       ├── src/
│       │   ├── enums.ts         # ItemType, ItemStatus, ShareResourceType, ShareMode, ShareRole
│       │   ├── api.ts           # ApiResponse<T>, ApiSuccess<T>, ApiError, Paginated<T>
│       │   ├── dto.ts           # UserDto, DataRoomDto, ItemDto, BreadcrumbDto, SubtreeStatsDto, …
│       │   └── index.ts
│       └── package.json
├── docker-compose.yml           # local Postgres
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .env.example
└── package.json                 # workspace scripts
```

`@dataroom/types` is the contract seam: the API declares controller return types from it, the web imports the same interfaces. Request-validation DTOs (class-validator) are **not** shared — validation is a server concern.

---

## 3. Backend Architecture (`apps/api`)

Idiomatic NestJS: **thin controllers → services (all business logic, authz, transactions) → `PrismaService`**. No repository layer — for an MVP with one ORM, a repository is pass-through ceremony; Prisma *is* the data-access abstraction. Raw SQL that Prisma can't express (recursive CTEs) lives in small private service methods via `prisma.$queryRaw`. Multi-step writes run in `prisma.$transaction`.

### Module map

| Module | Responsibility | Depends on |
|---|---|---|
| `ConfigModule` (global) | Load + validate env once (Zod), expose typed `AppConfig`. Fails fast on boot. | — |
| `PrismaModule` (global) | Single `PrismaService` (extends `PrismaClient`, connects on init, shutdown hooks). | Config |
| `HealthModule` | `GET /health` liveness + Prisma ping. | Prisma |
| `AuthModule` | Email/password + Google OAuth, JWT into httpOnly cookie, Passport strategies, guards. | Users, Config, Prisma |
| `UsersModule` | User lookup/creation; owns `UserDto` mapping. | Prisma |
| `DataRoomsModule` | Room CRUD, ownership checks, room-root stats. | Prisma, Items |
| `ItemsModule` | Folders + files: create folder, keyset listing, breadcrumb, rename, move, recursive delete, subtree stats, upload presign + finalize, download/preview URLs. Owns tree helpers (ancestor/descendant CTEs). | Prisma, Storage |
| `StorageModule` | R2/S3 wrapper: presign PUT/GET, HEAD, delete, build keys. Never proxies bytes. | Config |
| `SharingModule` | Create/list/revoke shares, manage grants, resolve public-token + granted access, serve read-only shared subtree. | Prisma, Items, DataRooms |
| `AccessControlModule` | `AccessControlService` — the shared read-authz resolver called by owner, public, and restricted read handlers. | Prisma, Items |

`Auth`, `AccessControl`, and the ownership guard are the only cross-module consumers. Tree helpers live in `ItemsModule` and are exported. No circular dependencies.

### Cross-cutting (wired in `main.ts` + `AppModule`)

- **Validation:** global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`. Every body/query is a class-validator DTO.
- **Errors:** one `AllExceptionsFilter` produces the envelope `{ data: null, error: { code, message, details? } }` (§7). Prisma `P2002 → 409`, `P2025 → 404`; unknown → `500` with a generic message (details logged, never leaked).
- **Serialization:** BigInt is converted to `number` **at the mapper boundary** (see below); a `BigIntSerializerInterceptor` is a safety net for raw-query paths only.
- **Logging:** lightweight `LoggingInterceptor` (method, path, status, ms, requestId). Pino in prod, pretty in dev.
- **`main.ts`:** `cookie-parser`, `helmet`, `enableCors({ origin: WEB_ORIGIN, credentials: true })`, global `/api` prefix, `enableShutdownHooks()` for graceful Prisma disconnect on SIGTERM.

### BigInt policy (resolved)

`Item.sizeBytes` is Prisma `BigInt`. We convert to `number` **everywhere on the wire** — `ItemDto.sizeBytes: number | null`, `SubtreeStatsDto.totalSizeBytes: number` — matching the compiled `@dataroom/types` contract the web imports. PDF sizes are far under `Number.MAX_SAFE_INTEGER` (9 PB), so precision is a non-issue. Mappers do the explicit `Number(...)`; the recursive-CTE `SUM` returns `numeric/bigint` and is likewise `Number(...)`-cast in the mapper. **We do not serialize sizes as strings** — that would break `formatBytes`/arithmetic on the client.

### DTO strategy & mapping

- **Request DTOs:** class-validator classes under each module's `dto/`. Never shared.
- **Response DTOs:** interfaces from `@dataroom/types`, declared as controller return types for compile-time contract enforcement.
- **Mapping:** plain `*.mapper.ts` pure functions per module (`toItemDto(item): ItemDto`). Prisma entities never leak past the service boundary.

### `apps/api/src` tree

```
apps/api/src/
├── main.ts
├── app.module.ts
├── config/
│   ├── config.module.ts
│   ├── env.validation.ts            # Zod schema + validate()
│   └── app-config.type.ts
├── common/
│   ├── filters/all-exceptions.filter.ts
│   ├── interceptors/logging.interceptor.ts
│   ├── interceptors/bigint-serializer.interceptor.ts
│   ├── decorators/current-user.decorator.ts
│   ├── guards/{jwt-auth,optional-jwt,owner}.guard.ts
│   └── errors/api-error.ts          # error-code enum + envelope types
├── prisma/
│   ├── prisma.module.ts
│   └── prisma.service.ts
├── health/
│   ├── health.module.ts
│   └── health.controller.ts
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts           # /register /login /logout /me /google /google/callback
│   ├── auth.service.ts
│   ├── strategies/{local,jwt,google}.strategy.ts
│   ├── guards/google-oauth.guard.ts
│   └── dto/{register,login}.dto.ts
├── users/
│   ├── users.module.ts
│   ├── users.service.ts
│   └── users.mapper.ts
├── data-rooms/
│   ├── data-rooms.module.ts
│   ├── data-rooms.controller.ts     # CRUD + /rooms/:id/stats
│   ├── data-rooms.service.ts
│   ├── data-rooms.mapper.ts
│   └── dto/{create-data-room,rename-data-room}.dto.ts
├── items/
│   ├── items.module.ts
│   ├── items.controller.ts          # list, breadcrumb, create-folder, rename/move, delete, stats, presign, finalize, download, preview
│   ├── items.service.ts             # tree logic, recursive CTEs, resolveName
│   ├── items.mapper.ts
│   └── dto/{create-folder,update-item,request-upload,finalize-upload,list-children}.dto.ts
├── storage/
│   ├── storage.module.ts
│   └── storage.service.ts           # presign PUT/GET, HEAD, delete, key builder
├── access-control/
│   ├── access-control.module.ts
│   └── access-control.service.ts    # canRead / (future) canWrite, ancestor-chain resolution
└── sharing/
    ├── sharing.module.ts
    ├── sharing.controller.ts        # manage shares/grants + /shared/:token/* + /me/shared/*
    ├── sharing.service.ts
    ├── sharing.mapper.ts
    └── dto/{create-share,add-grant}.dto.ts
```

---

## 4. Data Model & Scaling

### ERD summary

```
User(id, email!unique, name, passwordHash?, googleId?unique, avatarUrl?, ts)
  └─owns→ DataRoom(id, name, ownerId→User, ts)                     [idx: ownerId]
              └─contains→ Item(id, dataRoomId→DataRoom, parentId?→Item,
                               type: FOLDER|FILE, status: PENDING|ACTIVE,
                               name, sizeBytes?BigInt, mimeType?, storageKey?unique,
                               uploadedAt?, ts)
                               [idx: (dataRoomId,parentId,type,name); (parentId)]
Share(id, ownerId→User, resourceType: ROOM|ITEM, resourceId (polymorphic, no FK),
      mode: PUBLIC|RESTRICTED, role default VIEWER, publicToken?unique, createdAt, revokedAt?)
      [idx: (resourceType,resourceId); (ownerId)]
  └─grants→ ShareGrant(id, shareId→Share, invitedEmail, userId?→User, role default VIEWER)
              [unique(shareId,invitedEmail); idx: userId; idx: invitedEmail]

Cascades (FK): DataRoom→Item cascade; Item→children cascade; Share→ShareGrant cascade;
               User→ShareGrant.userId SetNull.
Enums: ItemType(FOLDER,FILE), ItemStatus(PENDING,ACTIVE),
       ShareResourceType(ROOM,ITEM), ShareMode(PUBLIC,RESTRICTED), ShareRole(VIEWER,EDITOR).
```

**The schema is sufficient as migrated, with three targeted refinements** — the "schema is done" verdict holds *once these land*:

1. **`Item.status: ItemStatus` (PENDING|ACTIVE)** — the one field the two-phase upload flow requires (§6). A row is created `PENDING` before the R2 PUT and flipped to `ACTIVE` on finalize. **Every listing, subtree-stats, and `resolveName` query filters `status = 'ACTIVE'`**, so unconfirmed/failed uploads are never listable and never collide in naming. (`uploadedAt` is also set on finalize, purely informational.) `status` is server-side; it is not part of `ItemDto` (listings only ever return ACTIVE rows).
2. **`@@index([dataRoomId, parentId, type, name])`** on `Item` — serves the folders-first keyset listing as an index range scan with no in-memory sort.
3. **Two partial unique indexes** for name-conflict integrity (raw SQL in the migration; Prisma DSL can't express partial uniqueness):

```sql
-- Non-root siblings unique on (parentId, name), ACTIVE only
CREATE UNIQUE INDEX items_parent_name_uq
  ON "Item" ("parentId", name)
  WHERE "parentId" IS NOT NULL AND status = 'ACTIVE';

-- Root-level siblings: Postgres treats each NULL as distinct, so parentId IS NULL
-- needs its own index scoped by dataRoomId
CREATE UNIQUE INDEX items_room_root_name_uq
  ON "Item" ("dataRoomId", name)
  WHERE "parentId" IS NULL AND status = 'ACTIVE';
```

Case-sensitive to match Drive. We **do not** add closure tables, materialized paths, `ltree`, or rolled-up counters — the CTE is correct at MVP scale.

### (a) Subtree size + item count — recursive CTE, on demand

A folder's subtree is thousands of rows at MVP scale; one indexed CTE returns in a few ms with zero write-path complexity or drift.

```sql
-- :rootId     = folder Item.id to measure  (NULL ⇒ whole room)
-- :dataRoomId = the room (bounds the walk; used for the room-root case)
WITH RECURSIVE subtree AS (
  SELECT id, "parentId", type, "sizeBytes"
  FROM "Item"
  WHERE "dataRoomId" = :dataRoomId
    AND status = 'ACTIVE'
    AND "parentId" IS NOT DISTINCT FROM :rootId   -- NULL-safe: rootId NULL ⇒ room root
  UNION ALL
  SELECT i.id, i."parentId", i.type, i."sizeBytes"
  FROM "Item" i
  JOIN subtree s ON i."parentId" = s.id
  WHERE i.status = 'ACTIVE'
)
SELECT
  COUNT(*) FILTER (WHERE type = 'FILE')                       AS file_count,
  COUNT(*) FILTER (WHERE type = 'FOLDER')                     AS folder_count,
  COALESCE(SUM("sizeBytes") FILTER (WHERE type = 'FILE'), 0)  AS total_bytes
FROM subtree;
```

`IS NOT DISTINCT FROM` handles the NULL root cleanly. Recursion is driven by `Item(parentId)`. The mapper casts `total_bytes` with `Number(...)` into `SubtreeStatsDto.totalSizeBytes: number`.

**Upgrade path (only if reads get hot or subtrees reach millions):** denormalized `sizeBytes`/`itemCount` on FOLDER items, rolled up transactionally by walking `parentId` to the root on every insert/delete/move. Reads become O(1). Deliberately deferred.

### (b) Listing one folder level at 100,000 files — keyset pagination

Offset pagination scans and discards N rows (a deep page walks 90k rows) and skips/duplicates under concurrent inserts. Keyset seeks straight to the cursor via the index and is stable under writes.

Stable order is **folders-first, then name, then id** (names aren't unique across type; `id` gives a total order):

```sql
-- First page: cursor params NULL. Order FOLDER before FILE via (type='FILE') boolean.
SELECT id, type, name, "sizeBytes", "mimeType", "updatedAt"
FROM "Item"
WHERE "dataRoomId" = :dataRoomId
  AND "parentId" IS NOT DISTINCT FROM :parentId
  AND status = 'ACTIVE'
  AND (
    :cursorType IS NULL
    OR (type, name, id) > (:cursorType, :cursorName, :cursorId)   -- keyset seek
  )
ORDER BY (type = 'FILE'), name, id
LIMIT :limit + 1;   -- one extra row ⇒ "has next page"
```

**Cursor = the full sort key `(type, name, id)`** of the last returned row, base64-encoded and opaque to the client. Encoding `type` is required: a `(name, id)`-only cursor is lossy exactly at the folder→file boundary (it would skip or re-emit files whose name sorts before the last folder). The `(limit+1)`th row's presence is the has-next flag; drop it and derive `nextCursor` from the last kept row.

**Index:** `@@index([dataRoomId, parentId, type, name])` (refinement #2) makes this an index range scan — no full-folder sort ever runs.

**What else changes at 100k:**
- **Counts:** never `COUNT(*)` the folder on each page load; expose count via the separate lazily-loaded stats endpoint (CTE, or the denormalized counter from the upgrade path).
- **Search:** filename search moves from `LIKE '%q%'` to a `pg_trgm` GIN index on `name` scoped by `dataRoomId`, keeping cross-room search sub-linear. (Optional extra credit — the `?search=` seam exists now.)

### (c) Viewer/editor per user without remodeling

`role` already sits on both `Share` and `ShareGrant` (`ShareRole`, default `VIEWER`, `EDITOR` reserved). To enable editors later:

1. `canRead` already returns the **effective role** from the matched grant/share.
2. Add `canWrite(principal, target)` running the **same** ancestor-chain resolution, requiring the matched role to be `EDITOR` (owner always writes).
3. Switch mutating routes from `OwnerGuard` to a `RequireWriteGuard` = `owner OR EDITOR-share`.

No new tables, no data migration, no algorithm change — only the final role check flips from "any grant" to "grant with sufficient role." Granting edit is a **data change** (`role = EDITOR` on the grant), not a schema change.

### Polymorphic `Share.resourceId` integrity

No FK (points at `DataRoom.id` or `Item.id` by `resourceType`), so it's a service-layer invariant:

- **On create:** ShareService verifies the target exists, belongs to a room the caller owns, and matches `resourceType`, inside the same transaction as the insert.
- **On resource delete:** the delete transaction soft-revokes affected shares (`revokedAt = now()`) for the deleted node and — for a folder — its whole deleted subtree. This turns "folder deleted while a recipient views it" into a clean gone/revoked state and preserves the audit trail. The read path already treats `revokedAt IS NOT NULL` as no-access, so no extra read logic is needed.

---

## 5. Authorization & Sharing Model

Two principals: an **authenticated user** (JWT from the httpOnly cookie) and an **anonymous public-token holder**. One rule engine, no policy DSL.

### The core rule (READ)

A request may READ a target (DataRoom or Item) if **any** of:

1. **Owner** — authenticated user owning the target's DataRoom (`DataRoom.ownerId === user.id`). Owners get read + write; this is the only path to mutation.
2. **Public link** — a valid `publicToken` whose `Share` is active (`revokedAt IS NULL`, `mode = PUBLIC`) and whose resource is the target **or an ancestor** of it.
3. **Restricted grant** — an authenticated non-owner where an active `Share` (`revokedAt IS NULL`, `mode = RESTRICTED`) on the target **or an ancestor** has a `ShareGrant` matching the user (`userId = user.id` OR `invitedEmail = user.email`).

**Inheritance is resolved by walking ancestors, not descendants.** A share on a room/folder covers its entire subtree; we ask "does an active share this principal can use point at the target or any of its ancestors?" The ancestor chain is bounded by tree depth (single digits), whereas the subtree is unbounded — so ancestor matching turns "is target inside a shared subtree?" into a cheap, index-friendly set-membership test.

### Resolution algorithm (`AccessControlService.canRead(principal, target)`)

Given `principal` (user or public token) and `target` (an Item id or a DataRoom id):

1. **Resolve the ancestor chain + room.** DataRoom target ⇒ chain = `[{ROOM, roomId}]`. Item target ⇒ one recursive CTE up `parentId`:

   ```sql
   WITH RECURSIVE chain AS (
     SELECT id, "parentId", "dataRoomId" FROM "Item" WHERE id = :targetId
     UNION ALL
     SELECT p.id, p."parentId", p."dataRoomId"
     FROM "Item" p JOIN chain c ON p.id = c."parentId"
   )
   SELECT id, "dataRoomId" FROM chain;
   ```
   Yields `itemIds = [target … root]` and `dataRoomId`. Cost: one query, `O(depth)` seeks on `Item(parentId)`.

2. **Owner short-circuit (authenticated only).** Load the room; `ownerId === user.id` ⇒ **ALLOW (OWNER)**. One PK lookup.

3. **Candidate resource set** `C = {(ROOM, dataRoomId)} ∪ {(ITEM, id) : id ∈ itemIds}`.

4. **Active shares covering the chain** — one query on `Share(resourceType, resourceId)`:

   ```sql
   SELECT * FROM "Share"
   WHERE "revokedAt" IS NULL
     AND (("resourceType" = 'ROOM' AND "resourceId" = :roomId)
       OR ("resourceType" = 'ITEM' AND "resourceId" = ANY(:itemIds)));
   ```

5. **Public path.** Principal is a public token ⇒ **ALLOW** iff any returned share has `mode = PUBLIC AND publicToken = :token`.

6. **Restricted path.** Authenticated non-owner ⇒ collect `restrictedShareIds` (mode RESTRICTED) from step 4, then:

   ```sql
   SELECT 1 FROM "ShareGrant"
   WHERE "shareId" = ANY(:restrictedShareIds)
     AND ("userId" = :userId OR "invitedEmail" = :userEmail)
   LIMIT 1;
   ```
   Any row ⇒ **ALLOW (VIEWER)**. Uses `ShareGrant(userId)`/`(invitedEmail)`.

7. Else **DENY** (`404`).

Cost per authorized read: **≤4 short, index-backed queries, independent of subtree size.**

### Guards, decorators, routing model (resolved)

- **`@CurrentUser()`** — extracts the user attached by the JWT layer; `undefined` for anonymous.
- **`OptionalJwtGuard`** — populates `req.user` from a valid cookie but never rejects.
- **`JwtAuthGuard`** — rejects without a valid cookie.
- **`OwnerGuard`** — for **every mutating route** (`POST/PATCH/DELETE` on items/folders/shares). Resolves the target's room and requires `ownerId === user.id`. Mutations never consult shares (only VIEWER exists), keeping write-authz trivially correct.

**The read surface is three scoped endpoint families, all calling the one `AccessControlService`** — this is the reconciliation of the unified-rule engine with the shipped route topology:

| Family | Guard(s) | Scope check |
|---|---|---|
| Owner (`/rooms/:roomId/items`, `/items/:id/*`) | `JwtAuthGuard` + `OwnerGuard` | owner of the room |
| Public (`/shared/:token/*`) | none (token in path) | `AccessControlService` resolves token → active PUBLIC share; every `:itemId` validated to be a **descendant** of the shared resource |
| Restricted (`/me/shared/:shareId/*`) | `JwtAuthGuard` | `AccessControlService` resolves session email → grant on the share; descendant check as above |

`canRead`/descendant-scoping is the shared service the three families invoke; each family maps cleanly to a frontend query-key namespace and never leaks owner routes to recipients. Mutating routes are always `JwtAuthGuard + OwnerGuard`.

### Revocation

Soft delete: `Share.revokedAt = now()`. Every authz query filters `revokedAt IS NULL`, so revocation takes effect on the **next request** — no session invalidation, no cache to bust. Revoking a parent share instantly cuts the whole subtree.

### Deleting a folder while a recipient is viewing it (edge case)

Folder delete cascades; the target ceases to exist and its shares are soft-revoked in the same transaction (§4). The recipient's next API call (list children, breadcrumb, presign) re-runs the descendant/`canRead` check and now fails.

- **Response: `404 Not Found`, never `403`.** A `403` leaks existence; a viewer who lost access must not learn the resource was ever there. Owners of a genuinely-missing resource also get `404`. One shape: `{ error: { code: "NOT_FOUND", … } }`.
- **UI:** React Query surfaces the `404` → a calm empty state ("This item is no longer available or sharing was turned off.") with a link back to the recipient's own space. An in-flight preview using an already-issued presigned URL may finish rendering — acceptable and expected; the **next** navigation is blocked. Presigned URLs are short-lived (~5 min), bounding the window.

---

## 6. File Storage & Upload Flow

Storage is Cloudflare R2 (S3-compatible) via **presigned URLs only**. The browser transfers bytes directly to/from R2; the API mints time-limited URLs and owns the `Item` rows. **The API never proxies file bytes.**

### Consistency model: create row `PENDING` → `ACTIVE`

The `Item` row is created **before** the object lands in R2, in `status = PENDING`, and flipped to `ACTIVE` on client-confirmed finalize. The row is the source of truth we already need for the `storageKey`, naming, and progress, and deriving the key from a committed row id makes keys stable and collision-free. A PENDING row is invisible to listings, stats, and `resolveName` (all filter `status = 'ACTIVE'`), so a failed upload is never user-visible and never a phantom name conflict.

### `storageKey` scheme

```
rooms/{dataRoomId}/{itemId}/{sanitizedOriginalName}
```

Keyed by immutable **item id**, not the mutable display name — rename/move never touch R2, keys never collide, and `storageKey`'s DB unique constraint is satisfied by construction. The trailing name is cosmetic (nice R2 console + download filename), never parsed.

### Upload sequence — per-file presign (multi-file drag-and-drop)

The upload API is **per-file presign + finalize** (this is the single resolved shape; the frontend `getUploadUrl`/`confirmUpload` maps to it exactly):

1. **Drop / select.** Client validates each file locally: `type === "application/pdf"` and size under the cap (100 MB). Non-PDFs are rejected in the UI before any network call. Each accepted file gets its own client row + progress bar.
2. **Presign (one call per file).** `POST /rooms/:roomId/uploads/presign` with `{ parentId, name, sizeBytes, mimeType }`. The server rejects non-PDF (`400`) or oversize (`413`) **before** signing, runs `resolveName` (below), creates a `PENDING` FILE `Item`, and returns `{ item, uploadUrl, storageKey, expiresAt }` (presigned PUT, 15 min). Sending N files = N calls; the client fans them out with a small concurrency limit (3–4 in flight).
3. **Direct PUT to R2.** The client uploads to `uploadUrl` using **`XMLHttpRequest`** (not `fetch`, which has no upload-progress); `xhr.upload.onprogress` drives the per-file bar. `Content-Type: application/pdf` must match what was signed.
4. **Finalize.** On R2 `200`, the client calls `POST /items/:itemId/finalize` (**no body**). The server does a **`HEAD` on the object** to confirm it exists and to read the **authoritative `Content-Length`**, sets `sizeBytes` from R2 (never trusts a client-supplied size), sets `uploadedAt`, and flips `status = ACTIVE`. Only now does the file appear in listings.
5. **Failure / cancel.** A failed/cancelled PUT ⇒ best-effort `DELETE /items/:itemId` to drop the PENDING row. Any PENDING row not finalized within ~1 h is reaped by a **scheduled sweeper** that deletes the row and issues an R2 delete on its key. This is the sole cleanup mechanism and it guarantees **no orphan rows**. (We do **not** build R2-key-scanning orphan-blob reconciliation — a stranded blob is wasted cost, never a correctness bug; deferred to future work.)

**Intra-batch same-name collisions** are serialized by the partial unique index + retry: `resolveName` runs inside the presign transaction reading ACTIVE siblings, and on the rare `P2002` race the server retries with the next suffix. So dragging `a.pdf, a.pdf` yields `a.pdf` and `a (1).pdf` deterministically without a batch endpoint.

### Name-conflict contract (resolved — split by operation)

`resolveName(parentId, desiredName)`: split `base`+`.pdf` ext (folders have none); read ACTIVE sibling names in `parentId` (case-sensitive); if free use it, else lowest `n ≥ 1` with `"{base} ({n}){ext}"` free (`report.pdf → report (1).pdf → report (2).pdf`).

- **Upload → auto-resolve silently.** Multi-file drag-drop must not throw N dialogs. Presign applies `resolveName` and returns the final name in `ItemDto`. The client displays whatever came back.
- **Rename / move → reject for user choice.** `PATCH /items/:itemId` returns `409` with `error.details.suggestedName` (e.g. `"report (1).pdf"`) so the UI offers keep-both / replace. This is also the seam for optional versioning.

Rename and move are metadata-only `UPDATE`s — never touch R2.

### Move

Sets `parentId` to a target folder in the **same** room; `storageKey` and blob are untouched. Validation: destination must be a FOLDER in the same `dataRoomId`; a folder may not move **into its own subtree** (walk parent pointers up from the destination and reject if the moved folder's id appears). On a name collision in the destination, return `409 + suggestedName` (same contract as rename).

### Download / preview (PDF)

1. `GET /items/:itemId/download` (attachment) or `/preview` (inline) → presigned GET, ~5 min. Read-authorized via the appropriate family (owner / `/shared/:token/...` / `/me/shared/:shareId/...`).
2. Signed with response overrides `ResponseContentType=application/pdf` and `ResponseContentDisposition=inline|attachment; filename="…"`, so preview renders in-tab and download forces a save.
3. Rendered in an `<iframe>`/`<object>` (native browser PDF viewer, zero extra deps). Swappable for `pdf.js` behind the same URL later.
4. URLs are fetched lazily on open and re-fetched on expiry — never embedded in list responses.

### Delete + blob cleanup

**Single file:** delete the R2 object first (`DeleteObject`, idempotent), then delete the row. If R2 delete fails, abort and surface an error rather than leave a dangling row.

**Folder cascade:** warn the user first with subtree impact (count + total size from the CTE), then:

1. Collect descendant `storageKey`s with the recursive CTE rooted at the folder:
   ```sql
   WITH RECURSIVE sub AS (
     SELECT id, "parentId", "storageKey" FROM "Item" WHERE id = :folderId
     UNION ALL
     SELECT i.id, i."parentId", i."storageKey"
     FROM "Item" i JOIN sub ON i."parentId" = sub.id
   )
   SELECT "storageKey" FROM sub WHERE "storageKey" IS NOT NULL;
   ```
2. Delete blobs from R2 in **batches of 1000** (`DeleteObjects`) **before** the DB delete (a crash leaves reachable rows to retry, not orphan blobs).
3. Delete the folder row; `onDelete: Cascade` removes the subtree in one statement. Soft-revoke shares on the deleted subtree (§4).
4. **Partial R2 failure:** `DeleteObjects` reports per-key errors; the DB delete proceeds regardless (stranded blobs are cost, not correctness) and the sweeper reclaims them. The user's delete always completes.

---

## 7. REST API Contract

All routes prefixed `/api`. All bodies JSON except direct browser↔R2 transfers.

### Response envelope

Success: `{ "data": <T>, "error": null }` · Error: `{ "data": null, "error": { "code", "message", "details"? } }`.

`code` ∈ `VALIDATION | UNAUTHENTICATED | FORBIDDEN | NOT_FOUND | CONFLICT | PAYLOAD_TOO_LARGE | INTERNAL`. One exception filter + interceptor produce this everywhere.

**Status codes:** `200` read/update · `201` create · `204` delete · `400` validation · `401` no/invalid session · `403` authenticated-but-forbidden · `404` missing **or hidden for privacy** · `409` name conflict · `413` over size cap · `500` unexpected. (Unauthorized reads return `404`, not `403`.)

**Auth legend:** `owner` = JWT cookie + owns the resource's room · `shared-viewer` = JWT cookie + active RESTRICTED grant matching the caller's email · `public-token` = valid token for an active PUBLIC share (no session) · `none` = unauthenticated.

### Auth
| METHOD PATH | Purpose | Auth | Body | Response |
|---|---|---|---|---|
| POST `/auth/register` | Signup, sets cookie | none | `{ email, password, name }` | `AuthResponseDto` |
| POST `/auth/login` | Login, sets cookie | none | `{ email, password }` | `AuthResponseDto` |
| POST `/auth/logout` | Clear cookie | any | — | `204` |
| GET `/auth/me` | Current user (hydrate SPA) | any | — | `UserDto` |
| GET `/auth/google` | Begin OAuth | none | — | `302` |
| GET `/auth/google/callback` | OAuth callback, sets cookie, 302 to web | none | — | `302` |

`AuthResponseDto { user: UserDto }` — token lives only in the httpOnly cookie, never the body.

### Data Rooms
| METHOD PATH | Purpose | Auth | Body | Response |
|---|---|---|---|---|
| GET `/rooms` | List owned rooms | owner | — | `DataRoomDto[]` |
| POST `/rooms` | Create room | owner | `{ name }` | `DataRoomDto` |
| GET `/rooms/:roomId` | Get room | owner | — | `DataRoomDto` |
| PATCH `/rooms/:roomId` | Rename | owner | `{ name }` | `DataRoomDto` |
| DELETE `/rooms/:roomId` | Delete room + tree | owner | — | `204` |
| GET `/rooms/:roomId/stats` | Whole-room size + counts (room-root CTE) | owner | — | `SubtreeStatsDto` |

### Items (folders + files)
| METHOD PATH | Purpose | Auth | Body | Response |
|---|---|---|---|---|
| GET `/rooms/:roomId/items` | List one level; `?parentId=<id\|root>&cursor=&limit=&search=` | owner | — | `Paginated<ItemDto>` |
| POST `/rooms/:roomId/items` | Create folder | owner | `{ parentId: string\|null, name, type: "FOLDER" }` | `ItemDto` |
| GET `/items/:itemId` | Item metadata | owner | — | `ItemDto` |
| GET `/items/:itemId/breadcrumb` | Ancestor trail root→item | owner | — | `BreadcrumbDto[]` |
| GET `/items/:itemId/stats` | Subtree size + counts | owner | — | `SubtreeStatsDto` |
| PATCH `/items/:itemId` | Rename and/or move (`name?`, `parentId?`) | owner | `{ name?, parentId? }` | `ItemDto` |
| DELETE `/items/:itemId` | Delete item; folder deletes subtree | owner | — | `204` |

`parentId=root` is the sentinel for null parent (query params can't be null). Rename/move share one PATCH and return `409 + error.details.suggestedName` on collision. `search` present ⇒ filename search across the whole room; absent ⇒ single-level listing.

### Files (presigned R2)
| METHOD PATH | Purpose | Auth | Body | Response |
|---|---|---|---|---|
| POST `/rooms/:roomId/uploads/presign` | Presigned PUT + PENDING item, one call per file | owner | `{ parentId, name, sizeBytes, mimeType }` | `PresignUploadDto` |
| POST `/items/:itemId/finalize` | Confirm bytes landed; server HEADs object, sets size, flips ACTIVE | owner | — *(no body)* | `ItemDto` |
| GET `/items/:itemId/download` | Presigned GET (attachment) | owner | — | `PresignDownloadDto` |
| GET `/items/:itemId/preview` | Presigned GET (inline) | owner | — | `PresignDownloadDto` |

`PresignUploadDto { item: ItemDto; uploadUrl: string; storageKey: string; expiresAt: string }` · `PresignDownloadDto { url: string; expiresAt: string }`. Presign rejects non-PDF (`400`) / oversize (`413`) before signing. Finalize takes **no** size from the client — the server reads it from R2 via HEAD.

### Sharing — management (owner only)
| METHOD PATH | Purpose | Auth | Body | Response |
|---|---|---|---|---|
| POST `/shares` | Create share (room/item, public/restricted) | owner | `CreateShareDto` | `ShareDto` |
| GET `/shares?resourceType=&resourceId=` | List shares on a resource | owner | — | `ShareDto[]` |
| POST `/shares/:shareId/grants` | Add invited email (restricted) | owner | `{ invitedEmail }` | `ShareGrantDto` |
| DELETE `/shares/:shareId/grants/:grantId` | Remove invited user | owner | — | `204` |
| DELETE `/shares/:shareId` | Revoke share (`revokedAt`) | owner | — | `204` |

`CreateShareDto { resourceType, resourceId, mode, invitedEmails?: string[] }`.

**Idempotency (resolved):** a partial unique index enforces one active share per `(resourceType, resourceId, mode)`:
```sql
CREATE UNIQUE INDEX share_active_resource_mode_uq
  ON "Share" ("resourceType", "resourceId", mode)
  WHERE "revokedAt" IS NULL;
```
`POST /shares` is find-or-create: it returns the existing active row if present (stable link for the UI), else inserts; a concurrent-insert `P2002` is caught and re-read. **Re-sharing a previously revoked resource creates a fresh row** (the revoked row stays as audit history) — revoked rows are outside the partial index so they never block the new insert.

### Sharing — recipient read access (the shared view)
Token mode needs no session; restricted mode needs a session whose email has a grant. Every `:itemId` under a shared route is validated as a **descendant** of the shared resource before serving (enforces "nested content only" and yields the delete-while-viewed `404`).

| METHOD PATH | Purpose | Auth | Response |
|---|---|---|---|
| GET `/shared/:token` | Resolve public link → shared resource + room context | public-token | `SharedResourceDto` |
| GET `/shared/:token/items?parentId=&cursor=&limit=` | List children within the shared subtree | public-token | `Paginated<ItemDto>` |
| GET `/shared/:token/items/:itemId/breadcrumb` | **Clamped** ancestor trail (share root → item) | public-token | `BreadcrumbDto[]` |
| GET `/shared/:token/items/:itemId/download` \| `/preview` | Presigned URL, scoped to subtree | public-token | `PresignDownloadDto` |
| GET `/me/shared` | Rooms/items shared *with* the signed-in user | any session | `SharedResourceDto[]` |
| GET `/me/shared/:shareId/items?parentId=&cursor=&limit=` | Browse a restricted share's subtree | shared-viewer | `Paginated<ItemDto>` |
| GET `/me/shared/:shareId/items/:itemId/breadcrumb` | **Clamped** ancestor trail | shared-viewer | `BreadcrumbDto[]` |
| GET `/me/shared/:shareId/items/:itemId/download` \| `/preview` | Presigned URL within the share | shared-viewer | `PresignDownloadDto` |

`SharedResourceDto { share: Pick<ShareDto,'id'|'mode'|'role'|'resourceType'|'resourceId'>; root: ItemDto | DataRoomDto; roomId: string }`.

**Clamped breadcrumbs (resolved):** the shared breadcrumb walk **stops at the share root's node** and never returns ancestors above it — otherwise a shared subtree would leak the names of parent folders the recipient can't see. The clamped `BreadcrumbDto[]` starts at the shared resource and descends to the current item.

### Pagination contract

Keyset, not offset. Request `?cursor=<opaque>&limit=<1..100, default 50>`. Response `Paginated<T> = { items, nextCursor }`; `nextCursor` null on the last page. **The cursor is an opaque base64 of the full sort key `(type, name, id)`** (folders-first, then name, tie-broken by id) — matching the `ORDER BY`. Same contract for owner listing, search, and shared listings.

### Cookie / session / CORS

- **Session:** one httpOnly JWT cookie `session`, `Path=/`, `Max-Age = token TTL`. `SameSite=Lax` + `Secure` in prod (web on Vercel, api on Railway, cross-site over HTTPS); `SameSite=Lax`, `Secure=false` on `http://localhost` in dev. `HttpOnly` always — JS can't read it, so XSS can't exfiltrate the token. OAuth callback sets the same cookie then 302s to the web origin.
- **CORS:** `origin` = explicit web origin from env (no wildcard, required with credentials), `credentials: true`, methods `GET,POST,PATCH,DELETE,OPTIONS`, headers `Content-Type`. The SPA sends every request with `credentials: 'include'`.
- **CSRF:** `SameSite=Lax` + all state-changing routes being non-GET covers the common case; no separate CSRF token for the MVP (documented, right-sized trade-off).

### `@dataroom/types` additions

Add/export: `ApiResponse<T>` / `ApiSuccess<T>` / `ApiError`, `AuthResponseDto`, `PresignUploadDto`, `PresignDownloadDto`, `CreateShareDto`, `SharedResourceDto`, and the `ItemStatus` enum. Reuse existing `UserDto`, `DataRoomDto`, `ItemDto`, `BreadcrumbDto`, `SubtreeStatsDto`, `ShareDto`, `ShareGrantDto`, `Paginated<T>`, and the other enums.

---

## 8. Frontend Architecture (`apps/web`)

React 19 + Vite + TS + Tailwind + shadcn/ui, React Query for **all** server state, react-router-dom v6. No Redux/Zustand — the app is almost entirely server-derived data; a client store would be dead weight. The only global client state is the auth session (one context) and transient UI (dialogs, upload queue).

### `apps/web/src` tree

```
apps/web/src/
├── main.tsx                      # createRoot, QueryClientProvider, RouterProvider, AuthProvider
├── App.tsx                       # <RouterProvider/>
├── router.tsx                    # route tree
├── index.css                     # tailwind layers + shadcn tokens
├── lib/
│   ├── api-client.ts             # typed fetch wrapper, credentials:'include', throws ApiError
│   ├── query-keys.ts             # centralized query-key factory
│   ├── query-client.ts           # QueryClient defaults
│   ├── format.ts                 # formatBytes, formatDate
│   └── utils.ts                  # cn() + misc
├── ui/                           # shadcn primitives + generic wrappers
│   ├── DataState.tsx             # loading/empty/error wrapper
│   ├── ConfirmDialog.tsx
│   └── EmptyState.tsx
├── app/
│   ├── AuthProvider.tsx          # session context: useMe() -> {user, status}
│   ├── ProtectedRoute.tsx        # redirect to /login?next=
│   ├── PublicOnlyRoute.tsx
│   ├── AppLayout.tsx             # top bar (logo, room switcher, avatar) + <Outlet/>
│   └── ErrorBoundary.tsx
├── features/
│   ├── auth/                     # api, hooks, LoginPage, RegisterPage, LoginForm, GoogleButton, OAuthCallback
│   ├── data-rooms/               # api, hooks, RoomListPage, RoomCard, RoomSwitcher, CreateRoomDialog
│   ├── items/                    # the drive core
│   │   ├── api.ts                # listChildren, breadcrumb, createFolder, updateItem(rename/move),
│   │   │                         #   deleteItem, subtreeStats, getUploadUrl, finalizeUpload, getDownloadUrl
│   │   ├── hooks.ts
│   │   ├── DriveView.tsx         # breadcrumbs + toolbar + list + dropzone overlay
│   │   ├── Breadcrumbs.tsx
│   │   ├── ItemList.tsx  ItemRow.tsx  ItemActionsMenu.tsx
│   │   ├── NewFolderDialog.tsx  RenameDialog.tsx  MoveDialog.tsx
│   │   ├── DeleteItemDialog.tsx  DeleteFolderDialog.tsx   # latter shows subtreeStats
│   │   ├── upload/
│   │   │   ├── UploadProvider.tsx  Dropzone.tsx  UploadPanel.tsx  UploadItemRow.tsx
│   │   │   └── useUpload.ts       # presign -> XHR PUT to R2 -> finalize
│   │   └── preview/ FilePreviewPage.tsx  PdfViewer.tsx
│   └── sharing/
│       ├── api.ts hooks.ts
│       ├── ShareDialog.tsx  PublicLinkPanel.tsx  InvitePeoplePanel.tsx
│       └── shared-view/
│           ├── SharedRoute.tsx        # loads share context, branches file vs folder root
│           ├── SharedDriveView.tsx    # wraps DriveView in ReadOnlyProvider
│           └── ReadOnlyContext.tsx
└── types/                        # re-exports from @dataroom/types
```

### Routes

| Path | Element | Access | Notes |
|---|---|---|---|
| `/login` | `LoginPage` | public-only | email+password + Google; `?next=` |
| `/register` | `RegisterPage` | public-only | |
| `/auth/callback` | `OAuthCallback` | public | refetch `me`, redirect |
| `/` → `/rooms` | redirect | protected | |
| `/rooms` | `RoomListPage` | protected | owned rooms |
| `/rooms/:roomId` | `DriveView` (root) | protected | `parentId=null` |
| `/rooms/:roomId/folders/:folderId` | `DriveView` | protected | breadcrumb from API |
| `/rooms/:roomId/files/:fileId` | `FilePreviewPage` | protected | modal over DriveView |
| `/share/:token` | `SharedRoute` | **public** | branches on root type (file→preview, folder/room→drive) |
| `/share/:token/folders/:folderId` | `SharedDriveView` | public | subtree nav |
| `/share/:token/files/:fileId` | `FilePreviewPage` (readOnly) | public | |
| `/shared` | `SharedWithMeList` | protected | restricted shares granted to me |
| `/shared/:shareId/*` | `SharedRoute` | protected | branches file vs folder; server checks grant |
| `*` | `NotFound` | public | |

`ProtectedRoute` reads `useMe()`; `loading` → splash, `error/401` → `/login?next=<path>`. Public share routes never call `me` and never mount `AppLayout`.

**Single-file shares (resolved):** `SharedRoute` branches on `root.type` (or `resourceType === ITEM && root.type === FILE`). A file-rooted share renders `FilePreviewPage` **directly** — it has no children to list — instead of an empty drive view. Folder/room roots render `SharedDriveView`.

### React Query keys

```ts
export const qk = {
  me: ['me'] as const,
  rooms: ['rooms'] as const,
  room: (roomId: string) => ['rooms', roomId] as const,
  roomStats: (roomId: string) => ['room-stats', roomId] as const,
  items: (roomId: string, parentId: string | null) =>
    ['items', roomId, parentId ?? 'root'] as const,
  breadcrumb: (roomId: string, itemId: string) => ['breadcrumb', roomId, itemId] as const,
  subtreeStats: (itemId: string) => ['subtree-stats', itemId] as const,
  share: (type: 'ROOM' | 'ITEM', id: string) => ['share', type, id] as const,
  sharedList: ['shared-with-me'] as const,
  // token-scoped so recipient cache never collides with owner cache:
  sharedItems: (token: string, parentId: string | null) =>
    ['shared', token, 'items', parentId ?? 'root'] as const,
};
```

Listing uses `useInfiniteQuery` on `qk.items(...)` against the keyset `Paginated<ItemDto>` endpoint (`nextCursor`).

**Invalidation per mutation** (invalidate, don't hand-patch, except the noted optimistic cases):
- **createFolder / finalize-upload / delete:** invalidate `qk.items(roomId, parentId)` + ancestor `qk.subtreeStats`.
- **rename:** optimistic patch of the row, rollback on error, invalidate on settle.
- **move:** invalidate source and destination `qk.items` + both subtree stats.
- **createPublicLink / revoke / addGrant / removeGrant:** invalidate `qk.share(type, id)`.

Optimistic only where the outcome is predictable (rename, grant toggles). Create/upload/move go through invalidation because names get normalized server-side and ids are server-assigned.

### Typed API client

`lib/api-client.ts` — a thin `fetch` wrapper (no axios): `credentials:'include'` on every call, `Content-Type: application/json` default, generic `request<T>` returning typed `@dataroom/types` DTOs, non-2xx throws `ApiError { status, code, message }`. A `QueryCache` `onError` handler catches `401`, clears `me`, and redirects to `/login` (except on public `/share/:token` routes). **R2 uploads bypass this client**: `useUpload` does a raw `XMLHttpRequest` PUT to the presigned URL (XHR for `upload.onprogress`), then calls `finalizeUpload`.

### Drive component hierarchy

```
DriveView
├── Breadcrumbs (useBreadcrumb → BreadcrumbDto[])
├── DriveToolbar (New folder · Upload · Share room)
├── Dropzone (full-area drag overlay)
│   └── ItemList
│       ├── ItemListHeader (name · size · modified)
│       └── ItemRow*            # folders navigate; files open preview
│           └── ItemActionsMenu (Rename · Move · Delete · Share)
├── UploadPanel (floating, from UploadProvider queue)
│   └── UploadItemRow* (Progress + cancel/retry)
└── <Outlet/>                   # modal routes: FilePreviewPage, dialogs
Dialogs (portaled): NewFolder · Rename · Move · DeleteItem · DeleteFolder · Share
```

### Cross-cutting UI & states

- **Loading/empty/error:** one `DataState` wrapper consumes `{isLoading,isError,data}` → skeleton / `EmptyState` / inline retry. Used identically by owner and shared views — no ad-hoc spinners.
- **Toasts:** `sonner`, fired from mutation `onSuccess/onError` ("Moved to Reports", "Link copied", "Folder deleted").
- **Drag-and-drop:** native HTML5 DnD (enter/over/leave counter to avoid flicker), PDF-only filter with a rejected-files toast. Uploads flow into `UploadProvider`'s queue so progress survives in-room navigation.
- **Delete-folder confirmation:** `DeleteFolderDialog` fetches `qk.subtreeStats(folderId)` → "This will permanently delete N folders and M files (X total)" before enabling the destructive button.
- **Read-only shared view:** `SharedDriveView` mounts the exact same `Breadcrumbs`/`ItemList`/`ItemRow`/`PdfViewer` inside a `ReadOnlyProvider`. `useReadOnly()` → `ItemRow` renders no actions menu; toolbar, dropzone, and upload panel are not rendered at all. Data comes from token-scoped `qk.sharedItems(token, …)` / `/me/shared/...`. Same UI, zero mutation surface, no duplicated markup.

### Auth / session

`AuthProvider` runs `useMe()` once at mount → `{ user, status: 'loading'|'authenticated'|'anonymous' }`. The JWT is httpOnly, never read in JS. `login/register/logout` invalidate `qk.me`; Google navigates to the backend URL and returns to `/auth/callback`, which refetches `me` then routes to `?next=` or `/rooms`. Global `401` clears `me` and bounces to `/login`; public `/share/:token` routes are exempt.

---

## 9. Edge Cases & Error States

| Case | Handling |
|---|---|
| **Upload same name as existing file** | `resolveName` on presign auto-suffixes silently (`report (1).pdf`); final name returned in `ItemDto`. Partial unique index + retry serialize concurrent/intra-batch collisions. |
| **Rename/move into a name collision** | `409 + error.details.suggestedName`; UI offers keep-both / replace. |
| **Move a folder into its own subtree** | Rejected (`400`) via ancestor walk from destination. |
| **Delete a folder** | Confirm dialog shows subtree count + total size (CTE) before the destructive action. |
| **Delete a folder being viewed by a shared recipient** | Cascade delete + soft-revoke shares; recipient's next call re-checks descendant/`canRead` → `404` → calm "no longer available" UI. In-flight presigned preview may finish; next nav blocked. |
| **Failed / cancelled upload** | PENDING row (never listable); best-effort `DELETE`, else sweeper reaps within ~1 h. No orphan rows. |
| **Partial R2 delete failure** | DB delete proceeds; stranded blobs are cost-only, reclaimed by sweeper. |
| **Non-PDF or oversize upload** | Rejected client-side before any call; server also rejects presign (`400` / `413`). |
| **Unauthorized read (private or lost access)** | `404`, never `403` — no existence leak. |
| **Expired presigned URL** | Client re-fetches on open/expiry; URLs are ~5 min. |
| **Session expiry mid-use** | Global `401` handler clears `me`, redirects to `/login?next=`. |
| **Ancestor-name leak in shared breadcrumb** | Breadcrumb walk clamped at the share root. |
| **Single-file share** | `SharedRoute` opens `FilePreviewPage` directly, not an empty drive. |
| **Re-share a revoked resource** | New active row created; revoked row kept as history; partial unique index allows it. |
| **Empty folder / empty room / no rooms** | `DataState` → `EmptyState` with the relevant primary action. |

---

## 10. Implementation Order

Build feature-by-feature; each step ships something demoable and testable.

0. **Scaffold (done).** Monorepo, `@dataroom/types`, Prisma schema + initial migration, Nest + Vite apps, docker-compose Postgres, lint/format/env.
1. **Schema refinements.** Add `Item.status` + `uploadedAt`, the `(dataRoomId,parentId,type,name)` index, the two partial name-uniqueness indexes, and the active-share partial unique index; regenerate Prisma client + types (`ItemStatus`).
2. **Auth.** Config validation, `PrismaService`, `AuthModule` (local + JWT + Google strategies), httpOnly cookie, `/auth/*`, **auto-create the user's single `DataRoom` on register / first Google login** (`ownerId` unique). Web: Tailwind+shadcn setup, `AuthProvider`, login/register/OAuth flow, `ProtectedRoute`, typed api-client. Exception filter + envelope in place.
3. **Room.** Single room, no CRUD surface: `GET /me/room`, `GET /me/room/stats`, `PATCH /me/room` (rename). Mostly folded into Auth + Items; no room list / switcher.
4. **Core folders/items.** `ItemsModule`: create folder, keyset listing, breadcrumb, rename/move (with `409 + suggestedName`), recursive delete, subtree stats. Web `DriveView`, `Breadcrumbs`, `ItemList/Row`, dialogs, `useInfiniteQuery`.
5. **Files.** `StorageModule` (presign/HEAD/delete), presign + finalize + download/preview; web `UploadProvider`, `Dropzone`, XHR upload with per-file progress, `PdfViewer`, delete + folder-cascade blob cleanup, PENDING sweeper.
6. **Sharing.** `AccessControlService`, `SharingModule` (manage + `/shared/:token/*` + `/me/shared/*` with descendant checks and clamped breadcrumbs); web `ShareDialog`, `SharedRoute`/`SharedDriveView`/`ReadOnlyProvider`, single-file-share branch, revoke.
7. **Polish.** Empty/loading/error states via `DataState`, toasts, delete-folder impact copy, drag-drop refinement, responsive layout, accessibility pass. Remove any half-built UI.
8. **Deploy.** Web → Vercel, API → Railway, DB → Neon, blob → R2. Prod cookie/CORS settings, env wiring, health check, README (answers a/b/c).

**Deferred to future work (designed-for, not built):** filename search (`pg_trgm` GIN + the existing `?search=` seam), file versioning (the rename `409 + suggestedName` seam), denormalized folder counters, EDITOR role (`canWrite` on the existing `role` column), R2-key-scanning orphan-blob reconciliation.
