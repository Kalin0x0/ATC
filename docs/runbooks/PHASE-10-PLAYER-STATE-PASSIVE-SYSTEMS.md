# Phase 10 — Player State Persistence & Passive Systems

**Status:** Complete  
**Date:** 2026-05-15  
**Depends on:** Phase 9 (Player State & Vitals)

---

## Overview

Phase 10 extends the Phase 9 vitals system with four additions:

1. **In-process EventBus** (`packages/events`) — typed, safe-handler-execution event bus for server-side internal communication.
2. **REST rate limiting** — Redis-backed sliding-window rate limiter on all vitals mutation endpoints (PATCH, mutate, reset). Fails-open on Redis unavailability.
3. **Structured event emission** — All three vitals mutation REST routes emit `atc:vitals:changed` with `source: 'api'`, `timestamp`, and the full updated vitals after successful DB writes.
4. **FiveM passive systems** — Character-select vitals sync (non-blocking) and server-side decay loop (disabled by default, ConVar-driven, overlap-safe).

---

## Files Added

| Path | Purpose |
|---|---|
| `packages/events/package.json` | Package manifest |
| `packages/events/tsconfig.json` | TypeScript config |
| `packages/events/src/event-bus.ts` | In-process AtcEventBus |
| `packages/events/src/index.ts` | Package exports |
| `packages/cache/src/rate-limiter.ts` | Redis INCR+EXPIRE sliding-window rate limiter |
| `packages/schemas/src/vitals-event.schema.ts` | `vitalsChangedEventSchema`, `vitalsDecayConfigSchema` |
| `game/atc-core/server/decay.lua` | Server-side decay loop |
| `packages/tests/src/event-bus.test.ts` | EventBus unit tests |
| `packages/tests/src/vitals-rate-limiter.test.ts` | RateLimiter unit tests |

---

## Files Modified

| Path | Change |
|---|---|
| `packages/shared-types/src/vitals.ts` | Added `AtcVitalsEventSource`, `AtcVitalsDecayConfig`; updated `AtcVitalsChangedEvent` with `source`, `timestamp`, `metadata` |
| `packages/shared-types/src/index.ts` | Re-exported new vitals types |
| `packages/schemas/src/index.ts` | Exported vitals event and decay schemas |
| `packages/cache/src/index.ts` | Exported `RateLimiter`, `RateLimitResult` |
| `apps/api/src/config.ts` | Added `vitals.mutationRateLimit`, `vitals.mutationRateWindowSeconds` |
| `apps/api/src/context.ts` | Added `eventBus: AtcEventBus`, `vitalsRateLimiter: RateLimiter` |
| `apps/api/src/index.ts` | Wired `AtcEventBus`, `RateLimiter` into ctx |
| `apps/api/src/routes/vitals.ts` | Rate limit check + `atc:vitals:changed` emit on PATCH/mutate/reset |
| `apps/api/package.json` | Added `@atc/events` dependency |
| `apps/api/tsconfig.json` | Added `packages/events` reference |
| `packages/tests/package.json` | Added `@atc/events` dependency |
| `packages/tests/tsconfig.json` | Added `packages/events` reference |
| `apps/api/src/server.test.ts` | Added 12 Phase 10 tests (rate limiting + event emission) |
| `game/atc-core/server/characters.lua` | Non-blocking vitals sync after `ATC.Characters.Select()` |
| `game/atc-core/fxmanifest.lua` | Added `'server/decay.lua'` to server_scripts |
| `packages/locales/locales/en.json` | Added 5 `vitals.*` localization keys |
| `packages/locales/locales/de.json` | Added 5 `vitals.*` localization keys |
| `packages/locales/locales/fa.json` | Added 5 `vitals.*` localization keys |

---

## EventBus (`packages/events`)

### Interface

```typescript
import { AtcEventBus } from '@atc/events'

const bus = new AtcEventBus()

// Register handler
bus.on('atc:vitals:changed', (payload) => { ... })

// One-time handler
bus.once('atc:vitals:changed', (payload) => { ... })

// Remove handler
bus.off('atc:vitals:changed', handler)

// Emit (returns result with failures array)
const result = await bus.emit('atc:vitals:changed', payload)
// result.handlersInvoked — count of handlers invoked
// result.failures        — array of { error } for each failed handler
```

### Safety properties

- One handler failure **does not** abort other handlers — each is wrapped in try/catch
- `emit()` never throws — it returns `AtcEventEmitResult` with a `failures[]` array
- Async handlers are awaited sequentially; a rejection is caught and added to failures
- No Redis pub/sub — fully in-process, zero external dependency

---

## REST Rate Limiting

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `ATC_VITALS_MUTATION_RATE_LIMIT` | `60` | Max mutations per character per window |
| `ATC_VITALS_MUTATION_RATE_WINDOW_SECONDS` | `60` | Window duration in seconds |

### Affected endpoints

| Method | Path | Rate limited |
|---|---|---|
| `GET` | `/api/v1/vitals/character/:characterId` | No (read-only) |
| `PATCH` | `/api/v1/vitals/character/:characterId` | Yes |
| `POST` | `/api/v1/vitals/character/:characterId/mutate` | Yes |
| `POST` | `/api/v1/vitals/character/:characterId/reset` | Yes |

### 429 response

```json
{ "error": "Rate limit exceeded", "retryAfterSeconds": 42 }
```

The `Retry-After` HTTP header is also set to the remaining TTL in seconds.

### Fail-open

If Redis is unavailable, `RateLimiter.check()` catches the error and returns `{ allowed: true }`. Requests are never blocked due to a Redis outage.

### Redis key format

```
atc:ratelimit:vitals:mutation:{characterId}
```

---

## Event Emission

After every successful vitals mutation (DB write confirmed), routes emit:

```typescript
{
  characterId: string           // character affected
  source: 'api'                 // always 'api' from REST routes
  timestamp: string             // ISO8601 UTC, e.g. '2026-05-15T17:00:00.000Z'
  changed?: Partial<Record<AtcVitalName, number>>  // fields changed (PATCH/mutate only)
  vitals: AtcCharacterVitals    // full vitals state after mutation
}
```

Event name: `atc:vitals:changed`

**Guarantees:**
- Emitted **only** after DB write succeeds
- Never emitted on 400 (validation failure), 403 (inactive character), 404 (not found), or 429 (rate limit)
- `emit()` failure is non-fatal — logged at `warn` level, route still returns 200

Lua-side mutations (via `ATC.Vitals.Patch/Mutate`) already emit `TriggerEvent(ATC.Events.VITALS.CHANGED, ...)` independently, using `source: 'lua'` by convention.

---

## FiveM: Character Select Vitals Sync

After `ATC.Characters.Select()` completes (session updated), a non-blocking vitals sync is fired:

```lua
SetTimeout(0, function()
    local ok, err = pcall(ATC.Vitals.Sync, source)
    if not ok then
        ATC.Log.Warn('characters', 'Vitals sync failed after character select', {
            source = source, characterId = characterId, err = tostring(err),
        })
    end
end)
```

`SetTimeout(0, ...)` defers to the next FiveM tick, ensuring the callback is not blocked. `pcall` isolates failures so a vitals API error does not prevent character selection from completing.

---

## FiveM: Decay Loop (`game/atc-core/server/decay.lua`)

### ConVars

| ConVar | Default | Description |
|---|---|---|
| `atc_vitals_decay_enabled` | `0` | Set to `1` to enable |
| `atc_vitals_decay_interval_seconds` | `300` | Decay tick interval (minimum 1) |
| `atc_vitals_decay_hunger` | `1` | Hunger decrement per tick (0-100) |
| `atc_vitals_decay_thirst` | `2` | Thirst decrement per tick (0-100) |
| `atc_vitals_decay_stamina` | `0` | Stamina decrement per tick (0-100) |
| `atc_vitals_decay_stress` | `0` | Stress increment per tick (0-100) |

### server.cfg example

```
set atc_vitals_decay_enabled 1
set atc_vitals_decay_interval_seconds 300
set atc_vitals_decay_hunger 1
set atc_vitals_decay_thirst 2
set atc_vitals_decay_stamina 0
set atc_vitals_decay_stress 0
```

### Behavior

- Auto-starts on `onResourceStart` — reads ConVars at startup and at each tick
- Overlap prevention: `_isRunning` flag prevents concurrent ticks (e.g. if a tick takes longer than the interval)
- Per-player isolation: a `pcall` around each player prevents one error from stopping the full tick
- Decay applies only to players with an active character selected (`ATC.Characters.GetSelectedId` must return non-nil)
- Mutations are fire-and-forget (`ATC.Vitals.Mutate` with `nil` callback)
- SQL GREATEST/LEAST clamping in `mutate()` handles already-zero hunger gracefully
- ConVar changes take effect on the next tick without restart

### Stopping the loop

Set `atc_vitals_decay_enabled` to `0`. The loop checks the ConVar at each tick and self-terminates if disabled.

---

## New Schemas

### `vitalsChangedEventSchema`

```typescript
import { vitalsChangedEventSchema } from '@atc/schemas'

const result = vitalsChangedEventSchema.safeParse(event)
```

Validates: `characterId`, `source` (enum), `timestamp` (ISO datetime), optional `changed`, `vitals` (full vitals object), optional `metadata`.

### `vitalsDecayConfigSchema`

```typescript
import { vitalsDecayConfigSchema } from '@atc/schemas'

const result = vitalsDecayConfigSchema.safeParse(config)
```

Validates: `enabled` (boolean), `intervalSeconds` (1–3600), and all four decay amounts (0–100 integer each).

---

## Localization Keys Added

| Key | en |
|---|---|
| `vitals.sync_failed` | Failed to sync vitals after character select. |
| `vitals.decay_started` | Vitals decay loop started. |
| `vitals.decay_stopped` | Vitals decay loop stopped. |
| `vitals.rate_limited` | Too many vitals requests. Please wait before trying again. |
| `vitals.event_emitted` | Vitals change event emitted. |

All three locales updated: `en.json`, `de.json`, `fa.json`.

---

## Validation Commands

```bash
# Install dependencies
pnpm install

# Type-check all packages
pnpm turbo typecheck

# Build all packages
pnpm turbo build

# Run full test suite
pnpm turbo test

# Run only Phase 10 tests
pnpm --filter @atc/tests test -- --reporter=verbose event-bus vitals-rate-limiter
pnpm --filter @atc/api test -- --reporter=verbose
```

---

## Test Coverage Summary

| Test file | Tests | What it covers |
|---|---|---|
| `packages/tests/src/event-bus.test.ts` | 22 | on/off/once, emit, handler isolation, failure collection |
| `packages/tests/src/vitals-rate-limiter.test.ts` | 14 | allowed/blocked, expire-on-first, fail-open, key format, reset |
| `apps/api/src/server.test.ts` (Phase 10 additions) | 12 | 429 on PATCH/mutate/reset, event emission on success, no emit on validation fail or 429 |

**Total tests: 697 — all pass.**

---

## Security Properties

- Rate limiter is keyed per-character — one character cannot use another's quota
- Rate limiter fails-open (Redis down = requests pass through) to avoid availability impact
- `Retry-After` header set on 429 so clients can backoff correctly
- Event emission is fire-and-forget after DB write — never blocks the HTTP response
- Decay loop mutations go through the same `ATC.Vitals.Mutate()` path with full server-side validation and LEAST/GREATEST clamping
- Decay is server-side only — no client ConVar or client event can trigger or modify decay

---

## Known Remaining Risks

1. **Decay mutations have no rate limit** — Decay calls `ATC.Vitals.Mutate` which hits the REST API. If `atc_vitals_decay_interval_seconds` is set very low (e.g., 1s) on a high-population server, this could trigger REST rate limits for those characters. Minimum safe interval at 60 req/60s budget: `interval_seconds ≥ 1` per player, but consider headroom for manual mutations. Document in server.cfg guidance.
2. **EventBus has no persistence or replay** — Handlers that register after an event fires miss it. This is by design for Phase 10 (in-process only). Redis pub/sub or NATS fanout is Phase 11+.
3. **No EventBus wiring for Lua-sourced changes** — Lua CHANGED events are FiveM TriggerEvent-based. They do not reach the TypeScript EventBus. Cross-boundary EventBus bridging is Phase 11+.
4. **Decay config is read-only at startup ConVar** — ConVar changes mid-session require the resource to be restarted before the loop restarts. Dynamic live reload of the loop is out of scope.

---

## Phase 10 Hardening (2026-05-15)

### Bugs Fixed

| ID | File | Description |
|---|---|---|
| BUG-10-1 | `game/atc-core/server/characters.lua` | `pcall(ATC.Vitals.Sync, source)` evaluated `ATC.Vitals.Sync` before pcall could protect it — nil `ATC.Vitals` escaped pcall. Fixed to `pcall(function() ATC.Vitals.Sync(source) end)`. |
| BUG-10-2 | `apps/api/src/config.ts` | `optionalInt` accepted 0 and negatives for rate limit config. `mutationRateLimit = 0` blocks all requests; `mutationRateWindowSeconds = 0` makes Redis `EXPIRE` a no-op. Added `positiveInt()` helper that throws on non-positive values. |
| BUG-10-3 | `packages/cache/src/rate-limiter.ts` + `apps/api/src/routes/vitals.ts` | Redis fail-open was silent. Added `error?: unknown` to `RateLimitResult`; vitals route now logs `warn` when failing open. |
| BUG-10-4 | `game/atc-core/server/decay.lua` | No `onResourceStop` handler — pending `SetTimeout` callbacks could fire after the resource was unloaded. Added `_stopped` flag set on `onResourceStop`, checked at each tick entry. |

### Tests Added

| File | Count | What it covers |
|---|---|---|
| `apps/api/src/server.test.ts` | +2 | No event emitted on 404 (character not found), no event emitted on 403 (inactive character) |
| `packages/tests/src/event-bus.test.ts` | +1 | `once()` handler is removed even when the async handler rejects |

**Total after hardening: 700 tests — all pass.**

### Config Validation Notes

`ATC_VITALS_MUTATION_RATE_LIMIT` and `ATC_VITALS_MUTATION_RATE_WINDOW_SECONDS` now throw at startup if set to 0 or a non-positive value. The API process will not start with invalid rate-limit config. Valid range: any positive integer ≥ 1.

### Decay Loop Resource-Stop Safety

The decay loop sets `_stopped = true` on `onResourceStop`. Any pending `SetTimeout` callback that fires after the resource stops returns immediately without ticking or re-scheduling. The `_stopped` flag is module-local and does not reset across resource restarts; the resource must be started fresh for the loop to run again.

---

## Phase 10 Scope Constraints (Permanent)

The following must not be added to this system without a new Phase:

- Client-side decay or client vitals mutation events
- Combat damage integration — Phase 12+
- EMS / medical revival — Phase 12+
- Status effects / buffs / debuffs — Phase 11+
- UI/NUI HUD rendering — Phase 11+
- Redis pub/sub or NATS EventBus fanout — Phase 11+
- Decay for health or armor — Phase 12+ (combat integration required)
