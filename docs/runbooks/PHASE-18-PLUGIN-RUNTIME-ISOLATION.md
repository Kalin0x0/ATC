# Phase 18 — Plugin Runtime Isolation & Sandboxing

## Overview

Phase 18 extends the plugin system with formal per-plugin runtime containers, crash containment with exponential backoff, resource tracking, distributed plugin health broadcasting, and lifecycle management API routes.

Plugins remain deny-by-default and backwards-compatible — all existing plugins and tests continue to work. Phase 18 adds opt-in instrumentation on top.

---

## What Was Built

### 1. Extended Plugin States (`@atc/shared-types`)

`AtcPluginRuntimeStatus` in `packages/shared-types/src/plugin-registry.ts` now includes two new states:

```typescript
type AtcPluginRuntimeStatus =
  | 'registered' | 'loading' | 'active' | 'disabled'
  | 'failed' | 'unloading'
  | 'restarting'  // crash recovery in progress, waiting for backoff
  | 'stopped'     // explicitly stopped (not an error)
```

`AtcPluginHealthSnapshot` (new type):

```typescript
interface AtcPluginHealthSnapshot {
  pluginId: string
  state: AtcPluginRuntimeStatus
  healthy: boolean
  uptimeMs: number
  restartCount: number
  crashCount: number
  lastError: string | null
  lastCrashAt: string | null
  resourceUsage: AtcPluginResourceUsage
  capturedAt: string
}

interface AtcPluginResourceUsage {
  activeTimers: number
  activeIntervals: number
  activeSubscriptions: number
  activeWorkers: number
  estimatedMemoryBytes: number
}
```

---

### 2. Resource Tracker (`@atc/plugin-runtime`)

`AtcPluginResourceTracker` in `packages/plugin-runtime/src/resource-tracker.ts`:

```typescript
const tracker = new AtcPluginResourceTracker()

tracker.markStarted()              // starts uptime clock
tracker.markStopped()              // clears uptime clock

const untrack = tracker.trackTimer()     // increments activeTimers
untrack()                                // decrements

tracker.trackInterval()   // → untrack fn
tracker.trackSubscription()  // → untrack fn
tracker.trackWorker()         // → untrack fn

tracker.recordCrash('error message')  // increments crashCount, sets lastCrashAt
tracker.recordRestart()               // increments restartCount, clears startedAt
tracker.resetResources()              // zeroes timers/intervals/subscriptions/workers (not crash/restart counts)

tracker.getSnapshot()      // → ResourceSnapshot
tracker.getCrashCount()    // → number
tracker.getRestartCount()  // → number
```

Counters do not underflow below 0.

---

### 3. Plugin Container (`@atc/plugin-runtime`)

`AtcPluginContainer` in `packages/plugin-runtime/src/container.ts`:

```typescript
const container = new AtcPluginContainer(
  lifecycleManager,  // duck-typed LifecycleManagerLike
  registry,          // duck-typed PluginRegistryLike
  'my-plugin',
  {
    maxRestarts: 5,           // auto-disable after N crashes (default: 5)
    initialBackoffMs: 1_000,  // first restart delay (default: 1s)
    maxBackoffMs: 60_000,     // backoff cap (default: 60s)
    backoffMultiplier: 2,     // doubling factor (default: 2)
    telemetry,                // optional
  }
)

await container.start()        // starts plugin, resets backoff, emits plugins.active_total
await container.stop()         // stops plugin, sets status 'stopped', emits plugins.failed_total
await container.reload()       // reload via lifecycle, resets backoff, emits plugins.reload_total
await container.handleCrash(error)  // tracks crash, schedules restart with backoff
container.getHealthSnapshot()  // → AtcPluginHealthSnapshot
container.resourceTracker      // → AtcPluginResourceTracker (for direct tracking)
```

**Crash containment flow:**
1. `handleCrash(err)` increments crash counter and emits `plugins.crash_total`
2. If `crashCount >= maxRestarts` → sets status `'disabled'`, emits `plugins.auto_disabled_total` and `plugins.failed_total`
3. Otherwise → sets status `'restarting'`, schedules restart after current backoff delay
4. On restart: if start succeeds → resets backoff to `initialBackoffMs`; if fails → calls `handleCrash` again (recursive backoff)
5. `stop()` cancels any pending restart timer

**Duck-typed interfaces** (no circular dep with `@atc/plugin-registry → @atc/plugin-runtime`):
```typescript
interface LifecycleManagerLike {
  start(pluginId: string): Promise<void>
  stop(pluginId: string): Promise<void>
  reload(pluginId: string): Promise<void>
  isInflight(pluginId: string): boolean
}

interface PluginRegistryLike {
  get(pluginId: string): { status, lastError, health } | undefined
  setStatus(pluginId: string, status: AtcPluginRuntimeStatus, error?: string): void
}
```

---

### 4. Distributed Plugin State (`@atc/plugin-runtime`)

`AtcPluginDistributedState` in `packages/plugin-runtime/src/distributed.ts`:

```typescript
const distributedState = new AtcPluginDistributedState(
  redis,        // PluginDistributedRedis duck-typed interface
  'instance-1', // this node's instanceId
  60,           // health TTL in seconds (default: 60)
)

await distributedState.registerPlugin('my-plugin')
await distributedState.deregisterPlugin('my-plugin')
await distributedState.publishHealth('my-plugin', snapshot)
await distributedState.getNodesForPlugin('my-plugin')    // → string[]
await distributedState.getHealthForPlugin('my-plugin', 'instance-1')  // → AtcPluginHealthSnapshot | null
```

**Redis keys:**
- `atc:plugins:nodes:{pluginId}` — HSET, field = instanceId, value = ISO timestamp
- `atc:plugins:health:{pluginId}:{instanceId}` — SETEX TTL, value = JSON(AtcPluginHealthSnapshot)

**Fail-open:** All Redis operations swallow errors silently.

---

### 5. Plugin Ops Zod Schemas (`@atc/operations`)

```typescript
import {
  pluginRuntimeStatusSchema,
  pluginResourceUsageSchema,
  pluginHealthSnapshotSchema,
  pluginLifecycleActionSchema,
} from '@atc/operations'
```

---

### 6. Plugin Lifecycle API Routes

New endpoints under `/api/v1/ops/` (auth required):

**`GET /api/v1/ops/plugins`**

List all registered plugins with health state:
```json
{
  "total": 2,
  "plugins": [
    {
      "id": "my-plugin",
      "version": "1.0.0",
      "state": "active",
      "healthStatus": "healthy",
      "failureCount": 0,
      "restartCount": 0,
      "crashCount": 0,
      "lastError": null,
      "loadedAt": "2026-05-17T00:00:00Z",
      "uptimeMs": 5000,
      "resourceUsage": null
    }
  ]
}
```

If `pluginContainers` is set in `AppContext`, returns full `resourceUsage` and accurate `crashCount`/`restartCount`.

**`GET /api/v1/ops/plugins/:pluginId`**

Single plugin with full detail (404 if not found):
```json
{
  "id": "my-plugin",
  "version": "1.0.0",
  "capabilities": ["events.emit"],
  "dependencies": [],
  "state": "active",
  "healthStatus": "healthy",
  "failureCount": 0,
  "restartCount": 0,
  "crashCount": 0,
  "lastError": null,
  "lastCrashAt": null,
  "loadedAt": "2026-05-17T00:00:00Z",
  "uptimeMs": 5000,
  "resourceUsage": null,
  "lifecycleMetrics": { "loadTimeMs": 12, "enableTimeMs": 3, "reloadCount": 0, ... }
}
```

**`POST /api/v1/ops/plugins/:pluginId/start`**

Starts a plugin via `pluginLifecycle.start()`. Returns `{ pluginId, action: 'start', ok: true }`.
- 404 if plugin not registered
- 409 if a lifecycle operation is already in progress

**`POST /api/v1/ops/plugins/:pluginId/stop`**

Stops a plugin via `pluginLifecycle.stop()`. Returns `{ pluginId, action: 'stop', ok: true }`.

**`POST /api/v1/ops/plugins/:pluginId/restart`**

Restarts a plugin via `pluginLifecycle.reload()`. Returns `{ pluginId, action: 'restart', ok: true }`. Increments `plugins.restart_total`.

**`POST /api/v1/ops/plugins/:pluginId/reload`**

Hot-reloads a plugin via `pluginLifecycle.reload()`. Returns `{ pluginId, action: 'reload', ok: true }`. Increments `plugins.reload_total`.

---

### 7. AppContext Extension

`AppContext` gains one new optional field:

```typescript
interface AppContext {
  // ... existing fields
  pluginContainers?: Map<string, AtcPluginContainer>  // optional — per-plugin crash tracking
}
```

When `pluginContainers` is populated, the plugin ops routes return extended health data (crash counts, resource usage, uptime). When absent, routes fall back to registry data — backwards compatible.

---

### 8. FiveM Bridge — Plugin Awareness

`game/atc-core/server/ops.lua` new functions (read-only):

```lua
-- Fetch all plugins with health state
ATC.Ops.GetPlugins(function(ok, plugins, err) end)

-- Get cached plugin list (no HTTP round-trip)
ATC.Ops.GetCachedPlugins()

-- Fetch a single plugin by ID
ATC.Ops.GetPlugin(pluginId, function(ok, plugin, err) end)

-- Fetch health snapshot for a single plugin
ATC.Ops.GetPluginHealth(pluginId, function(ok, health, err) end)
```

Event handler for `atc:ops:plugins:snapshot` caches incoming plugin list snapshots pushed from the TS layer.

---

## Telemetry Counter Names (Phase 18)

| Counter | When to increment |
|---|---|
| `plugins.active_total` | On `container.start()` and `POST /start` route |
| `plugins.failed_total` | On `container.stop()` and `handleCrash` auto-disable |
| `plugins.restart_total` | On backoff restart success and `POST /restart` route |
| `plugins.reload_total` | On `container.reload()` and `POST /reload` route |
| `plugins.crash_total` | On every `handleCrash()` call |
| `plugins.auto_disabled_total` | When crash count hits `maxRestarts` threshold |

---

## Crash Containment Configuration

| Option | Default | Notes |
|---|---|---|
| `maxRestarts` | `5` | Crashes before auto-disable |
| `initialBackoffMs` | `1_000` | First restart delay |
| `maxBackoffMs` | `60_000` | Backoff ceiling |
| `backoffMultiplier` | `2` | Doubles each failed restart |

After a successful restart, backoff resets to `initialBackoffMs`.

---

## Tests Added (Phase 18)

| File | Tests | Coverage |
|---|---|---|
| `plugin-resource-tracker.test.ts` | initial state, markStarted/Stopped, trackTimer/Interval/Subscription/Worker, recordCrash, recordRestart, resetResources, getSnapshot |
| `plugin-container.test.ts` | start/stop/reload, handleCrash (below limit, at limit, auto-disable, telemetry, timer cancel, actual restart), getHealthSnapshot, backoff progression, cap |
| `plugin-distributed.test.ts` | publishHealth (key, TTL, fail-open), registerPlugin (HSET, fail-open), deregisterPlugin (HDEL, fail-open), getNodesForPlugin (list, empty, error), getHealthForPlugin (found, missing, error, key format) |
| `server.test.ts` (additions) | GET /ops/plugins (200, 401), GET /ops/plugins/:id (404, 401), POST start/stop/restart/reload (200, 401 each) |

**Total tests: 1,373** (up from 1,305 in Phase 17)
