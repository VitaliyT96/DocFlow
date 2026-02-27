# ─── Stage 1: Build ─────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy workspace root files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY tsconfig.base.json ./

# Copy only this app and shared libs
COPY apps/worker/package.json apps/worker/
COPY libs/ libs/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter worker...

# Copy source
COPY apps/worker/ apps/worker/

# Build shared libs first, then worker
RUN pnpm --filter @docflow/proto build && \
  pnpm --filter @docflow/redis build && \
  pnpm --filter worker build

# ─── Stage 2: Production ────────────────────────────────
FROM node:20-alpine AS production

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Security: non-root user
RUN addgroup --system --gid 1001 docflow && \
  adduser --system --uid 1001 docflow

WORKDIR /app

# Copy workspace root files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY apps/worker/package.json apps/worker/

# Copy all lib package.json files (needed for pnpm workspace resolution)
COPY libs/database/package.json libs/database/package.json
COPY libs/proto/package.json libs/proto/package.json
COPY libs/redis/package.json libs/redis/package.json

# Install production dependencies only
RUN pnpm install --frozen-lockfile --filter worker... --prod

# Copy built app output
COPY --from=builder /app/apps/worker/dist apps/worker/dist

# Copy built shared libs (runtime resolution)
COPY --from=builder /app/libs/proto libs/proto
COPY --from=builder /app/libs/redis/dist libs/redis/dist
COPY --from=builder /app/libs/database/src libs/database/src

# Switch to non-root user
USER docflow

EXPOSE 50051 50052

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:50052/health || exit 1

CMD ["node", "apps/worker/dist/main"]
