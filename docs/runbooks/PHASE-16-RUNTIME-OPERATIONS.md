# Phase 16 — Runtime Operations, Diagnostics & Recovery

**Status:** Complete  
**Date:** 2026-05-16  
**Packages touched:** `@atc/shared-types`, `@atc/operations`, `@atc/task-runtime`, `@atc/event-store`, `@atc/api`, `@atc/locales`, `game/atc-core`

---

## Overview

Phase 16 adds a full runtime observability and recovery layer to the ATC platform:

- **Health service** — concurrent subsystem health checks with timeout isolation
- **Diagnostics API** — read-only runtime introspection endpoints
- **Dead-letter queue (DLQ) inspection** — list and requeue failed tasks
- **Event store inspection** — paginated event listing across all streams
- **Plugin health diagnostics** — per-plugin status and failure tracking
- **Liveness/readiness probes** — unauthenticated k8s-compatible endpoints
- **Telemetry counters** — ops-specific metrics for dashboards and alerting
- **FiveM bridge** — Lua SDK for calling ops endpoints from game scripts

---

## New Packages

### `@atc/operations`

Contains:
- `AtcHealthService` — runs concurrent subsystem checks, aggregates status
- Duck-typed interfaces (`DbCheckable`, `RedisCheckable`, etc.) for injection
- Zod schemas for all ops query params and request bodies

**Aggregation rules:**
- Any critical subsystem (`db`, `redis`) with `failed` → overall `failed`
- Any non-critical subsystem with `failed` → overall `degraded`
- Any subsystem with `degraded` → overall `degraded`
- All healthy → `healthy`

---

## API Endpoints

### Unauthenticated (no Bearer token required)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/ops/live` | Liveness probe — always 200 if process is alive |
| GET | `/api/v1/ops/ready` | Readiness probe — 200 if DB + Redis reachable, 503 otherwise |

### Authenticated (Bearer token)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/ops/health` | Full health snapshot for all subsystems |
| GET | `/api/v1/ops/diagnostics` | Health + task metrics + event stream list |
| GET | `/api/v1/ops/tasks/dead-letter` | Paginated DLQ listing (`limit`, `offset`) |
| POST | `/api/v1/ops/tasks/requeue` | Requeue a task by `taskId` (UUID) |
| GET | `/api/v1/ops/events` | Paginated event listing (`eventName`, `limit`, `cursor`) |
| GET | `/api/v1/ops/plugins/health` | Per-plugin status, failure counts, last error |

---

## Health Snapshot Shape

```json
{
  "status": "healthy | degraded | failed",
  "checkedAt": "2026-05-16T12:00:00.000Z",
  "subsystems": {
    "api":          { "status": "healthy", "latencyMs": 0, "lastCheckedAt": "..." },
    "db":           { "status": "healthy", "latencyMs": 12, "lastCheckedAt": "..." },
    "redis":        { "status": "healthy", "latencyMs": 3, "lastCheckedAt": "..." },
    "eventBus":     { "status": "healthy", "latencyMs": 0, "lastCheckedAt": "...", "metadata": {...} },
    "taskRuntime":  { "status": "healthy", "latencyMs": 0, "lastCheckedAt": "...", "metadata": {...} },
    "eventStore":   { "status": "healthy", "latencyMs": 0, "lastCheckedAt": "...", "metadata": { "streamCount": 3 } },
    "pluginRuntime":{ "status": "healthy", "latencyMs": 0, "lastCheckedAt": "...", "metadata": { "total": 5, "failed": 0, "degraded": 0 } }
  }
}
```

---

## DLQ Inspection

Tasks that exceed retry limits or encounter overloaded queues are written to the dead-letter queue (DLQ). The DLQ is a separate Redis list (key: `atc:tasks:dlq`) or in-memory array.

### Listing DLQ

```
GET /api/v1/ops/tasks/dead-letter?limit=20&offset=0
```

Response:
```json
{
  "items": [ { "id": "...", "type": "...", "state": "failed", ... } ],
  "total": 42,
  "offset": 0,
  "limit": 20
}
```

### Requeuing a Task

```
POST /api/v1/ops/tasks/requeue
{ "taskId": "uuid-v4-here" }
```

- Returns `200 { taskId, requeued: true }` on success
- Returns `404 { error: "Task not found in dead-letter queue" }` if not found
- **Idempotent**: second call returns 404 (task already removed from DLQ)
- Emits `atc:task:requeued` event on success
- Increments `ops.dlq_requeues_total` telemetry counter

---

## Event Store Inspection

### Listing Events

```
GET /api/v1/ops/events?eventName=player.joined&limit=50&cursor=<opaque>
```

- `eventName` (optional) — filter to a single stream
- `limit` — max 200, default 50
- `cursor` — opaque pagination token from previous response's `nextCursor`

Response:
```json
{
  "events": [
    { "id": "uuid", "streamId": "...", "eventName": "player.joined", "source": "api", "storedAt": "..." }
  ],
  "nextCursor": "abc123" // null if no more pages
}
```

**Note:** Event summaries do not include payload — use `store.getEvent(id)` internally for full payload retrieval.

---

## Telemetry Counters

| Counter | Incremented when |
|---------|-----------------|
| `ops.health_checks_total` | Any call to `GET /ops/health` |
| `ops.health_failed_total` | Health snapshot contains any `failed` subsystem |
| `ops.dlq_requeues_total` | Task successfully requeued from DLQ |
| `ops.diagnostics_requests_total` | Any call to `GET /ops/diagnostics` |
| `ops.readiness_failed_total` | Readiness probe returns 503 |

---

## FiveM Bridge (`game/atc-core/server/ops.lua`)

```lua
-- Fetch health snapshot
ATC.Ops.GetHealth(function(ok, snapshot, err)
    if ok then
        print('Status:', snapshot.status)
    end
end)

-- Fetch diagnostics
ATC.Ops.GetDiagnostics(function(ok, diag, err)
    if ok then
        print('Active workers:', diag.taskRuntime.activeWorkers)
    end
end)

-- Get cached snapshot (no HTTP round-trip)
local health = ATC.Ops.GetCachedHealth()

-- Report bridge status (emits atc:ops:bridge:status)
ATC.Ops.ReportBridgeStatus()
```

The bridge caches incoming health snapshots pushed via `atc:ops:health:snapshot` events from the TypeScript layer.

---

## Security Constraints

- `/ops/live` and `/ops/ready` are **unauthenticated** — minimal payload, no internal details
- All other ops endpoints require Bearer token auth
- Diagnostics are **read-only** — the only mutation endpoint is `POST /ops/tasks/requeue`
- Requeue is **safe and idempotent** — removes from DLQ then re-enqueues atomically
- Plugin health exposes only: `id`, `version`, `status`, `healthStatus`, `failureCount`, `restartCount`, `lastError` (message only, no stack traces), `loadedAt`
- No player data, secrets, credentials, or database connection strings are exposed

---

## Testing

| File | Tests |
|------|-------|
| `packages/tests/src/ops-health.test.ts` | AtcHealthService unit tests (all 6 checks + getSnapshot) |
| `packages/tests/src/ops-dlq.test.ts` | DLQ inspection and requeue integration tests |
| `packages/tests/src/ops-events.test.ts` | Event store listEvents + getEvent tests |
| `apps/api/src/server.test.ts` | HTTP route tests for all ops endpoints |

---

## Troubleshooting

### Health shows `degraded` for `taskRuntime`

The scheduler is not running (`isRunning = false`). Check:
```bash
# Check if the API process is running
pm2 status atc-api

# Check task runtime start in index.ts
grep -n 'taskRuntime.start' apps/api/src/index.ts
```

### DLQ keeps growing

Tasks are being dead-lettered faster than they're requeued. Possible causes:
- Worker handler throwing unhandled exceptions
- Queue overloaded (check `maxQueueDepth` setting)
- Malformed task payload (check `TaskPayloadInvalidError` in logs)

Inspect DLQ:
```
GET /api/v1/ops/tasks/dead-letter?limit=5
```

### Redis shows `degraded` (unexpected PING response)

ioredis is connected but the Redis instance returned a non-PONG response. Check Redis AUTH configuration and replica routing.

### `GET /ops/ready` returns 503 intermittently

DB connection pool is exhausted or Redis is momentarily unavailable. Check:
- MariaDB connection pool size (`connectionLimit` in `createPool`)
- Redis connection state (`redis.status`)
- Health check timeout (default 4000ms) — tune `checkTimeoutMs` if needed
