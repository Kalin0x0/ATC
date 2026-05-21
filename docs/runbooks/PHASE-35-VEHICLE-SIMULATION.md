# PHASE-35: Vehicle Simulation & Traffic Runtime
## Operations Runbook

**Package:** `@atc/vehicle-simulation`
**Scope:** Agent 1 (write-side runtime only)
**Status:** Production

---

## Overview

Phase 35 introduces a dedicated vehicle simulation runtime package, distinct from `@atc/vehicle-runtime`. It owns the write-side lifecycle for fuel, damage, registrations, traffic violations, and pursuits. All game-side interaction is brokered through the FiveM bridge at `game/atc-core/server/vehicle_runtime.lua` (namespace `ATC.VehicleRuntime`).

---

## Architecture

### Services

| Service | Responsibility |
|---|---|
| `VehicleSimulationService` | Orchestrates sub-services; owns the boot sequence |
| `FuelRuntimeService` | Per-vehicle fuel consumption and refuel |
| `DamageRuntimeService` | Damage state sync and delta application |
| `TrafficControlService` | Violation recording and payment marking |
| `RegistrationRuntimeService` | Registration lifecycle and bulk expiry |
| `PursuitRuntimeService` | Active pursuit creation, transition, and stale cleanup |

### Repositories

| Repository | Table | Migration ID |
|---|---|---|
| `FuelRepository` | `atc_vehicle_fuel` | 091 |
| `DamageRuntimeRepository` | `atc_vehicle_damage_runtime` | 092 |
| `RegistrationRepository` | `atc_vehicle_registrations` | 093 |
| `TrafficViolationRepository` | `atc_vehicle_traffic_violations` | 094 |
| `PursuitRepository` | `atc_vehicle_pursuits` | 095 |
| `RuntimeMetricsRepository` | `atc_vehicle_runtime_metrics` | 096 |

### API Surface

Base path: `/api/v1/vehicles/runtime/*`

All endpoints require server-side identity validation. No client-supplied vehicle IDs are trusted without cross-referencing the session.

---

## State Machines

### Pursuit

```
         ┌──────────────────────────────┐
         │           active             │
         └──────┬──────────┬───────┬───┘
                │          │       │
             ended      escaped  terminated
         (terminal)  (terminal) (terminal)
```

- Only `active` pursuits accept state transition calls.
- `ALLOWED_TRANSITIONS` guard in `PursuitRuntimeService.endPursuit` enforces the above.
- Attempts to transition from a terminal state throw `InvalidPursuitTransitionError`.

### Registration

```
         ┌──────────────────────────────┐
         │           active             │
         └──────┬──────────┬───────┬───┘
                │          │       │
            expired    suspended  revoked
         (terminal)  (terminal) (terminal)
```

- Bulk expiry (`processExpiredRegistrations`) sweeps rows where `expires_at < NOW()` and status is `active`.
- Each expired registration emits `atc:vehicle:registration:expired` on the EventBus.

---

## Key Invariants

| Domain | Invariant |
|---|---|
| Fuel | Level is clamped `[0, capacity]` on every write. `FuelTankEmptyError` is thrown — not silently zeroed — when consumption would go below 0. |
| Fuel | Refuel uses `LEAST(current + delta, capacity)` so overflow is impossible at DB level. |
| Damage | Sync is idempotent via `ON DUPLICATE KEY UPDATE`. |
| Damage | Delta math applied server-side; component JSON merged before write. |
| Registration | Plate uniqueness enforced by `UNIQUE KEY uq_vehicle_registrations_plate`. `ER_DUP_ENTRY` is mapped to `VehicleRegistrationAlreadyActiveError`. |
| Pursuit | Nonce uniqueness enforced by `UNIQUE KEY uq_pursuit_nonce`. Duplicate start raises `PursuitAlreadyActiveError`. |
| Metrics | Top speed uses `GREATEST(top_speed, ?)` in the atomic `UPDATE` — never regresses within a session. |

---

## Concurrency Model

### Locking Strategy

| Operation | Lock | Reason |
|---|---|---|
| `FuelRuntimeService.consume` | `SELECT … FOR UPDATE` on fuel row | Prevent negative fuel from concurrent ticks |
| `PursuitRuntimeService.startPursuit` | `SELECT … FOR UPDATE` on entity row | Anti-duplication — active check before insert |
| `PursuitRuntimeService.endPursuit` | `SELECT … FOR UPDATE` on pursuit row | Guard `ALLOWED_TRANSITIONS` check atomically |
| `DamageRuntimeService.applyDamage` | `SELECT … FOR UPDATE` on damage row | Delta math requires read-modify-write safety |

### Idempotency

- Fuel and damage **sync** paths (heartbeat data from client) use `INSERT … ON DUPLICATE KEY UPDATE` — safe to replay.
- Metrics heartbeat uses `UPDATE … SET top_speed = GREATEST(top_speed, ?)` — idempotent under duplication.
- EventBus emits on terminal transitions are fire-and-forget with `.catch(() => undefined)`; callers must not rely on delivery confirmation.

### Transaction Scope

All `FOR UPDATE` operations execute inside an explicit DB transaction scoped to the service method. Repositories do not open their own transactions; they accept an optional `connection` parameter from the service layer.

---

## EventBus Integration

| Event | Trigger | Payload |
|---|---|---|
| `atc:vehicle:pursuit:started` | `PursuitRuntimeService.startPursuit` succeeds | `{ pursuitId, vehicleId, officerId, nonce }` |
| `atc:vehicle:pursuit:ended` | `PursuitRuntimeService.endPursuit` transitions to terminal | `{ pursuitId, vehicleId, outcome: 'ended' \| 'escaped' \| 'terminated' }` |
| `atc:vehicle:registration:expired` | `RegistrationRuntimeService.processExpiredRegistrations` per row | `{ registrationId, vehicleId, plate, expiredAt }` |

All emits are non-blocking (`EventBus.emit(…).catch(() => undefined)`). Downstream consumers (dispatch, MDT) are Agent 2 scope and must not be referenced here.

---

## FiveM Bridge

**File:** `game/atc-core/server/vehicle_runtime.lua`
**Namespace:** `ATC.VehicleRuntime`

Exposed Lua API:

```lua
ATC.VehicleRuntime.SyncFuel(vehicleNetId, level)
ATC.VehicleRuntime.ConsumeFuel(vehicleNetId, delta)    -- throws on empty tank
ATC.VehicleRuntime.Refuel(vehicleNetId, amount)
ATC.VehicleRuntime.SyncDamage(vehicleNetId, components)
ATC.VehicleRuntime.ApplyDamage(vehicleNetId, delta)
ATC.VehicleRuntime.StartPursuit(vehicleNetId, officerServerId, nonce)
ATC.VehicleRuntime.EndPursuit(pursuitId, outcome)      -- outcome: ended|escaped|terminated
ATC.VehicleRuntime.RecordViolation(vehicleNetId, violationType, metadata)
ATC.VehicleRuntime.Heartbeat(vehicleNetId, metricsPayload)
```

The bridge calls the TypeScript API over the internal HTTP loopback. It does **not** hold DB connections directly.

Event whitelist (server events accepted from clients — none; all triggers are server-initiated via `TriggerEvent` from trusted Lua):

```lua
-- No client→server events in this package.
-- All inputs arrive via NUI callbacks routed through the game server.
```

---

## Diagnostics

### Health Check

```
GET /api/v1/vehicles/runtime/health
```

Returns service registry status, DB pool size, and last metrics heartbeat timestamp per vehicle class.

### Common Errors

| Error | Cause | Resolution |
|---|---|---|
| `FuelTankEmptyError` | Consumption delta exceeds current level | Normal gameplay; caller should stop vehicle movement |
| `VehicleRegistrationAlreadyActiveError` | `ER_DUP_ENTRY` on plate insert | Deduplicate upstream; check for double registration calls |
| `PursuitAlreadyActiveError` | Nonce collision or duplicate `startPursuit` call | Verify bridge is not firing duplicate events; check nonce generation |
| `InvalidPursuitTransitionError` | Attempt to transition from terminal state | Check pursuit lifecycle upstream; may indicate stale state in Lua bridge |
| DB pool exhaustion | High vehicle density + many concurrent `FOR UPDATE` locks | Tune pool size in `@atc/db` config; review tick rates for sync operations |

### Stale Pursuit Cleanup

`PursuitRuntimeService.cleanStale` is intended to run on a scheduled interval (recommended: every 5 minutes via cron or server startup hook). It terminates pursuits with `updated_at < NOW() - INTERVAL 30 MINUTE` and status `active`. This prevents orphaned records from dead server sessions.

```lua
-- Trigger from Lua scheduled task:
ATC.VehicleRuntime.CleanStalePursuits()
```

### Metrics Heartbeat

`RuntimeMetricsRepository` records per-vehicle session metrics (distance, top speed, idle time). The atomic `UPDATE … GREATEST` pattern means heartbeat flooding does not corrupt top-speed records. If metrics rows are missing, verify the `atc_vehicle_runtime_metrics` table migration 096 has run.

### Log Tags

All service logs use structured fields:

```
service=vehicle-simulation domain=fuel|damage|registration|pursuit|violation|metrics
vehicle_id=<uuid> pursuit_id=<uuid> plate=<string>
```

Filter in Loki/Grafana using `{service="vehicle-simulation"}`.

---

## Agent Scope Boundary

**Agent 1 owns (this runbook):**
- Write-side runtime: fuel, damage, pursuit, registration, violations, metrics heartbeat
- FiveM bridge (`ATC.VehicleRuntime`)
- EventBus emission (fire-and-forget)
- API routes under `/api/v1/vehicles/runtime/*`

**Agent 2 owns (out of scope here):**
- Analytics and reporting dashboards
- MDT aggregation views
- Predictive pursuit or violation systems
- Read-side projections and event consumers
- Any downstream processing of `atc:vehicle:pursuit:*` or `atc:vehicle:registration:expired` events

Do not add Agent 2 concerns to this package. Cross-agent communication is exclusively via EventBus contracts defined in `packages/events`.
