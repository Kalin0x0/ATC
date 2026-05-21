# Phase 14 — Capability-Gated Runtime APIs & Managed Plugin Execution

**Status:** Production-ready (2026-05-16)  
**Packages:** `@atc/plugin-runtime-api`, `@atc/shared-types` (extended), `@atc/plugin-registry` (extended)  
**Tests:** 1,048 total (834 in `@atc/tests`, 214 in `@atc/api`)  
**Depends on:** `@atc/shared-types`, `@atc/plugin-registry`, `@atc/events`, `@atc/telemetry`

---

## Overview

Phase 14 establishes the controlled execution surface for all future gameplay plugins. Every plugin runs inside a frozen `AtcPluginServiceContainer` with access only to the APIs it explicitly declared in its manifest. All API calls are logged, counted, and gated — no plugin can bypass permission guards or access raw infrastructure.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                    Plugin (onSetup → onLoad → onEnable)              │
│  receives: AtcPluginServiceContainer (frozen)                        │
│            ├── eventsApi      (always present, gated per-call)       │
│            ├── telemetryApi   (always present, gated per-call)       │
│            ├── vitalsApi      (present if vitals.read/write declared) │
│            ├── inventoryApi   (present if inventory.read/write)       │
│            ├── walletApi      (present if wallet.read/write)          │
│            ├── statusEffectsApi (present if status.read/write)       │
│            ├── cleanup        (PluginCleanupManager)                  │
│            └── logger                                                │
└───────────────────────────┬──────────────────────────────────────────┘
                            │ capability checks on every call
                    ┌───────▼──────────┐
                    │ AtcPluginRegistry │  tracks apiCalls, deniedCalls
                    └───────┬──────────┘
                            │ stop → container.cleanup.dispose()
                    ┌───────▼──────────────────┐
                    │ PluginCleanupManager      │
                    │ clears timers/intervals   │
                    │ runs onCleanup callbacks  │
                    └──────────────────────────┘
```

---

## Deliverables

### 1. `packages/plugin-runtime-api`
New package. Provides:
- `createPluginServiceContainer(opts)` — factory that wires all APIs for a given plugin
- `PluginCleanupManager` — tracks timers, intervals, and cleanup callbacks; disposed on stop
- `PluginVitalsApi`, `PluginInventoryApi`, `PluginWalletApi`, `PluginStatusEffectsApi`
- `PluginEventsApi`, `PluginTelemetryApi`

### 2. `packages/shared-types` — New interfaces
- `AtcPluginServiceContainer` — frozen container given to each plugin in `onSetup`
- `AtcPluginCleanupRegistrar` — interface for scheduling managed resources
- `AtcPluginApiResult<T>` — standardized result type for all plugin API calls
- `AtcPluginExtendedMetrics` — extends snapshot with apiCalls/deniedCalls/uptimeMs/etc.
- `AtcPluginHooks.onSetup(container)` — new optional hook called before `onLoad`

### 3. `packages/plugin-registry` — Extensions
- `AtcPluginHealthMonitor.resetFailures(pluginId)` — resets failureCount and status to healthy on successful start
- `AtcPluginRegistry`: `apiCalls`, `deniedCalls`, `registeredAt` fields; `incrementApiCall/incrementDeniedCall/getApiCalls/getDeniedCalls/getUptimeMs` methods; `resetMetrics` now also clears apiCalls/deniedCalls
- `AtcPluginScopedEventBus`: added `subscribeOnce`, `unsubscribe` methods
- `AtcPluginLifecycleManager`: optional `pluginState`, `scopedEventBus`, `containerFactory` constructor options

### 4. Lifecycle Integration
On `_doStart`:
1. Check persisted `enabled` state — skip start if `enabled=false` (sets status `disabled`)
2. Build container via `containerFactory` and store it
3. Call `onSetup(container)` before `onLoad`
4. On success: `health.resetFailures(id)`, `pluginState.setEnabled(id, true)`
5. On failure: `pluginState.incrementCrashCount(id)`

On `_doStop`:
1. Run `onDisable` / `onUnload` hooks
2. Call `container.cleanup.dispose()` — clears all timers/intervals/callbacks
3. Call `scopedEventBus.cleanup(id)` — removes all event subscriptions
4. Call legacy `_cleanupFns`
5. Set status `disabled`

### 5. Metrics API Extension
`GET /api/v1/metrics/plugins` now returns `AtcPluginExtendedMetrics[]`:

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
    "lastError": null,
    "apiCalls": 1847,
    "deniedCalls": 0,
    "activeSubscriptions": 3,
    "activeTimers": 0,
    "uptimeMs": 3600000
  }
]
```

### 6. Reference Plugin — `plugins/atc-plugin-healthcheck`
Demonstrates the full `onSetup` contract:
- Declares `events.subscribe`, `events.publish`, `telemetry.write`
- Uses `container.cleanup.scheduleInterval` for periodic heartbeat (auto-cancelled on stop)
- Subscribes to `atc:plugin:started` and `atc:plugin:failed` for cross-plugin health awareness
- Records telemetry counter on enable and on each downstream failure

---

## Security Properties

| Property | Mechanism |
|----------|-----------|
| Deny-by-default | APIs return `{ ok: false, error: '...' }` on missing capability; subscription/publish throw `AtcPermissionDeniedError` |
| No raw DB access | Plugins receive only the domain API interfaces; no pool/connection exposure |
| No raw EventBus access | `eventsApi` wraps `AtcPluginScopedEventBus`; all subscriptions tracked and auto-removed on stop |
| No global mutation | Container is `Object.freeze()`'d; capabilities array is readonly |
| Crash isolation | Service APIs catch all errors and return result types; never propagate internal errors |
| Audit trail | `apiCalls` and `deniedCalls` incremented per call, surfaced in metrics |

---

## API Result Contract

All service API methods return `AtcPluginApiResult<T>`:

```typescript
// Success
{ ok: true, data: T }

// Permission denied
{ ok: false, error: 'Permission denied: vitals.write required' }

// Service error (DB, Redis, etc.)
{ ok: false, error: 'Character vitals not found' }
```

**No method throws on business errors.** Only `eventsApi.on/once` throw `AtcPermissionDeniedError` (subscribe must be caught at plugin init time).

---

## PluginCleanupManager

```typescript
// In onSetup:
container.cleanup.onCleanup(() => { /* cleanup db connection */ })
container.cleanup.scheduleTimeout(() => { triggerOnce() }, 5000)
container.cleanup.scheduleInterval(() => { heartbeat() }, 30_000)

// On stop — called automatically by lifecycle manager:
container.cleanup.dispose()
// → clearTimeout/clearInterval for all scheduled tasks
// → invokes all onCleanup callbacks in order
// → idempotent — second call is a no-op
```

---

## Plugin Authoring Example

```typescript
import type { AtcPluginHooks, AtcPluginServiceContainer } from '@atc/shared-types'

let _container: AtcPluginServiceContainer | undefined

export const hooks: AtcPluginHooks = {
  onSetup(container) {
    _container = container
    container.cleanup.scheduleInterval(() => {
      container.telemetryApi.record('heartbeat', 1, 'counter')
    }, 30_000)
  },

  async onEnable() {
    if (!_container) return
    const result = await _container.vitalsApi?.read(someCharacterId)
    if (result?.ok) {
      _container.logger.info('Vitals loaded', { data: result.data })
    }
  },

  async onDisable() {
    _container = undefined
  },
}

export const manifest = {
  id: 'my-plugin',
  version: '1.0.0',
  capabilities: ['vitals.read', 'telemetry.write'],
  dependencies: [],
}
```

---

## FiveM Bridge

`game/atc-core/server/plugins.lua` extended to cache new fields in `_runtimeStates`:

```lua
-- Available via ATC.Plugins.GetRuntime(pluginId):
local state = ATC.Plugins.GetRuntime('atc-food')
print(state.apiCalls)            -- total API calls made
print(state.deniedCalls)         -- denied (permission missing)
print(state.activeSubscriptions) -- active event subscriptions
print(state.activeTimers)        -- active timers + intervals
print(state.uptimeMs)            -- ms since registration
```

---

## Environment Variables (inherited from Phase 13)

| Variable | Default | Description |
|----------|---------|-------------|
| `ATC_PLUGIN_LIFECYCLE_TIMEOUT_MS` | `10000` | Max ms per lifecycle hook (including onSetup) |
| `ATC_PLUGIN_MAX_FAILURES` | `5` | Auto-disable threshold |

---

## Operational Checks

### Verify extended metrics endpoint
```bash
curl -H "Authorization: Bearer $ATC_API_TOKEN" http://localhost:3000/api/v1/metrics/plugins
```
Expected: JSON with `apiCalls`, `deniedCalls`, `activeSubscriptions`, `activeTimers`, `uptimeMs` fields.

### Inspect API denial rate
Check `deniedCalls > 0` for any plugin. A non-zero value means a plugin is attempting operations it wasn't granted. Review the manifest capabilities.

### Check for resource leaks
If `activeTimers > 0` for a `disabled` plugin, it means the container was not properly disposed. This should not happen — file a bug against Phase 14.

---

## Known Limitations

1. **No hot-swap for container** — `reload()` disposes and recreates the container. Any state held outside `_container` in plugin scope will be lost.
2. **Wallet API uses cash/ATC defaults** — The wallet adapter in `apps/api` hardcodes currency='ATC' and account='cash'. Plugins cannot specify per-call currency or account.
3. **Idempotency keys are timestamp-based** — Inventory add/remove and wallet operations use `Date.now()` for idempotency keys in the adapter. This is safe for sequential plugin calls but not for concurrent batch operations.
4. **statusEffectsApi generates IDs client-side** — Status effect IDs are generated as `${characterId}-${type}-${Date.now()}`. These are not UUID v7 and are not globally unique — acceptable for plugin-applied transient effects.

---

## Rollback Plan

Phase 14 adds one new package and extends existing ones. Rollback:

1. Remove `@atc/plugin-runtime-api` from `apps/api/package.json` and `packages/tests/package.json`
2. Remove `pluginLifecycle` and `scopedEventBus` from `AppContext` in `apps/api/src/context.ts`
3. Revert `apps/api/src/index.ts` — remove lifecycle/scopedEventBus/adapter wiring; remove `pluginHealth` and `pluginLifecycle` from ctx
4. Revert `apps/api/src/routes/metrics.ts` to Phase 13 version
5. Revert `packages/plugin-registry/src/lifecycle.ts` to Phase 13 version (remove containerFactory/pluginState/scopedEventBus options)
6. Revert `packages/plugin-registry/src/health.ts` — remove `resetFailures()`
7. Revert `packages/plugin-registry/src/registry.ts` — remove apiCalls/deniedCalls/registeredAt fields
8. Revert `packages/shared-types/src/plugin-registry.ts` — remove `onSetup` from AtcPluginHooks
9. Revert `packages/shared-types/src/index.ts` — remove plugin-runtime-api exports
10. Remove `packages/shared-types/src/plugin-runtime-api.ts`
11. Run `pnpm install && pnpm turbo build`

The existing 1,009 pre-Phase-14 tests are unaffected.
