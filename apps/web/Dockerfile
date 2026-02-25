# ─── Stage 1: Dependencies ──────────────────────────────
FROM node:20-alpine AS deps

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY apps/web/package.json apps/web/

RUN pnpm install --frozen-lockfile --filter web...

# ─── Stage 2: Build ─────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules

COPY apps/web/ apps/web/
COPY pnpm-workspace.yaml package.json .npmrc ./

ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter web build

# ─── Stage 3: Production ────────────────────────────────
FROM node:20-alpine AS production

# Security: non-root user
RUN addgroup --system --gid 1001 docflow && \
    adduser --system --uid 1001 docflow

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy standalone output
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

USER docflow

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

CMD ["node", "apps/web/server.js"]
