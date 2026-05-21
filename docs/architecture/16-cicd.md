# CI/CD Architecture

## Pipeline Overview

```
Developer pushes branch
        │
        ▼
CI: Pull Request Pipeline
  ├── Lint (ESLint + Luacheck)
  ├── Typecheck (tsc --noEmit)
  ├── Unit Tests (Vitest)
  ├── Integration Tests (Vitest + MariaDB)
  ├── Security Scan (npm audit + Trivy)
  └── Build Verification (turbo build)
        │
        ▼ (PR merged to develop)
CI: Integration Build
  ├── Full test suite
  ├── Docker image builds
  └── Push to registry (staging tag)
        │
        ▼ (develop merged to main)
CD: Production Deploy
  ├── Build production Docker images
  ├── Run DB migrations
  ├── Blue/green deployment
  └── Post-deploy smoke tests
```

---

## GitHub Actions Workflows

### PR Validation (`.github/workflows/pr.yml`)

```yaml
name: PR Validation
on:
  pull_request:
    branches: [develop, main]

jobs:
  validate:
    runs-on: ubuntu-latest
    services:
      mariadb:
        image: mariadb:11
        env:
          MYSQL_ROOT_PASSWORD: test
          MYSQL_DATABASE: atc_test
        options: --health-cmd="mysqladmin ping" --health-interval=10s
      redis:
        image: redis:7
        options: --health-cmd="redis-cli ping" --health-interval=10s

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Typecheck
        run: pnpm turbo typecheck

      - name: Lint
        run: pnpm turbo lint

      - name: Unit Tests
        run: pnpm turbo test:unit

      - name: Integration Tests
        run: pnpm turbo test:integration
        env:
          DB_HOST: localhost
          DB_PORT: 3306
          DB_NAME: atc_test
          DB_USER: root
          DB_PASSWORD: test
          REDIS_HOST: localhost
          REDIS_PORT: 6379
          NODE_ENV: test

      - name: Build
        run: pnpm turbo build

      - name: Security Audit
        run: pnpm audit --audit-level=high
```

### Docker Build & Push (`.github/workflows/build.yml`)

```yaml
name: Build & Push
on:
  push:
    branches: [develop, main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Determine tag
        id: tag
        run: |
          if [ "${{ github.ref }}" = "refs/heads/main" ]; then
            echo "TAG=latest" >> $GITHUB_OUTPUT
          else
            echo "TAG=staging" >> $GITHUB_OUTPUT
          fi

      - name: Build API image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: infra/docker/api.Dockerfile
          push: true
          tags: ghcr.io/atlantic-community/atc-api:${{ steps.tag.outputs.TAG }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Build Web image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: infra/docker/web.Dockerfile
          push: true
          tags: ghcr.io/atlantic-community/atc-web:${{ steps.tag.outputs.TAG }}
```

---

## Docker Configuration

### API Dockerfile (`infra/docker/api.Dockerfile`)

```dockerfile
# Build stage
FROM node:22-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages/ packages/
COPY apps/api/ apps/api/

RUN pnpm install --frozen-lockfile
RUN pnpm turbo build --filter=api

# Runtime stage
FROM node:22-alpine AS runner
WORKDIR /app
RUN npm install -g pnpm

ENV NODE_ENV=production

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q -O- http://localhost:3001/health || exit 1

USER node
CMD ["node", "dist/index.js"]
```

### Docker Compose (`infra/docker/docker-compose.yml`)

```yaml
version: '3.9'

services:
  api:
    image: ghcr.io/atlantic-community/atc-api:latest
    ports:
      - "3001:3001"
    env_file: .env
    depends_on:
      mariadb:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - atc

  web:
    image: ghcr.io/atlantic-community/atc-web:latest
    ports:
      - "3000:80"
    restart: unless-stopped
    networks:
      - atc

  mariadb:
    image: mariadb:11
    volumes:
      - mariadb_data:/var/lib/mysql
      - ./scripts/init.sql:/docker-entrypoint-initdb.d/init.sql
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
      MYSQL_DATABASE: ${DB_NAME}
      MYSQL_USER: ${DB_USER}
      MYSQL_PASSWORD: ${DB_PASSWORD}
    healthcheck:
      test: ["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - atc

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD} --maxmemory 512mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - atc

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/atc.conf:/etc/nginx/conf.d/default.conf
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      - api
      - web
    restart: unless-stopped
    networks:
      - atc

volumes:
  mariadb_data:
  redis_data:

networks:
  atc:
    driver: bridge
```

---

## Environment Strategy

| Environment | Purpose | Branch |
|---|---|---|
| `local` | Developer machine | feature/* |
| `staging` | Integration testing | develop |
| `production` | Live server | main |

Environment differences:
- Local: pretty logs, detailed errors, seed data
- Staging: JSON logs, sanitized errors, production-like data volume
- Production: JSON logs, generic error messages, full security config

---

## Deployment Strategy

### Blue-Green Deployment

```
Current: Blue (api-blue:3001) serving traffic

Deploy new version:
1. Build new image → tag api-green
2. Start api-green container (port 3002)
3. Run DB migrations (backwards-compatible required)
4. Health check api-green
5. Switch nginx upstream from api-blue → api-green
6. api-blue remains running for 5min (rollback window)
7. After 5min: stop api-blue
```

### Migration Safety Rule

Every DB migration that runs in production must be backwards-compatible with the previous API version. This allows rollback without data loss. Breaking schema changes require a two-step process:

```
Step 1 (deploy): Add new column as nullable
Step 2 (deploy, next release): Fill data, add NOT NULL constraint
```

---

## Rollback Procedure

```bash
# API rollback (switch nginx upstream back)
./infra/scripts/rollback-api.sh blue

# DB rollback (if migration was rolled out)
pnpm db:migrate:rollback

# Full rollback to previous release
git revert HEAD && git push origin main
# CI will re-deploy previous version
```

---

## Secret Management

Secrets are never stored in git. In production:
- Secrets in environment-specific `.env` files on the host (volume-mounted)
- Or: Docker Secrets / HashiCorp Vault (Phase 2+)
- ATC Server Token rotated daily via cron + API restart

```bash
# Rotate server token
./infra/scripts/rotate-server-token.sh
# Generates new ATC_SERVER_TOKEN, updates .env, gracefully restarts API
```
