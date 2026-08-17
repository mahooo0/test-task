# Handoff — Data Room

Resume guide for the next session. Read `ARCHITECTURE.md` (the blueprint) alongside this; the root `README.md` is the product-facing overview.

## What this is

A Google-Drive-like **Data Room** (secure PDF storage + sharing). Monorepo (pnpm):

- `apps/api` — NestJS 11 + Prisma 6 + PostgreSQL (Clerk auth, R2 presigned storage)
- `apps/web` — Next.js 16 (App Router) + React 19 + Tailwind v4 + React Query + `@clerk/nextjs`
- `packages/types` — shared enums + API response DTOs (`@dataroom/types`)

## Status — feature-complete and deployed

Auth (Clerk: email+password, email-code, Google/Apple), drive (folders/files, list/grid/timeline views, DnD, keyset pagination, search, starred, trash with 30-day retention), PDF uploads to R2 (presigned, folder drops), sharing (public links + restricted invites, "shared with me" inline browsing), i18n (en/ru/uk, cookie-based), PostHog analytics **with session replay** (recorder bundled into our chunks so ad blockers can't kill it — see `instrumentation-client.ts`).

**Live:** web `https://dataroom.holy-water.app` (Vercel, project `dataroom`, root `apps/web`) · API `https://api.dataroom.holy-water.app/api/health` (Dokploy on the Contabo VPS, built from `apps/api/Dockerfile`, Postgres `dataroom-db` alongside). Pushes to `main` auto-deploy both.

## Run it locally

```bash
pnpm install
pnpm --filter @dataroom/types build            # shared types first
pnpm --filter @dataroom/api exec prisma generate
pnpm --filter @dataroom/api run start:dev      # api → http://localhost:3000
pnpm --filter @dataroom/web dev                # web → http://localhost:3001
```

Local Postgres: Homebrew Postgres 16 on :5432, role/db `dataroom`/`dataroom` (docker-compose.yml is the portable alternative). Env: `apps/api/.env` + `apps/web/.env.local` (gitignored; documented in root `.env.example`).

## Gotchas worth knowing

- `apps/web/src/proxy.ts` (Next 16's renamed middleware): the matcher **must keep excluding `ingest`** — clerkMiddleware runs before rewrites and would swallow PostHog capture POSTs into an HTML 404.
- `prisma migrate dev` fails non-interactively on data-loss warnings → write migration SQL via `prisma migrate diff`, then `prisma migrate deploy`.
- Clerk is still the **dev instance** (`pk_test`/`sk_test`) — production keys need a Clerk production instance on the real domain.
- Web checks: `pnpm --filter @dataroom/web typecheck` + `lint` (oxlint). API: `typecheck` + `lint` (eslint).
