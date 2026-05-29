# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: base — install deps + build
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS base

WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace manifests first for layer-cache efficiency
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Copy package sources (needed for workspace resolution)
COPY packages/ packages/
COPY apps/api/ apps/api/

# Install all dependencies (including devDeps needed for build)
RUN pnpm install --frozen-lockfile

# Build only the API and its workspace dependencies
RUN pnpm turbo build --filter=@atc/api

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: runner — lean production image
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy production node_modules
COPY --from=base /app/node_modules ./node_modules

# Copy compiled API output
COPY --from=base /app/apps/api/dist ./apps/api/dist
COPY --from=base /app/apps/api/package.json ./apps/api/package.json

# Copy built packages (workspace deps referenced at runtime)
COPY --from=base /app/packages ./packages

EXPOSE 3000

CMD ["node", "apps/api/dist/index.js"]
