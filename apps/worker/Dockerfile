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

# Build
RUN pnpm --filter worker build

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

# Copy proto files (needed at runtime for gRPC)
COPY libs/ libs/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --filter worker... --prod

# Copy built output
COPY --from=builder /app/apps/worker/dist apps/worker/dist

# Switch to non-root user
USER docflow

EXPOSE 50051 50052

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:50052/health || exit 1

CMD ["node", "apps/worker/dist/main"]
