# Phase 2 API Setup Runbook

## Overview

Phase 2 adds the Account & Session REST Backbone:
- `apps/api` — Fastify REST API (accounts, sessions, health)
- `packages/db` — MariaDB client, migrations, repositories
- `packages/cache` — Redis client, session cache (TTL=300s)

---

## Prerequisites

- Docker (for MariaDB + Redis) OR local installs
- Node.js 22+, pnpm 9+
- All Phase 1 packages built (`pnpm turbo build`)

---

## Infrastructure

### MariaDB

```bash
docker run -d \
  --name atc-db \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=atc \
  -e MYSQL_USER=atc \
  -e MYSQL_PASSWORD=atcpass \
  -p 3306:3306 \
  mariadb:11
```

### Redis

```bash
docker run -d \
  --name atc-redis \
  -p 6379:6379 \
  redis:7-alpine
```

---

## Environment Variables

Create `apps/api/.env` (never commit this file):

```env
# Required
ATC_API_TOKEN=your-secret-api-token-here
DB_NAME=atc
DB_USER=atc
DB_PASSWORD=atcpass

# Optional (defaults shown)
PORT=3000
HOST=0.0.0.0
DB_HOST=127.0.0.1
DB_PORT=3306
DB_CONNECTION_LIMIT=10
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
LOG_LEVEL=info
LOG_FORMAT=json
NODE_ENV=production
```

### FiveM server.cfg

Add to your `server.cfg`:

```cfg
set atc_api_url "http://localhost:3000"
set atc_api_token "your-secret-api-token-here"
set atc_fail_open "false"
set atc_api_timeout_ms "5000"
```

> **Security:** `atc_api_token` must match `ATC_API_TOKEN` in the API. This token authorizes all FiveM → API communication. Treat it as a secret.

---

## Build & Start

```bash
# Install dependencies
pnpm install

# Build all packages in dependency order
pnpm turbo build

# Run migrations (requires DB connection)
cd apps/api && node dist/run-migrate.js

# Start API
cd apps/api && node dist/index.js
```

---

## Verifying the API

```bash
# Health check (no auth required)
curl http://localhost:3000/health

# Account upsert (requires Bearer token)
curl -X POST http://localhost:3000/api/v1/accounts \
  -H "Authorization: Bearer your-secret-api-token-here" \
  -H "Content-Type: application/json" \
  -d '{"primaryIdentifier":"license:abc123","identifiers":{"license":"abc123"},"preferredLanguage":"en"}'

# Ban check
curl http://localhost:3000/api/v1/accounts/check/license:abc123 \
  -H "Authorization: Bearer your-secret-api-token-here"

# Create session
curl -X POST http://localhost:3000/api/v1/sessions \
  -H "Authorization: Bearer your-secret-api-token-here" \
  -H "Content-Type: application/json" \
  -d '{"accountId":"<ulid>","source":1,"name":"TestPlayer","primaryIdentifier":"license:abc123","language":"en"}'

# Get session by source
curl http://localhost:3000/api/v1/sessions/source/1 \
  -H "Authorization: Bearer your-secret-api-token-here"

# End session
curl -X DELETE http://localhost:3000/api/v1/sessions/1 \
  -H "Authorization: Bearer your-secret-api-token-here"
```

---

## Database Tables

| Table | Description |
|---|---|
| `atc_migrations` | Applied migration tracking |
| `atc_accounts` | Player accounts (primary record) |
| `atc_account_identifiers` | Per-account identifiers (license, discord, steam…) |
| `atc_player_sessions` | Connection sessions |
| `atc_bans` | Active and historical bans |

All primary keys are ULID (26-char, `char(26)` column), time-sortable.

---

## Player Connect Flow

```
FiveM: playerConnecting
  → POST /api/v1/accounts   (upsert + ban check)
  → if banned/suspended: kick with message
  → if API down + fail_open=false: kick with message
  → if API down + fail_open=true: allow (unsafe, disabled by default)
  → deferrals.done()

FiveM: atc:core:client:ready event
  → ATC.Sessions.Create (in-memory Lua session)
  → TriggerClientEvent(SERVER_READY)

FiveM: playerDropped
  → ATC.Sessions.Remove (in-memory cleanup)
  → DELETE /api/v1/sessions/:source (async, best-effort)
```

---

## Session Cache

Redis key pattern: `atc:session:source:{source}`
TTL: 300 seconds (refreshed on each GET lookup)

The cache is a read-through: GET /api/v1/sessions/source/:source checks Redis first,
falls back to MariaDB on cache miss, and repopulates the cache.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Players kicked on connect | API unreachable | Check `ATC_API_URL`, set `atc_fail_open=true` temporarily |
| 401 on API calls | Token mismatch | Verify `atc_api_token` == `ATC_API_TOKEN` |
| Migration error on start | DB unreachable | Check `DB_HOST`, `DB_PORT`, credentials |
| Redis connection refused | Redis not running | Start Redis or check `REDIS_HOST`/`REDIS_PORT` |
| Health returns `degraded` | DB or Redis down | Check infrastructure |
