# @dataroom/api

The Data Room API — NestJS 11 + Prisma 6 (PostgreSQL) + Cloudflare R2 presigned storage, authenticated with Clerk bearer tokens.

See the [root README](../../README.md) for the full architecture, API reference, and deployment story. Highlights of this package:

- `src/items` — folders/files: keyset-paginated listings, search, starring, trash (30-day retention), presigned PDF uploads.
- `src/shares` — public-link and invite-based sharing, plus the grantee ("shared with me") and anonymous public surfaces.
- `src/clerk` + `src/common/guards` — token verification with JIT user/room provisioning.
- `src/common` — response envelope, exception filter, localized error messages (en/ru/uk via `X-Locale`).

## Run

```bash
pnpm --filter @dataroom/types build     # shared DTOs first
pnpm --filter @dataroom/api exec prisma generate
pnpm --filter @dataroom/api exec prisma migrate deploy
pnpm --filter @dataroom/api run start:dev   # http://localhost:3000 (health: /api/health)
```

Environment lives in `apps/api/.env` — the documented list is in the repo-root `.env.example`. Production runs from `apps/api/Dockerfile` (migrations apply on container start).
