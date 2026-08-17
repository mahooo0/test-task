# Handoff — Data Room MVP

Resume guide for the next session. Read `ARCHITECTURE.md` (the blueprint) alongside this.

## What this is

A Google-Drive-like **Data Room** (secure PDF storage + sharing). Monorepo (pnpm):

- `apps/api` — NestJS 11 + Prisma 6 + PostgreSQL
- `apps/web` — **Next.js 16 (App Router)** + React 19 + TS + Tailwind v4 + React Query + `@clerk/nextjs` (client-rendered; talks to the Nest API with a Clerk bearer token; no SSR data)
- `packages/types` — shared enums + API response DTOs (`@dataroom/types`)

> **Frontend was migrated Vite→Next 16** (App Router). Route protection lives in `apps/web/src/proxy.ts` (Next 16's renamed middleware). Web needs `CLERK_SECRET_KEY` (server-side proxy) in `apps/web/.env.local`.

## Status

| Area | State |
| --- | --- |
| Monorepo scaffold, tooling, Prisma schema + 3 migrations | ✅ done |
| Auth **backend** (Clerk verify guard + JIT user/DataRoom provisioning, `GET /api/me`, envelope, health) | ✅ done, smoke-tested (health / 401 / CORS) |
| Auth **frontend** (Clerk custom flow: email+password, email-code sign-up, Google/Apple; theme system; polished login/register UI) | ✅ done (UI), **e2e NOT run** |
| Enable Clerk methods + full login e2e | ❌ **next step** |
| Room/Items, Files (R2), Sharing, Polish, Deploy | ❌ not started |

**Auth was pivoted from custom Passport to Clerk.** R2 file storage is designed but not wired.

## Run it locally

```bash
# DB: Homebrew Postgres 16 on :5432 already has role/db dataroom/dataroom.
# (Docker daemon was off; docker-compose.yml is kept for portability.)

pnpm install                                   # if node_modules is stale
pnpm --filter @dataroom/types build            # build shared types first
pnpm --filter @dataroom/api exec prisma generate
pnpm --filter @dataroom/api run start:dev      # api → http://localhost:3000
pnpm --filter @dataroom/web dev                # web → http://localhost:3001 (next dev -p 3001)
```

Env: `apps/api/.env` (`DATABASE_URL`, `CORS_ORIGIN=http://localhost:3001`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, R2 placeholders) and `apps/web/.env.local` (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_CLERK_SIGN_IN_URL`/`SIGN_UP_URL`, and server-only `CLERK_SECRET_KEY`) exist and are gitignored. Root `.env.example` documents everything. Clerk app "Data Room" already provisioned.

Prisma migrate note: `prisma migrate dev` errors non-interactively on data-loss warnings — instead `prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` into a new `prisma/migrations/<timestamp>_name/migration.sql`, then `prisma migrate deploy`.

## ⚠️ Next step — finish Auth (feature #2)

1. **Enable / verify Clerk instance auth methods**: Email + **Password** + email verification code, and Google (Clerk dev provides shared Google creds). Apple button exists but needs the user's own Apple Developer creds to actually work.
2. **E2E test the login flow** using Clerk's dev test email `anything+clerk_test@example.com` with code `424242`: register → session → the app calls `GET /api/me` → verify a local `User` **and** its auto-created `DataRoom` row appear in the DB. This has not been run yet — the UI was only verified via screenshots.

Then continue feature-by-feature (user's rule: **one feature at a time, review each, no one-shotting**): Room/Items → Files (R2) → Sharing → Polish → README + Deploy.

## Theme / UI notes

App theme is **dark** (`--background: #171717`). The **auth card is always light** via a `.light` scope (`src/index.css`: `.light{}` re-declares light tokens; the `dark:` variant is redefined to not apply inside `.light`). A 3-way theme toggle (system/dark/light) lives top-left on the auth page. Logo = chevron + "Data Room" in the **Sora** font. Auth email flow = email+password (sign-up adds an email-code verification step).

## Git

On `main`; **nothing committed yet** except the initial `test-task.md`. Everything is untracked — consider committing the scaffold + auth before continuing.
