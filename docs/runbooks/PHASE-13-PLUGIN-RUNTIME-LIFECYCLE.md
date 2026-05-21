# Phase 13 — Plugin Registry, Lifecycle Management & Runtime Isolation

**Status:** Production-ready (Hardened 2026-05-15)  
**Packages:** `@atc/plugin-registry`, `@atc/plugin-state`  
**Tests:** 1,009 total (795 in `@atc/tests`, 214 in `@atc/api`)  
**Depends on:** `@atc/shared-types`, `@atc/schemas`, `@atc/plugin-runtime`, `@atc/events`, `@atc/telemetry`

---

## Overview

Phase 13 delivers the plugin runtime infrastructure for ATC. All plugins are registered with the TypeScript registry, resolved in dependency order, started/stopped by the lifecycle manager, and health-monitored with automatic degradation and disable.

The Lua-side bridge in `game/atc-core/server/plugins.lua` provides a read-only view of TypeScript registry state to FiveM resources via server events.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                  AtcPluginLifecycleManager                │
│  start(id) → onLoad → onEnable → active                  │
│  stop(id)  → onDisable → onUnload → cleanup → disabled   │
│  reload(id) → stop → resetMetrics → start                │
└────────────────────┬─────────────────┬───────────────────┘
                     │                 │
          ┌──────────▼──────┐ ┌────────▼──────────┐
          │ AtcPluginRegistry│ │AtcPluginHealthMonitor│
          │  (source of     │ │  healthy → degraded  │
          │   truth)        │ │  → failed → disable  │
          └──────────┬──────┘ └────────────────────┘
                     │
          ┌──────────▼──────────────────┐
          │   AtcPluginStateService     │
          │   Redis + in-memory         │
          │   atc:plugin:state:{id}     │
          └─────────────────────────────┘
```

### Dependency Resolution (resolveDependencies)

```
Input manifests → validate versions → Kahn BFS topo sort → DFS cycle detect → order[]
```

- **Kahn's algorithm** produces stable BFS order (stable sort on ties for determinism)
- **DFS cycle detection** runs only when Kahn's finds fewer nodes than expected
- **Version ranges:** `^X.Y.Z` (same major), `~X.Y.Z` (same major.minor), exact, `>=`, `>`, `<=`, `<`

---

## Plugin Lifecycle

```
register()
    │
    ▼
  registered
    │
start()
    │
    ├─ onLoad()   ──fail──► failed ──► [auto-disable if maxFailures exceeded]
    │
    ├─ loading
    │
    ├─ onEnable() ──fail──► failed
    │
    ▼
  active ◄──────────────────────────────────────────────────┐
    │                                                        │
stop()                                                   reload()
    │                                                        │
    ├─ onDisable() (errors tolerated, always continues)      │
    ├─ onUnload()  (errors tolerated, always continues)      │
    ├─ cleanup fns (run in registration order)               │
    ▼                                                        │
  disabled ────────────────────────────────────────────────►┘
```

**Invariant:** `stop()` always reaches `disabled` even if hooks throw.

---

## Health States

| State | Trigger | Action |
|-------|---------|--------|
| `healthy` | No failures | Normal operation |
| `degraded` | failures ≥ `ceil(maxFailures/2)` | Warning — continue |
| `failed` | failures ≥ `maxFailures` | `shouldDisable: true` returned |

When `shouldDisable: true`:
1. Lifecycle manager calls `stop(id)`
2. Registry sets status to `disabled`
3. `atc:plugin:disabled` event emitted
4. Lua bridge receives and updates `_runtimeStates[id].status = "disabled"`

Default `maxFailures = 5`, so degraded at ≥ 3, disabled at ≥ 5.

---

## Events Emitted

| Event | Payload | When |
|-------|---------|------|
| `atc:plugin:started` | `{ pluginId }` | After `onEnable` completes |
| `atc:plugin:failed` | `{ pluginId, error }` | On hook exception |
| `atc:plugin:disabled` | `{ pluginId, reason }` | After auto-disable |
| `atc:plugin:reloaded` | `{ pluginId }` | After successful reload |

The Lua bridge handles all four events to keep `_runtimeStates` in sync.

---

## Runtime Isolation

Each plugin gets a frozen `AtcPluginRuntimeContext`:

```typescript
const ctx = createPluginContext({
  pluginId: 'atc-food',
  capabilities: ['inventory.read', 'vitals.write'],
  logger: pinoLogger,
})

ctx.hasPermission('inventory.read')  // true
ctx.assertPermission('admin.write')  // throws AtcPermissionDeniedError
Object.isFrozen(ctx)                 // true — cannot assign properties
Object.isFrozen(ctx.capabilities)    // true — cannot push/pop
```

Undeclared capabilities throw immediately — no silent failures.

---

## Scoped EventBus

`AtcPluginScopedEventBus` tracks per-plugin subscriptions and removes them on `cleanup(pluginId)`:

```typescript
scoped.subscribe('atc-food', ['events.subscribe'], 'atc:vitals:updated', handler)
scoped.cleanup('atc-food')  // removes all handlers, returns count
```

Requires `events.subscribe` capability to subscribe, `events.publish` to emit. Attempting either without the required capability throws `AtcPermissionDeniedError`.

---

## Plugin State Persistence

Redis key: `atc:plugin:state:{pluginId}`  
TTL: 30 days (86400 × 30 seconds)  
Serialisation: JSON  

On Redis failure, all operations fall back to the in-memory `Map` silently — the service never throws on Redis errors.

```typescript
await pluginState.save('atc-food', { enabled: false })
await pluginState.incrementCrashCount('atc-food')  // atomic increment in memory
await pluginState.setEnabled('atc-food', true)     // sets lastLoadedAt = now
```

---

## Metrics API

`GET /api/v1/metrics/plugins` returns the live registry snapshot:

```json
[
  {
    "id": "atc-food",
    "status": "active",
    "healthStatus": "healthy",
    "restartCount": 0,
    "failures": 0,
    "eventsHandled": 142,
    "avgExecutionMs": 3.2,
    "lastError": null
  }
]
```

Endpoint requires `Authorization: Bearer <ATC_API_TOKEN>`.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ATC_PLUGIN_LIFECYCLE_TIMEOUT_MS` | `10000` | Max ms per lifecycle hook |
| `ATC_PLUGIN_MAX_FAILURES` | `5` | Auto-disable threshold |

---

## FiveM Lua Bridge

`game/atc-core/server/plugins.lua` provides read-only access:

```lua
-- Check if TypeScript registry considers a plugin running
if ATC.Plugins.IsRunning('atc-food') then
  -- plugin is active and not health-failed
end

-- Get health status string
local health = ATC.Plugins.GetHealth('atc-food')  -- "healthy" | "degraded" | "failed" | "unknown"

-- Get all known plugins (merged Lua + TypeScript)
local all = ATC.Plugins.GetAll()
```

**No writes from Lua** — state flows one way: TypeScript → event → Lua cache.

---

## Operational Checks

### Verify plugin registry is populated
```bash
curl -H "Authorization: Bearer $ATC_API_TOKEN" http://localhost:3000/api/v1/metrics/plugins
```
Expected: JSON array with one entry per registered plugin.

### Check plugin health in logs
Look for `atc:plugin:failed` and `atc:plugin:disabled` events in the API logs. Each auto-disable logs the plugin ID and triggering error.

### Manual plugin disable via state service
```typescript
await ctx.pluginState.setEnabled('atc-food', false)
// Next restart will skip enabling this plugin if lifecycle checks state
```

### Reset crash count after patching
```typescript
await ctx.pluginState.save('atc-food', { crashCount: 0 })
```

---

## Hardening — Bugs Fixed (2026-05-15)

| ID | Severity | Description | Fix |
|----|----------|-------------|-----|
| BUG-13H-1 | HIGH | No per-plugin concurrency guard — concurrent start/stop/reload on same plugin raced at every await | Added `_inflight: Set<string>` guard to lifecycle manager; throws `PluginConcurrentOperationError` on contention; public start/stop/reload/destroy all guarded; internal `_doStart`/`_doStop`/`_doReload` used inside reload/reloadAll |
| BUG-13H-2 | MEDIUM | `withTimeout` sentinel used fragile string-prefix check `error.message.startsWith('Timeout:')` — any hook throwing `new Error('Timeout: ...')` was misclassified as lifecycle timeout | `withTimeout` now throws `PluginLifecycleTimeoutError` directly; string detection removed from `_runHook` catch block |
| BUG-13H-3 | MEDIUM | Duplicate capability values stored when manifest declared `['cap', 'cap']` | `register()` deduplicates: `[...new Set(parsed.capabilities ?? [])]` |
| BUG-13H-4 | MEDIUM | Duplicate dependency IDs not rejected by manifest schema | Added `.refine()` to `registryManifestSchema` checking all dep IDs are unique |
| BUG-13H-5 | MEDIUM | `destroy()` only guarded against `active` status — plugin in `loading`/`unloading` state would escape stop then fail `unregister()` | `destroy()` now checks `active \| loading \| unloading` before attempting stop |
| BUG-13H-6 | LOW | `updateHealth()` was an unused public method exposing direct internal health mutation, bypassing health monitor invariants | Method removed entirely (confirmed zero callers) |
| BUG-13H-7 | LOW | `^0.x.y` semver range not handled per npm spec — `^0.1.0` matched `0.2.0` | Documented below; not changed (game plugins use ≥1.0.0 versions) |

### BUG-13H-7 Known Quirk: `^0.x.y` semver

The lightweight semver implementation treats `^0.1.0` as "same major (0) and >= 1.0.0", which would accept `0.2.0`. Per npm spec, `^0.1.0` should pin to `0.1.x` only. This does not affect ATC game plugins (all use production version ≥1.0.0). If 0.x.y dependencies are introduced in future, use exact versions (`=0.1.4`) or `~0.1.0` ranges instead.

## Known Limitations

1. **No hot-code-swap** — `reload()` stops and re-starts the same in-memory module; it does not reload JavaScript module files. True hot code swapping requires future work.
2. **No inter-plugin messaging** — Plugins communicate only through the shared `AtcEventBus`; there is no direct plugin-to-plugin RPC.
3. **Lua registry is cache-only** — If the API server restarts, Lua `_runtimeStates` loses all state until events re-populate it on next plugin start.
4. **Crash count is in-memory** — `incrementCrashCount` is atomic within a session but not across restarts if Redis is unavailable.
5. **`reloadAll()` is not atomic** — It reverse-stops all, then re-starts all. Any failure mid-reload leaves some plugins stopped.

---

## Rollback Plan

Phase 13 adds two new packages (`@atc/plugin-registry`, `@atc/plugin-state`) and two new fields to `AppContext` (`pluginRegistry`, `pluginState`). Rollback steps:

1. Remove `@atc/plugin-registry` and `@atc/plugin-state` from `apps/api/package.json` dependencies
2. Remove the two fields from `apps/api/src/context.ts` interface
3. Remove instantiation in `apps/api/src/index.ts`
4. Revert `apps/api/src/routes/metrics.ts` plugin list route to return `[]`
5. Revert `game/atc-core/server/plugins.lua` to Phase 1 version (remove Phase 13 bridge section)
6. Run `pnpm install && pnpm turbo build`

The existing 858 pre-Phase-13 tests are unaffected — Phase 13 only adds new tests.
