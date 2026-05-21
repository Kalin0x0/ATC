# Phase 30 — Vehicle Runtime, Persistence & Operational Mobility Foundation

## Overview

Phase 30 implements the persistent vehicle lifecycle system for ATC. Every vehicle in the world has a database-backed identity, a state machine controlling its lifecycle, and optional live runtime telemetry when spawned.

**Agent 1 scope only.** Analytics, MDT aggregation, reporting, correlation, and intelligence systems are owned by Agent 2 and are not built here.

---

## Package: `@atc/vehicle-runtime`

Location: `packages/vehicle-runtime/`

### Files

| File | Purpose |
|------|---------|
| `src/pool.ts` | Duck-typed DB pool interface |
| `src/id.ts` | Monotonic ULID generator |
| `src/errors.ts` | 13 domain error classes |
| `src/vehicle.repository.ts` | Vehicle CRUD + state transition |
| `src/vehicle-runtime.repository.ts` | Spawned runtime record CRUD |
| `src/garage.repository.ts` | Garage storage/retrieval records |
| `src/impound.repository.ts` | Impound records + evidence hold |
| `src/fleet.repository.ts` | Fleet assignment records |
| `src/vehicle-runtime.service.ts` | Lifecycle orchestration (main service) |
| `src/garage.service.ts` | Garage query service |
| `src/impound.service.ts` | Impound query service |
| `src/fleet.service.ts` | Fleet assignment service + events |
| `src/index.ts` | Barrel exports |

---

## State Machine

```
         ┌───────────────────────────────────────────────┐
         │                   stored                       │◄──────────────────┐
         │     (default on registration, after repair,    │                   │
         │      after release from impound)               │                   │
         └─────────────────────────────┬─────────────────┘                   │
                                       │                                      │
                            spawn() / retrieve()                         release() / repair()
                                       │                                      │
                                       ▼                                      │
         ┌───────────────────────────────────────────────┐                   │
         │                  spawned                       │──────────────────►│
         │     (vehicle entity exists in game world)      │                   │
         └──────────────┬────────────────────────────────┘                   │
                        │                                                     │
              setActive (heartbeat)                                  impound()│
                        │                                                     │
                        ▼                                                     ▼
         ┌───────────────────────────────────────────────┐      ┌────────────┴──────────┐
         │                  active                        │      │       impounded        │
         │     (vehicle driven, heartbeats confirmed)     │      │  (in impound lot)      │
         └──────────────┬────────────────────────────────┘      └───────────────────────┘
                        │
                   destroy()
                        │
                        ▼
         ┌───────────────────────────────────────────────┐
         │                 destroyed                      │
         │   (vehicle blown up / total loss)              │
         └───────────────────────────────────────────────┘
```

### Allowed Transitions

| From | To | Method |
|------|-----|--------|
| stored | spawned | `spawn()` or `retrieve()` |
| stored | impounded | `impound()` |
| spawned | active | `syncRuntime()` (heartbeat) |
| spawned | stored | `store()` |
| spawned | impounded | `impound()` |
| spawned | destroyed | `destroy()` |
| active | spawned | (engine off / idle) |
| active | stored | `store()` |
| active | impounded | `impound()` |
| active | destroyed | `destroy()` |
| impounded | stored | `release()` |
| destroyed | stored | `repair()` |

---

## Database Migrations

| Migration | Table | Key Notes |
|-----------|-------|-----------|
| `064_create_vehicles.sql` | `atc_vehicles` | ENUM status/category, UNIQUE plate+vin |
| `065_create_vehicle_runtime.sql` | `atc_vehicle_runtime` | UNIQUE(vehicle_id) — duplicate spawn prevention |
| `066_create_vehicle_garages.sql` | `atc_vehicle_garages` | Storage log, compound index on (vehicle_id, retrieved_at) |
| `067_create_vehicle_impounds.sql` | `atc_vehicle_impounds` | evidence_hold TINYINT(1), ENUM reason |
| `068_create_vehicle_fleet_assignments.sql` | `atc_vehicle_fleet_assignments` | compound index on (vehicle_id, unassigned_at) |

---

## API Routes

| Method | Path | Capability | Description |
|--------|------|-----------|-------------|
| POST | `/api/v1/vehicles` | `vehicle:register` | Register new vehicle |
| GET | `/api/v1/vehicles/:vehicleId` | `vehicle:read` | Get vehicle + runtime |
| POST | `/api/v1/vehicles/:vehicleId/spawn` | `vehicle:spawn` | Spawn (direct, not from garage) |
| POST | `/api/v1/vehicles/:vehicleId/retrieve` | `vehicle:retrieve` | Retrieve from garage (atomic) |
| POST | `/api/v1/vehicles/:vehicleId/store` | `vehicle:store` | Store in garage |
| POST | `/api/v1/vehicles/:vehicleId/impound` | `vehicle:impound` | Impound vehicle |
| POST | `/api/v1/vehicles/:vehicleId/release` | `vehicle:impound` | Release from impound |
| PATCH | `/api/v1/vehicles/:vehicleId/runtime` | `vehicle:sync` | Sync runtime telemetry |
| GET | `/api/v1/garages` | `vehicle:read` | List all garages |
| GET | `/api/v1/garages/:garageId/vehicles` | `vehicle:read` | List vehicles in garage |
| GET | `/api/v1/vehicles/:vehicleId/impounds` | `vehicle:impound` | Impound history |
| POST | `/api/v1/fleet/assign` | `vehicle:fleet` | Assign vehicle to org/principal |
| DELETE | `/api/v1/fleet/assignments/:assignmentId` | `vehicle:fleet` | Unassign |
| GET | `/api/v1/fleet/organizations/:organizationId` | `vehicle:fleet` | Active fleet for org |

---

## EventBus Events

All events are fire-and-forget (`.catch(() => undefined)` pattern) to avoid blocking lifecycle transitions.

| Event Key | Constant | Payload |
|-----------|----------|---------|
| `atc:vehicle:spawned` | `ATC_VEHICLE_EVENTS.VEHICLE_SPAWNED` | `{ vehicleId, spawnedByPrincipalId, fromGarage? }` |
| `atc:vehicle:stored` | `ATC_VEHICLE_EVENTS.VEHICLE_STORED` | `{ vehicleId, storedByPrincipalId, garageId }` |
| `atc:vehicle:impounded` | `ATC_VEHICLE_EVENTS.VEHICLE_IMPOUNDED` | `{ vehicleId, impoundedByPrincipalId, reason }` |
| `atc:vehicle:released` | `ATC_VEHICLE_EVENTS.VEHICLE_RELEASED` | `{ vehicleId, releasedByPrincipalId }` |
| `atc:vehicle:destroyed` | `ATC_VEHICLE_EVENTS.VEHICLE_DESTROYED` | `{ vehicleId, principalId }` |
| `atc:vehicle:fleet:assigned` | `ATC_VEHICLE_EVENTS.FLEET_ASSIGNED` | `{ assignmentId, vehicleId, organizationId, principalId, assignedByPrincipalId }` |
| `atc:vehicle:fleet:unassigned` | `ATC_VEHICLE_EVENTS.FLEET_UNASSIGNED` | `{ assignmentId, vehicleId, unassignedByPrincipalId }` |

---

## Concurrency Design

### Duplicate Spawn Prevention

The `atc_vehicle_runtime` table has `UNIQUE KEY uq_vrt_vehicle (vehicle_id)`. Any attempt to INSERT a second runtime record for the same vehicle raises `ER_DUP_ENTRY`, which is caught and re-thrown as `VehicleAlreadySpawnedError`. No separate SELECT guard needed.

### Atomic Retrieve (garage + spawn)

`VehicleRuntimeService.retrieve()` opens a single transaction on a dedicated connection:
1. `SELECT ... FOR UPDATE` on `atc_vehicles` to lock the vehicle row
2. `garageRepo.retrieve()` with the shared connection — marks the garage record retrieved within the same transaction
3. `INSERT INTO atc_vehicle_runtime` within the same transaction
4. `UPDATE atc_vehicles SET status = 'stored'` 
5. `COMMIT`

This prevents a race where two concurrent retrieve calls both see the garage record as active.

### Fleet Double-Assignment Prevention

`FleetRepository.assign()` opens a transaction, acquires `SELECT ... FOR UPDATE` on existing active assignments for the vehicle, then throws `FleetAssignmentConflictError` if any exist before proceeding to INSERT.

### Impound Evidence Hold

`ImpoundRepository.release()` reads the active impound record with `FOR UPDATE`, checks `evidenceHold`, and throws `EvidenceHoldError` before any UPDATE proceeds. The evidence hold can only be cleared by a separate administrative workflow (Agent 2 scope or admin API).

---

## FiveM Bridge

Location: `game/atc-core/server/vehicles.lua`

### SDK Functions

| Function | Description |
|----------|-------------|
| `ATC.Vehicles.Register(source, params, cb)` | Register vehicle into system |
| `ATC.Vehicles.Get(source, vehicleId, cb)` | Get vehicle + runtime state |
| `ATC.Vehicles.Spawn(source, vehicleId, coords, heading, cb)` | Spawn vehicle directly |
| `ATC.Vehicles.Retrieve(source, vehicleId, garageId, coords, heading, cb)` | Retrieve from garage |
| `ATC.Vehicles.Store(source, vehicleId, garageId, snapshot, cb)` | Store in garage |
| `ATC.Vehicles.Impound(source, vehicleId, params, cb)` | Impound vehicle |
| `ATC.Vehicles.Release(source, vehicleId, params, cb)` | Release from impound |
| `ATC.Vehicles.SyncRuntime(vehicleId, state, cb)` | Sync runtime telemetry |
| `ATC.Vehicles.ListGarages(cb)` | List all garages |
| `ATC.Vehicles.ListGarageVehicles(garageId, cb)` | List vehicles in garage |
| `ATC.Vehicles.FleetAssign(source, params, cb)` | Assign to org/principal |
| `ATC.Vehicles.FleetUnassign(source, assignmentId, cb)` | Unassign from fleet |

### Registered Server Events

| Event | Description |
|-------|-------------|
| `atc:vehicle:store:request` | Client-triggered store flow |
| `atc:vehicle:retrieve:request` | Client-triggered retrieve flow |
| `atc:vehicle:runtime:sync` | Periodic server-side runtime sync |

**Security:** All principal IDs resolved server-side via `ATC.Accounts.GetPrincipalId(source)`. Runtime sync coordinates are sanitized with `tonumber()` before forwarding to the API.

---

## Operational Runbook

### Find all active spawned vehicles

```sql
SELECT v.id, v.plate, v.model, v.status, r.x, r.y, r.z, r.last_heartbeat_at
FROM atc_vehicles v
JOIN atc_vehicle_runtime r ON r.vehicle_id = v.id
ORDER BY r.last_heartbeat_at DESC;
```

### Find vehicles with stale heartbeats (>5 min)

```sql
SELECT v.id, v.plate, r.last_heartbeat_at,
       TIMESTAMPDIFF(MINUTE, r.last_heartbeat_at, NOW()) AS stale_minutes
FROM atc_vehicles v
JOIN atc_vehicle_runtime r ON r.vehicle_id = v.id
WHERE r.last_heartbeat_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE)
ORDER BY r.last_heartbeat_at ASC;
```

### Check impound lot (active, non-released)

```sql
SELECT v.plate, v.model, i.reason, i.evidence_hold, i.fee,
       i.impounded_by_principal_id, i.impounded_at
FROM atc_vehicle_impounds i
JOIN atc_vehicles v ON v.id = i.vehicle_id
WHERE i.released_at IS NULL
ORDER BY i.impounded_at DESC;
```

### Check evidence-held vehicles

```sql
SELECT v.plate, v.model, i.notes, i.impounded_at
FROM atc_vehicle_impounds i
JOIN atc_vehicles v ON v.id = i.vehicle_id
WHERE i.released_at IS NULL AND i.evidence_hold = 1;
```

### Garage occupancy by garage

```sql
SELECT g.garage_id, COUNT(*) AS vehicle_count
FROM atc_vehicle_garages g
JOIN atc_vehicles v ON v.id = g.vehicle_id
WHERE g.retrieved_at IS NULL AND v.status = 'stored'
GROUP BY g.garage_id
ORDER BY vehicle_count DESC;
```

### Current fleet assignments for an organization

```sql
SELECT fa.id, v.plate, v.model, fa.role, fa.principal_id, fa.expires_at, fa.assigned_at
FROM atc_vehicle_fleet_assignments fa
JOIN atc_vehicles v ON v.id = fa.vehicle_id
WHERE fa.organization_id = ? AND fa.unassigned_at IS NULL
ORDER BY fa.assigned_at DESC;
```

### Clean up orphaned runtime records (after server crash)

```sql
-- Identify orphaned runtime records where vehicle is not in spawned/active state
SELECT r.vehicle_id, v.status
FROM atc_vehicle_runtime r
JOIN atc_vehicles v ON v.id = r.vehicle_id
WHERE v.status NOT IN ('spawned', 'active');

-- Clean up (verify first):
-- DELETE r FROM atc_vehicle_runtime r
-- JOIN atc_vehicles v ON v.id = r.vehicle_id
-- WHERE v.status NOT IN ('spawned', 'active');
```

---

## Security Checklist

- [x] No client-trusted values — all principal IDs resolved server-side via `ATC.Accounts.GetPrincipalId(source)`
- [x] Runtime coordinates sanitized with `tonumber()` in FiveM bridge before API forwarding
- [x] UNIQUE constraint on `atc_vehicle_runtime.vehicle_id` prevents duplicate spawns at the DB layer
- [x] Fleet double-assignment prevented with `SELECT FOR UPDATE` in transaction
- [x] Impound evidence hold enforced with `FOR UPDATE` + check before any release
- [x] Capability guards on all write routes (`vehicle:register`, `vehicle:spawn`, etc.)
- [x] Input validated with Zod schemas at API boundary
- [x] All lifecycle transitions validated via state machine (`ALLOWED_TRANSITIONS` map)
- [x] No direct SQL in service layer — all DB access through repository layer
- [x] Fire-and-forget event emission with `.catch(() => undefined)` to prevent blocked transactions

---

## Agent Scope Boundary

This phase (Agent 1) delivers the **operational write side** of vehicle management:
- Vehicle registration, lifecycle state machine, runtime sync
- Garage storage/retrieval with atomic locking
- Impound creation/release with evidence hold enforcement
- Fleet assignment/unassignment with double-assignment prevention
- EventBus event emission for downstream consumers

**Agent 2 owns (DO NOT BUILD):**
- MDT vehicle read-models and search indexes
- Vehicle intelligence aggregation and correlation
- Analytics dashboards and reporting projections
- Historical timeline reconstructions
- Investigation tools cross-referencing vehicles to entities
