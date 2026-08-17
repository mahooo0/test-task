# Build from the repo root: docker build -f apps/api/Dockerfile .
# (pnpm workspace — the API needs packages/types alongside it.)
FROM node:22-alpine AS build

# Prisma engines need openssl on alpine.
RUN apk add --no-cache openssl
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

# Install with just the manifests first so Docker caches the pnpm store layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY packages/types/package.json packages/types/
RUN pnpm install --frozen-lockfile --filter @dataroom/api --filter @dataroom/types

COPY packages/types packages/types
COPY apps/api apps/api
RUN pnpm --filter @dataroom/types build \
  && pnpm --filter @dataroom/api exec prisma generate \
  && pnpm --filter @dataroom/api build

ENV NODE_ENV=production
EXPOSE 3000
WORKDIR /app/apps/api
# Apply pending migrations, then start. `npx` resolves the workspace-local prisma CLI.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
