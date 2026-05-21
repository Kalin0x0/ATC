# Phase 69 — Autonomous Runtime Continuity, Infinite Persistence & Temporal Recovery

## Overview

Phase 69 introduces runtime continuity tracking, temporal recovery (point-in-time rollback), world-state checkpointing, infinite persistence node management, and temporal integrity validation. The `TemporalIntegrityRecoveryService` serves dual purpose: CRUD for integrity records and fan-out stale cleanup.

**Package:** `@atc/continuity-runtime`  
**API prefix:** `/api/v1/continuity`  
**FiveM event namespace:** `atc:continuity:*`

---

## Services

| Service | Responsibility |
|---|---|
| `ContinuityRuntimeService` | Lifecycle of runtime continuity records |
| `TemporalRecoveryService` | Point-in-time recovery sessions |
| `RuntimeCheckpointCoordinator` | World-state checkpoint creation and commit/rollback |
| `InfinitePersistenceService` | Persistence node upsert and failure marking |
| `DistributedContinuityService` | Replica-perspective view of persistence nodes |
| `TemporalIntegrityRecoveryService` | Integrity records + fan-out cleanup across all domains |

---

## Database Tables

| Table | Purpose |
|---|---|
| `atc_runtime_continuity` | Continuity session records |
| `atc_temporal_recovery` | Recovery sessions (includes `target_timestamp`) |
| `atc_checkpoint_runtime` | World-state checkpoints |
| `atc_infinite_persistence` | Persistence nodes (upsert-keyed by `node_id`) |
| `atc_temporal_integrity` | Integrity validation records |
| `atc_continuity_audit` | Append-only audit log |

Migrations: `295_create_runtime_continuity.sql` through `300_create_continuity_audit.sql`

---

## API Endpoints

### Continuity
| Method | Path | Action |
|---|---|---|
| POST | `/api/v1/continuity` | Create continuity |
| POST | `/api/v1/continuity/:id/suspend` | Suspend |
| POST | `/api/v1/continuity/:id/terminate` | Terminate |
| POST | `/api/v1/continuity/:id/fail` | Fail |
| GET | `/api/v1/continuity/:id` | Fetch |

### Temporal Recovery
| Method | Path | Action |
|---|---|---|
| POST | `/api/v1/continuity/recovery` | Initiate recovery |
| POST | `/api/v1/continuity/recovery/:id/begin` | Begin recovering |
| POST | `/api/v1/continuity/recovery/:id/complete` | Complete |
| POST | `/api/v1/continuity/recovery/:id/fail` | Fail |
| GET | `/api/v1/continuity/recovery/:id` | Fetch |

The `targetTimestamp` field in the request body is accepted as an ISO 8601 string and converted to `Date` internally.

### Checkpoints
| Method | Path | Action |
|---|---|---|
| POST | `/api/v1/continuity/checkpoint` | Create checkpoint |
| POST | `/api/v1/continuity/checkpoint/:id/commit` | Commit |
| POST | `/api/v1/continuity/checkpoint/:id/rollback` | Rollback |
| GET | `/api/v1/continuity/checkpoint/:id` | Fetch |

### Persistence Nodes
| Method | Path | Action |
|---|---|---|
| POST | `/api/v1/continuity/persistence` | Upsert node |
| POST | `/api/v1/continuity/persistence/:nodeId/fail` | Mark failed (204) |
| GET | `/api/v1/continuity/persistence/:nodeId` | Fetch by nodeId |

### Temporal Integrity
| Method | Path | Action |
|---|---|---|
| POST | `/api/v1/continuity/temporal-integrity` | Create integrity record |
| POST | `/api/v1/continuity/temporal-integrity/:id/repair` | Repair |
| POST | `/api/v1/continuity/temporal-integrity/:id/validate` | Validate |
| GET | `/api/v1/continuity/temporal-integrity/:id` | Fetch |

### Cleanup
| Method | Path | Action |
|---|---|---|
| POST | `/api/v1/continuity/cleanup` | Cleanup stale records |

---

## FiveM Events

```lua
-- Continuity lifecycle
TriggerEvent('atc:continuity:create', { continuityType='entity', ownerServerId='server-1', continuityNonce='nonce-1' }, cb)
TriggerEvent('atc:continuity:suspend', id, cb)
TriggerEvent('atc:continuity:terminate', id, cb)
TriggerEvent('atc:continuity:fail', id, cb)

-- Recovery
TriggerEvent('atc:continuity:recovery:initiate', { recoveryType='point_in_time', ownerServerId='server-1', recoveryNonce='nonce-1' }, cb)
TriggerEvent('atc:continuity:recovery:begin', id, cb)
TriggerEvent('atc:continuity:recovery:complete', id, cb)
TriggerEvent('atc:continuity:recovery:fail', id, cb)

-- Checkpoints
TriggerEvent('atc:continuity:checkpoint:create', { checkpointType='world', ownerServerId='server-1', checkpointNonce='nonce-1' }, cb)
TriggerEvent('atc:continuity:checkpoint:commit', id, cb)
TriggerEvent('atc:continuity:checkpoint:rollback', id, cb)

-- Persistence nodes
TriggerEvent('atc:continuity:persistence:upsert', { nodeId='NODE_001', nodeType='primary', ownerServerId='server-1' }, cb)
TriggerEvent('atc:continuity:persistence:fail', nodeId, cb)  -- returns bool (status 204)

-- Temporal integrity
TriggerEvent('atc:continuity:temporal_integrity:create', { integrityType='epoch', ownerServerId='server-1', integrityNonce='nonce-1' }, cb)
TriggerEvent('atc:continuity:temporal_integrity:repair', id, cb)

-- Cleanup fires automatically every 5 minutes
TriggerEvent('atc:continuity:cleanup', 300000)
```

---

## Status Flows

**Continuity:** `active` → `suspended` / `terminated` / `failed`

**Recovery:** `pending` → `recovering` → `completed` / `failed`

**Checkpoint:** `pending` → `committed` / `rolled_back`

**Persistence node:** `active` → `failed` (via `failNode`)

**Temporal integrity:** `unknown` → `repaired` / `valid`

---

## Idempotency

Continuity, recovery, and checkpoint records enforce `UNIQUE(nonce, owner_server_id)`. Persistence nodes are upserted via `ON DUPLICATE KEY UPDATE` keyed by `node_id`.

---

## DistributedContinuityService

This service is a second facade over `InfinitePersistenceRepository`, providing a replica-centric API:

- `upsertContinuityNode` → delegates to `persistenceRepo.upsert`
- `failContinuityNode` → delegates to `persistenceRepo.failNode`
- `getContinuityNode` → delegates to `persistenceRepo.findByNodeId`

Both `InfinitePersistenceService` and `DistributedContinuityService` share the same underlying repository and table.

---

## Cleanup

`TemporalIntegrityRecoveryService.cleanupStale(thresholdMs)` fans out across all five domains concurrently. Returns `{ continuities, recoveries, checkpoints, persistenceNodes, temporalIntegrities }`.

Triggered automatically in FiveM every 5 minutes. Manual trigger: `POST /api/v1/continuity/cleanup` with `{ thresholdMs: number }`.

---

## Operational Notes

- `TemporalIntegrityRecoveryService` is constructed with all five repos plus audit and bus — it is both the cleanup coordinator and the temporal integrity CRUD service.
- `targetTimestamp` in recovery records is stored as `DATETIME(3) NULL`.
- The `validate` action on temporal integrity transitions to `valid` without setting a `repairedAt` timestamp; `repair` sets `repairedAt = NOW()`.
- All writes are audited to `atc_continuity_audit` before emitting bus events.
