# Phase 12 Runbook — Plugin Runtime, Telemetry & Distributed Reliability

## Overview

Phase 12 adds three orthogonal capabilities to ATC:

1. **Plugin capability isolation** — every plugin declares its permissions at registration; the runtime enforces them at call-time and logs all denials.
2. **EventBus metrics + distributed envelope** — the in-process event bus tracks counters and timing; Redis pub/sub messages carry a UUID envelope that prevents cross-node echo.
3. **Telemetry foundation** — a lightweight, non-blocking in-memory telemetry registry exposed via three read-only HTTP endpoints.

None of these features are on the hot path for gameplay. All are designed to fail silently so a telemetry or permission-denial error cannot cascade into player-facing downtime.

---

## Plugin Permission Model

### Capability list (13 total)

| Capability | Scope |
|---|---|
| `inventory.read` | Read character inventory |
| `inventory.write` | Modify character inventory |
| `vitals.read` | Read character vitals |
| `vitals.write` | Mutate character vitals |
| `status.read` | Read status effects |
| `status.write` | Apply / clear status effects |
| `wallet.read` | Read wallet balances |
| `wallet.write` | Credit / debit wallets |
| `events.publish` | Publish to EventBus |
| `events.subscribe` | Subscribe to EventBus |
| `telemetry.write` | Write telemetry metrics |
| `admin.read` | Read admin data |
| `admin.write` | Mutate admin data |

Wildcard `*` is **explicitly rejected**. Unknown capability strings throw at construction time.

### Deny-by-default

A plugin with no declared capabilities passes every `hasPermission()` check as `false`. You cannot accidentally grant a capability; you must opt in explicitly.

### Guard API

```typescript
import { AtcPluginPermissionGuard, AtcPermissionDeniedError } from '@atc/plugin-runtime'

const guard = new AtcPluginPermissionGuard(['inventory.read', 'events.publish'])

guard.hasPermission('inventory.read')       // true
guard.hasPermission('admin.write')          // false
guard.assertPermission('my-plugin', 'admin.write') // throws AtcPermissionDeniedError
guard.assertAnyPermission('my-plugin', ['vitals.read', 'inventory.read']) // passes (has inventory.read)
guard.list()  // ['events.publish', 'inventory.read'] — deduped, sorted
```

### Runtime API (wraps guard, tracks metrics, logs denials)

```typescript
import { AtcPluginRuntime } from '@atc/plugin-runtime'

const runtime = new AtcPluginRuntime({
  pluginId: 'atc-economy',
  capabilities: ['wallet.read', 'wallet.write', 'events.publish'],
  logger: pinoInstance,  // optional — warnings go here on denial
})

runtime.assertPermission('wallet.write')   // no-op if allowed
runtime.trackEventPublished()              // manual metric bump
runtime.getMetrics()
// { pluginId, eventsPublished, eventsSubscribed, permissionDeniedCount, registeredAt }
```

### Plugin manifest schema (Zod)

`@atc/schemas` exports `atcPluginCapabilitySchema` (Zod enum of all 13 caps) and `atcPluginManifestSchema` which now includes an optional `capabilities` array validated against that enum.

---

## EventBus Reliability

### Metrics

`AtcEventBus` accepts an optional options object:

```typescript
const bus = new AtcEventBus({ metricsEnabled: true })  // default
const bus = new AtcEventBus({ metricsEnabled: false })  // disable for testing
```

`bus.getMetrics()` returns:

```typescript
{
  emittedTotal: number      // total emit() calls
  handledTotal: number      // successful handler invocations
  failedTotal: number       // handlers that threw or rejected
  avgDurationMs: number     // rolling average dispatch time per emit()
  activeSubscribers: number // total registered handlers right now
  metricsEnabled: boolean
}
```

Timing uses `performance.now()` (global in Node.js 22, sub-millisecond resolution). When `metricsEnabled: false`, counters stay 0 and no timing is recorded.

### Distributed envelope (Redis bridge)

Every message published via `AtcRedisEventBridge` is wrapped in an envelope:

```typescript
{
  eventId: string      // UUIDv4 — unique per publish
  sourceNodeId: string // identifies the originating API node
  emittedAt: string    // ISO 8601
  eventName: string
  payload: unknown
}
```

**Self-loop prevention:** if an incoming envelope's `sourceNodeId` matches the local node's ID, the message is silently dropped. This prevents double-dispatch on the originating node when it is both publisher and subscriber.

**Fail-open policy:** if `sourceNodeId` is missing from the envelope, the message is delivered (safety > correctness for malformed metadata).

### Node ID configuration

Set `ATC_NODE_ID` to uniquely identify each API instance. Default is `'atc-api-1'`.

```env
# apps/api/.env
ATC_NODE_ID=atc-api-node-1   # node 1
ATC_NODE_ID=atc-api-node-2   # node 2
```

In multi-node deployments every node **must** have a distinct `ATC_NODE_ID`, otherwise self-loop prevention will incorrectly drop messages from peer nodes that share the same ID.

---

## Telemetry Foundation

### Service

```typescript
import { AtcTelemetryService } from '@atc/telemetry'

const svc = new AtcTelemetryService()

svc.counter('atc_eventbus_emitted_total', { event: 'vitals' })  // +1 or create at 1
svc.increment('atc_eventbus_emitted_total', 5)                  // add 5
svc.gauge('atc_status_effects_active', 42)                      // set to 42
svc.observe('atc_handler_duration_ms', 3.7)                     // record histogram value

svc.get('atc_eventbus_emitted_total')   // { name, kind, value, updatedAt } copy — mutations are safe
svc.snapshot()                          // { metrics: [...], capturedAt } — full copy
svc.reset('atc_eventbus_emitted_total') // remove single metric
svc.clear()                             // remove all metrics
```

Labels create separate metric series. Label keys are sorted for stable identity:
- `counter('foo', { a: '1', b: '2' })` and `counter('foo', { b: '2', a: '1' })` refer to the same series.

### FiveM bridge (`game/atc-core/server/telemetry.lua`)

The Lua telemetry bridge tracks:
- `player_count` — current active players
- `active_characters` — characters with an active session
- `inventory_operations` — inventory add/remove/move calls
- `vitals_mutations` — vitals patch calls
- `status_effect_count` — active status effects

All Lua calls are wrapped in `pcall` and fail silently. Exposed API:

```lua
ATC.Telemetry.Increment('inventory_operations', 1)
ATC.Telemetry.GetSnapshot()  -- returns { metrics = {...}, capturedAt = '...' }
```

---

## Metrics API Endpoints

All three endpoints require Bearer token auth (same `ATC_API_SECRET` as all other routes).

### `GET /api/v1/metrics/eventbus`

Returns EventBus counters and timing:

```json
{
  "emittedTotal": 1042,
  "handledTotal": 2078,
  "failedTotal": 3,
  "avgDurationMs": 0.14,
  "activeSubscribers": 8,
  "metricsEnabled": true
}
```

### `GET /api/v1/metrics/plugins`

Returns per-plugin runtime metrics (currently returns empty list; populated once plugin registration is wired in Phase 13):

```json
{ "plugins": [] }
```

### `GET /api/v1/metrics/runtime`

Returns process-level health:

```json
{
  "uptimeSeconds": 3600,
  "memoryUsage": {
    "heapUsedBytes": 45876224,
    "heapTotalBytes": 67108864,
    "rssBytes": 98304000,
    "externalBytes": 1048576
  },
  "activeRateLimits": 0,
  "redisConnected": true
}
```

No secrets, credentials, connection strings, or internal config values are returned.

---

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `ATC_NODE_ID` | `atc-api-1` | Identity for Redis bridge self-loop guard |
| `ATC_EVENTBUS_REDIS_ENABLED` | `false` | Enable Redis pub/sub bridge |
| `ATC_EVENTBUS_METRICS_ENABLED` | `true` | Enable EventBus counters/timing |

---

## Operational Checks

### After deploy

```bash
# Verify metrics endpoint responds
curl -H "Authorization: Bearer $ATC_API_SECRET" http://localhost:3000/api/v1/metrics/runtime

# Confirm each node has a unique ID in logs
grep '"nodeId"' /var/log/atc-api.log | head -5

# Check EventBus counters are incrementing
curl -H "Authorization: Bearer $ATC_API_SECRET" http://localhost:3000/api/v1/metrics/eventbus
```

### Multi-node Redis bridge

Each node must have a unique `ATC_NODE_ID`. Verify by checking that the `sourceNodeId` field in Redis messages differs per node:

```bash
redis-cli subscribe 'atc:events:*'
# Watch for sourceNodeId values — should vary across nodes
```

### Permission denial alerts

Permission denials log at `warn` level with structured fields:

```json
{ "pluginId": "atc-combat", "capability": "admin.write", "msg": "plugin permission denied" }
```

Set up a log alert on `"plugin permission denied"` to catch plugins operating outside their declared capabilities.

---

## Known Limitations

1. **Plugin registry not wired.** `GET /api/v1/metrics/plugins` always returns `[]`. Per-plugin `AtcPluginRuntime` instances need to be registered in a central store (Phase 13 work).
2. **Telemetry not persisted.** All metrics reset on process restart. Phase 13 should flush to Redis or Prometheus on a schedule.
3. **FiveM → API telemetry push not implemented.** The Lua bridge collects metrics locally; no HTTP flush to the API server yet.
4. **`avgDurationMs` is a simple rolling average**, not a histogram. High-variance handler timing will not be visible through this single value.
5. **`ATC_EVENTBUS_REDIS_ENABLED=false` by default.** Redis pub/sub is opt-in; single-node deployments can leave it off.

---

## Rollback

Phase 12 is purely additive:
- The two new packages (`@atc/plugin-runtime`, `@atc/telemetry`) have no mandatory callers.
- `AtcEventBus` constructor changes are backward-compatible (`new AtcEventBus()` still works).
- `AtcRedisEventBridge` constructor changes are backward-compatible (`new AtcRedisEventBridge(redis)` still works).
- The three metrics endpoints are new routes; removing `metricsRoutes` registration from `server.ts` disables them cleanly.

To revert: remove the `metricsRoutes` registration from `apps/api/src/server.ts` and uninstall `@atc/plugin-runtime` and `@atc/telemetry` from consumers. The EventBus and bridge will continue to function without metrics collection.
