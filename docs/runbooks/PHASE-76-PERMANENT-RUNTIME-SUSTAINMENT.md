# Phase 76 — ATC Core Permanent Runtime Stability, Infinite Recovery & Long-Term Autonomous Sustainment

## Overview

Phase 76 is the final sustainment layer of ATC's runtime infrastructure. It provides infinite recovery coordination, autonomous maintenance scheduling, distributed sustainment node management, and long-term runtime longevity checkpointing. Records in this phase represent the ongoing operational health and permanent stability of the ATC platform.

**Package:** `@atc/runtime-sustainment`
**API prefix:** `/api/v1/runtime-sustainment`
**Migrations:** 337–342

---

## Architecture

### Services

| Service | Context field | Purpose |
|---|---|---|
| `RuntimeSustainmentService` | `runtimeSustainmentService` | Orchestrate sustainment lifecycle |
| `InfiniteRecoveryCoordinator` | `infiniteRecoveryCoordinator` | Coordinate infinite recovery operations |
| `AutonomousMaintenanceService` | `autonomousMaintenanceService` | Schedule and track autonomous maintenance |
| `DistributedSustainmentService` | `distributedSustainmentService` | Manage distributed sustainment node cluster |
| `RuntimeLongevityService` | `runtimeLongevityService` | Create and archive longevity checkpoints |
| `SustainmentRecoveryService` | `sustainmentRecoveryService` | Stale-record cleanup across all repos |

### Tables

| Table | Key column | Cleanup states |
|---|---|---|
| `atc_runtime_sustainment` | `sustainment_id` | `completed`, `failed` |
| `atc_infinite_recovery` | `recovery_id` (UPSERT) | `completed`, `failed` |
| `atc_autonomous_maintenance` | `maintenance_id` | `completed`, `failed`, `skipped` |
| `atc_distributed_sustainment` | `sustainment_node_id` (UPSERT) | `offline`, `failed` |
| `atc_runtime_longevity` | `longevity_id` | `archived`, `expired`, `failed` |
| `atc_sustainment_audit` | — (append-only) | never |

---

## State Machines

### RuntimeSustainment
```
pending → active → maintaining → completed
                               → failed
       → failed
```

### InfiniteRecovery (UPSERT)
```
active → recovering → completed
                    → failed
```

### AutonomousMaintenance
```
pending → running → completed
                  → failed
                  → skipped
```

### DistributedSustainment (UPSERT)
```
active → degraded → recovering → active
       → offline
       → failed
```

### RuntimeLongevity
```
pending → active → archived
               → expired
               → failed
```

---

## API Endpoints

### Runtime Sustainment
- `POST /api/v1/runtime-sustainment` — initiate sustainment
- `POST /api/v1/runtime-sustainment/:id/start`
- `POST /api/v1/runtime-sustainment/:id/maintain`
- `POST /api/v1/runtime-sustainment/:id/complete`
- `POST /api/v1/runtime-sustainment/:id/fail`
- `GET  /api/v1/runtime-sustainment/:id`

### Infinite Recovery
- `POST /api/v1/runtime-sustainment/recovery` — initiate recovery (UPSERT by recoveryId)
- `POST /api/v1/runtime-sustainment/recovery/:recoveryId/begin`
- `POST /api/v1/runtime-sustainment/recovery/:recoveryId/complete`
- `POST /api/v1/runtime-sustainment/recovery/:recoveryId/fail`
- `GET  /api/v1/runtime-sustainment/recovery/:recoveryId`

### Autonomous Maintenance
- `POST /api/v1/runtime-sustainment/maintenance` — schedule maintenance
- `POST /api/v1/runtime-sustainment/maintenance/:id/run`
- `POST /api/v1/runtime-sustainment/maintenance/:id/complete`
- `POST /api/v1/runtime-sustainment/maintenance/:id/skip`
- `GET  /api/v1/runtime-sustainment/maintenance/:id`

### Distributed Sustainment Nodes
- `POST /api/v1/runtime-sustainment/node` — register node (UPSERT by sustainmentNodeId)
- `POST /api/v1/runtime-sustainment/node/:sustainmentNodeId/degrade`
- `POST /api/v1/runtime-sustainment/node/:sustainmentNodeId/recover`
- `POST /api/v1/runtime-sustainment/node/:sustainmentNodeId/fail`
- `GET  /api/v1/runtime-sustainment/node/:sustainmentNodeId`

### Runtime Longevity
- `POST /api/v1/runtime-sustainment/longevity` — create checkpoint
- `POST /api/v1/runtime-sustainment/longevity/:id/activate`
- `POST /api/v1/runtime-sustainment/longevity/:id/archive`
- `POST /api/v1/runtime-sustainment/longevity/:id/expire`
- `GET  /api/v1/runtime-sustainment/longevity/:id`

### Cleanup
- `POST /api/v1/runtime-sustainment/cleanup` — body: `{ "thresholdMs": 300000 }`

---

## FiveM Events

Events registered in `game/atc-core/server/runtime_sustainment.lua`.

| Event | Action |
|---|---|
| `atc:sustainment:initiate` | Initiate sustainment |
| `atc:sustainment:start` | Start sustainment |
| `atc:sustainment:maintain` | Set maintaining state |
| `atc:sustainment:complete` | Complete sustainment |
| `atc:sustainment:fail` | Fail sustainment |
| `atc:sustainment:recovery:initiate` | Initiate recovery |
| `atc:sustainment:recovery:begin` | Begin recovering |
| `atc:sustainment:recovery:complete` | Complete recovery |
| `atc:sustainment:recovery:fail` | Fail recovery |
| `atc:sustainment:maintenance:schedule` | Schedule maintenance |
| `atc:sustainment:maintenance:run` | Run maintenance |
| `atc:sustainment:maintenance:complete` | Complete maintenance |
| `atc:sustainment:maintenance:skip` | Skip maintenance |
| `atc:sustainment:node:register` | Register sustainment node |
| `atc:sustainment:node:degrade` | Degrade node |
| `atc:sustainment:node:recover` | Recover node |
| `atc:sustainment:node:fail` | Fail node |
| `atc:sustainment:longevity:create` | Create longevity checkpoint |
| `atc:sustainment:longevity:activate` | Activate checkpoint |
| `atc:sustainment:longevity:archive` | Archive checkpoint (permanent) |
| `atc:sustainment:longevity:expire` | Expire checkpoint |
| `atc:sustainment:cleanup` | Manual cleanup trigger |

Scheduled cleanup fires automatically every 5 minutes via `CreateThread`.

---

## EventBus Signals

| Signal | Emitted by |
|---|---|
| `sustainment_started` | `startSustainment` |
| `permanent_runtime_stability_established` | `completeSustainment`, `archiveCheckpoint` |
| `infinite_recovery_completed` | `completeRecovery` |
| `autonomous_maintenance_completed` | `completeMaintenance` |

---

## Recommended Sustainment Flow

For a full long-term sustainment cycle:

1. `POST /runtime-sustainment` → initiate with `sustainmentType: 'continuous'`
2. `POST /runtime-sustainment/:id/start` → begin active sustainment
3. `POST /runtime-sustainment/recovery` → register recovery node (UPSERT)
4. `POST /runtime-sustainment/node` → register cluster sustainment nodes
5. `POST /runtime-sustainment/maintenance` → schedule initial cleanup maintenance
6. `POST /runtime-sustainment/maintenance/:id/run` → run maintenance
7. `POST /runtime-sustainment/maintenance/:id/complete` → mark complete
8. `POST /runtime-sustainment/longevity` → create epoch checkpoint
9. `POST /runtime-sustainment/longevity/:id/activate`
10. `POST /runtime-sustainment/longevity/:id/archive` → permanent archive
11. `POST /runtime-sustainment/:id/maintain` → ongoing maintaining state
12. `POST /runtime-sustainment/:id/complete` → emit `permanent_runtime_stability_established`

---

## Operational Checklist

- [ ] Verify migrations 337–342 applied
- [ ] Confirm all 6 context fields non-null at startup
- [ ] Test sustainment round-trip: initiate → start → complete
- [ ] Test recovery UPSERT idempotency: initiate twice with same recoveryId
- [ ] Test maintenance: schedule → run → complete (`completedAt` present)
- [ ] Test node UPSERT: register → degrade → recover
- [ ] Test longevity: create → activate → archive (`archivedAt` present)
- [ ] Verify `completed` and `failed` sustainments are cleaned up
- [ ] Confirm `offline` and `failed` sustainment nodes are cleaned up
- [ ] Confirm audit entries on all state transitions
- [ ] Test cleanup with low threshold
- [ ] Verify FiveM bridge events reach the API
