# Google Drive Parity — Gap Analysis & Backlog

> What Google Drive (`drive.google.com`) has that our Data Room does **not** yet.
> Source: live walkthrough of Google Drive (My Drive / Shared-with-me / advanced search / create menu)
> cross-referenced against a code-grounded audit of `apps/web` + `apps/api` (2026-08-15).
>
> **Product scope constraint (locked):** item types are **folders + PDF only**. No Google-Docs
> file types, no images/video/etc. This simplifies every "type" dimension below to `Folder | PDF`.
>
> Legend — current state: **HAVE** (works) · **PARTIAL** (half-built) · **MISSING** (absent).
> Effort: **S** ≈ hours · **M** ≈ 1 day · **L** ≈ multi-day.

---

## A. Confirmed in-scope (view / UX parity)

### A1 — Two view modes: List ↔ Grid, with a toggle  ·  MISSING
- **Google Drive:** top-right toggle switches between a **list/table** and a **grid of cards** with a
  **page-1 preview thumbnail**; the choice is remembered per user.
- **Us:** list is the *only* render mode (`DriveView.tsx:65-90`, each row `ItemRow.tsx:56`). No view-mode
  state, no toggle, no card gallery, no thumbnails (`grep thumbnail|viewMode` → nothing).
- **Build:**
  - FE — `viewMode` state persisted like other prefs (ThemeProvider/localStorage); a toggle control in the
    toolbar; a `DriveGrid`/`ItemCard` component.
  - Thumbnails — **LOCKED: real PDF page-1 previews rendered client-side with `pdf.js`** (`<canvas>` in
    `ItemCard`, no backend/thumbnail-storage change). Cache rendered canvases; fall back to a PDF icon while
    rendering / on error.
- **Effort:** L (real PDF thumbnails).

### A2 — Sorting (name / modified / size) + sortable headers  ·  MISSING
- **Google Drive:** click a column header (or a sort control) to sort by **Name / Last modified / Size**;
  folders grouped first; asc/desc.
- **Us:** MISSING front **and** back. Headers are inert `<span>`s, no sort state (`DriveView.tsx:66-70`).
  API takes no `sort` param (`list-children.dto.ts:4-21`); order is hard-coded
  `ORDER BY type,name,id` (`items.service.ts:73`) and the **keyset cursor is structurally bound to
  `(type,name,id)`** (`items.cursor.ts:9-13`) — so date/size ordering is impossible even implicitly.
- **Build:**
  - BE — add `sort=name|modified|size` + `dir=asc|desc` to `ListChildrenDto`; **generalize the keyset
    cursor** to `(sortKey, id)` tuples (the non-trivial part) and add supporting indexes.
  - FE — sortable header cells (aria-sort) or a sort menu; thread through the `useDriveItems` query key.
- **Effort:** M–L (backend keyset generalization is the real work).

### A3 — Date display polish  ·  PARTIAL
- **Google Drive:** shows **Last modified**, and can surface **Created** / **Last opened by me**; relative
  ("2 days ago") on hover exact.
- **Us:** one **Modified** column = `updatedAt` (`ItemRow.tsx:77-79`). `createdAt` is returned but never
  shown; `uploadedAt` is deliberately server-only (`items.mapper.ts:23`).
- **Build:** small — make the date column sortable (see A2), optionally surface created/uploaded date,
  relative-time formatting. This is "нету просмотра по датам" once paired with A2.
- **Effort:** S.

### A4 — Sidebar folder tree (expandable nested folders)  ·  MISSING
- **Google Drive:** "My Drive" expands into a **lazy-loaded, nested folder tree** in the sidebar; click a
  node to navigate; the current folder is highlighted.
- **Us:** sidebar has a **single static "My Drive" link** (`app-sidebar.tsx:44-50`) — no tree, no folder
  fetching, no `SidebarMenuSub`.
- **Build:** FE — collapsible tree (`SidebarMenuSub`), lazy-fetch child folders per node (reuse
  `listChildren` filtered to `FOLDER`), expand/collapse state, active-node sync to the route. Pairs well
  with the `type=FOLDER` list filter from A6.
- **Effort:** M.

### A5 — Drag-and-drop to **move** (drag row → folder / breadcrumb / tree)  ·  MISSING
- **Google Drive:** drag an item onto a folder row, a breadcrumb crumb, or a sidebar tree node to **move**
  it; supports multi-select drag.
- **Us:** only **desktop→upload** DnD exists (`DropOverlay.tsx`, guards on `dataTransfer` type `Files`).
  Rows aren't draggable, folders aren't drop targets; the only move path is the **MoveDialog** click-through
  picker (`ItemRow.tsx:110-113`). ("нету днд логики" = this.)
- **Build:** FE — make rows draggable (`dnd-kit`), register folder rows + breadcrumb + sidebar tree nodes as
  drop targets, call the existing move mutation on drop; keep MoveDialog as the a11y/fallback path. BE —
  move endpoint already exists (`PATCH /items/:id` parentId, with subtree-cycle guard).
- **Effort:** M.

### A6 — Search (drive-wide, by name; type filter Folder/PDF; optional date filter)  ·  MISSING
- **Google Drive:** global search bar + **advanced panel**: Type, Owner, "contains words" (full-text),
  filename, Location (Trash/Starred/Encrypted), Modified date, Shared-with, Approvals, Reminders. Plus
  inline filter chips (Тип / Люди / Изменено / Источник).
- **Us:** MISSING. `search-dialog.tsx` is a static "jump to **My Drive**" cmdk palette — it never queries
  the server and filters only that one hardcoded entry. No search route in `apps/api`; `listChildren` is
  strictly single-level. ("нету поиска типов" = this.)
- **Build (scoped to our world):**
  - BE — new search endpoint: name `ILIKE` across the room's items (scope `dataRoomId`, `status=ACTIVE`),
    filters **`type=FOLDER|FILE`** and optional **modified-date range**; keyset-paginated; returns each
    hit's path/breadcrumb.
  - FE — wire the ⌘K dialog (or a results view) with debounce; show folder path per result; **type chips =
    Folder / PDF only** (per scope); optional date filter.
  - **LOCKED: name-only search.** Full-text search *inside* PDFs is **out of scope** this iteration.
- **Effort:** M.

### A7 — In-app PDF preview  ·  MISSING  *(related to A1's "cards with preview")*
- **Google Drive:** clicking a file opens an **in-app full-screen preview** (PDF viewer) + a details side
  panel — not a raw browser tab.
- **Us:** "Open" does `window.open(presignedUrl,'_blank')` → native browser PDF (`hooks.ts:130-133`). No
  in-app viewer, no `pdf.js`/`react-pdf` dependency.
- **Build:** FE — preview modal/route using `pdf.js`/`react-pdf` against the existing presigned **preview**
  URL; details panel (name/size/dates). BE preview endpoint already exists.
- **Effort:** M.  (The user's "с предпросмотром" ask lives here + A1.)

---

## B. Multi-user / sharing — ✅ LOCKED IN (full)

> These are the "нету отображения кто загрузил / нету людей / нету делится с другими пользователями" items.
> **Decision (2026-08-15): FULL sharing is in scope** — public link + invite-by-email + `VIEWER` role +
> *Shared with me* + grant **enforcement** in read/list paths, plus the B1 "who uploaded" column. This is a
> large expansion of today's **single-owner** model; the DB schema already exists but **zero code wires it**
> (pre-planned as project feature **#5**).

### B1 — "Who uploaded" / Owner column  ·  MISSING
- **Google Drive:** an **Owner** column (in *Shared with me*, a "shared by" / owner face).
- **Us:** MISSING and **no data source** — the `Item` model has no `uploaderId/ownerId/createdBy` and no
  `User` relation (`schema.prisma:83-116`); `ItemDto` exposes none. Because a room has exactly **one** owner
  (`DataRoom.ownerId @unique`), every item's uploader is *implicitly that same owner* — so a "who uploaded"
  column is only meaningful **once multiple people can add items** (i.e., after B2/B3 with edit rights).
- **Build:** add `Item.uploadedById` + `User` relation, populate on create/finalize, surface in `ItemDto` +
  a column/avatar. **Depends on B2/B3** to be non-trivial.
- **Effort:** S (field + column) — but pointless without B2/B3.

### B2 — People / multi-user access ("Shared with me")  ·  MISSING
- **Google Drive:** many users; a **Shared with me** view; per-user grants.
- **Us:** MISSING as a feature. `Share`/`ShareGrant` tables are migrated but never read/written; every
  listing is scoped to the caller's **own single room** (`data-rooms.controller.ts` `@Controller('me/room')`).
- **Build:** an access-control layer that lets a **non-owner** list/read a room/folder/file shared with
  them; a **Shared-with-me** route + sidebar entry; resolve `ShareGrant`s for the signed-in user.
- **Effort:** L.

### B3 — Sharing with other users (Share dialog: public link + invite-by-email + roles)  ·  MISSING
- **Google Drive:** **Share** button → invite by email with a **role** (viewer/commenter/editor); **public
  link** with an access level; copy link; manage/revoke.
- **Us:** MISSING as a feature. Schema is complete and migrated — `ShareMode PUBLIC|RESTRICTED`,
  `publicToken @unique`, `ShareGrant.invitedEmail`, `ShareRole VIEWER|EDITOR` — but **no controller / route /
  UI** references any of it (`grep share|invite|publicToken|grant|revoke` in `apps/api/src` → 0). No Share
  button in `ItemRow` (actions are open/download/rename/move/delete only). No `/s/[token]` public route.
- **Build:**
  - BE — share endpoints (create / list / revoke), public-token resolver, and **enforce grants** in the
    item read/list paths (the hard part).
  - FE — Share dialog, public-link UI + copy, invite-by-email, role picker, and the *Shared with me* surface.
- **Effort:** L (largest single item; this is planned feature #5).

---

## C. Also observed in Google Drive, absent here — decided

Real GDrive features we also lack. **Decision (2026-08-15):** C2, C3, C5 are **IN**; the rest are **OUT** this iteration.

| # | Feature | GDrive | Us | Effort | Decision |
|---|---------|--------|----|--------|----------|
| C2 | **Trash (soft-delete + restore)** instead of hard delete | ✅ Корзина | MISSING — `Delete` is a hard delete (`ItemRow.tsx:115-117` → `deleteItem`) | M | ✅ **IN** |
| C5 | **Details / activity side panel** (ⓘ) | ✅ | MISSING | M | ✅ **IN** |
| C3 | **Starred / favorites** + a Starred view | ✅ Помеченные | MISSING | S–M | ✅ **IN** |
| C1 | **Multi-select + bulk actions** (shift/ctrl-click, bulk move/delete/download) | ✅ | MISSING | M | ⬜ out |
| C4 | **Storage usage meter** | ✅ "2.4 MB of 15 GB" | MISSING (we have room subtree stats, not surfaced as a quota bar) | S | ⬜ out |
| C6 | **Recent** view | ✅ Недавние | MISSING | S | ⬜ out |
| C7 | **Right-click context menu** (in addition to the row "…" menu) | ✅ | MISSING (only the `…` dropdown) | S | ⬜ out |
| C8 | **Keyboard shortcuts** (new folder `C→F`, upload `C→U/I`, etc.) | ✅ | MISSING | S | ⬜ out |

---

## D. Explicitly OUT of scope (Google Drive has, we intentionally skip)
- Non-PDF file types (Docs/Sheets/Slides/Forms/Vids, images, video, audio, ZIP) — **PDF + folders only**.
- Google-app document creation from the "New" menu.
- Gemini AI ("Спросить Gemini").
- Computers / desktop-sync, offline availability, Spam, encryption filter.

---

## E. Locked decisions (2026-08-15)

| Q | Decision |
|---|----------|
| Sharing/people (B1–B3) | ✅ **Full** — public link + invite-by-email + `VIEWER` role + Shared-with-me + grant enforcement + B1 "who uploaded" |
| Search depth (A6) | ✅ **Name-only** (no full-text inside PDFs) |
| Grid thumbnails (A1) | ✅ **Real PDF page-1** via client `pdf.js` (no backend) |
| Extras (C) | ✅ **Trash+restore (C2), Details panel (C5), Starred (C3)**; C1/C4/C6/C7/C8 out |

**Final in-scope set:** A1, A2, A3, A4, A5, A6, A7, B1, B2, B3, C2, C3, C5.

## F. Build order for Morgan — one feature at a time, review each (NO one-shotting)

> Per project rule: build **one feature at a time**, review before the next; backend-first-then-review for
> backend-heavy features. Suggested sequence (each = a Morgan scope→case→pull→clean cycle):

1. **A1 — Grid view + PDF page-1 preview cards + list/grid toggle** *(pure FE; headline ask; high-impact first win)*
2. **A4 — Sidebar folder tree** *(FE; lazy-loaded)*
3. **A5 — DnD move** *(FE; reuses existing move endpoint)*
4. **A2 — Sorting** *(BE keyset generalization first → review → FE sort UI)* — folds in **A3** date polish
5. **A6 — Search** *(BE search endpoint first → review → FE ⌘K wiring, type/date filters)*
6. **A7 — In-app PDF preview** *(FE; pdf.js viewer + details panel — pairs with C5)*
7. **C2 — Trash + restore** *(BE soft-delete `deletedAt` + trash routes → review → FE Trash view)*
8. **C3 — Starred** *(BE `starred` + routes → FE star action + Starred view)*
9. **C5 — Details side panel** *(FE; folds in B1 "who uploaded" once B1 lands)*
10. **B (sharing) — biggest, last:** **B1** `Item.uploadedById` + User relation → **B3** share endpoints +
    public-token resolver + **grant enforcement** in read/list → **B2** Shared-with-me → FE Share dialog +
    public link + invite-by-email + Shared-with-me surface + owner column.

Each step ends with typecheck + lint + browser verification before moving on.
