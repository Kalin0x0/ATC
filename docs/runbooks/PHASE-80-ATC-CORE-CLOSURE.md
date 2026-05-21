# Phase 80 — Final ATC Core Closure & Production Immutability

## Overview

Phase 80 is the final deterministic closure phase of ATC's core runtime infrastructure. It provides permanent runtime freeze coordination, production immutability sealing, distributed closure orchestration, and deterministic completion validation. Records in this phase represent the irreversible production closure of the ATC platform.

**Package:** `@atc/core-closure-runtime`
**API prefix:** `/api/v1/core-closure`
**Migrations:** 361–366

---

## Architecture

### Services

| Service | Context field | Purpose |
|---|---|---|
| `CoreClosureService` | `coreClosureService` | Orchestrate core closure lifecycle |
| `ProductionImmutabilityService` | `productionImmutabilityService` | Enforce production immutability |
| `RuntimeFreezeCoordinator` | `runtimeFreezeCoordinator` | Coordinate production freeze state |
| `DistributedClosureOrchestrator` | `distributedClosureOrchestrator` | Manage distributed closure node cluster |
| `DeterministicCompletionValidator` | `deterministicCompletionValidator` | Validate deterministic completion |
| `FinalRecoveryCoordinator` | `finalRecoveryCoordinator` | Stale-record cleanup across all repos |

### Tables

| Table | Key column | Cleanup states |
|---|---|---|
| `atc_core_closure` | `closure_id` | `sealed`, `failed` |
| `atc_runtime_immutability` | `immutability_id` | `violated`, `failed` |
| `atc_production_freeze` | `freeze_id` (UPSERT) | `failed` |
| `atc_distributed_closure` | `closure_node_id` (UPSERT) | `degraded`, `failed` |
| `atc_final_validation` | `validation_id` | `failed` |
| `atc_core_closure_audit` | — (append-only) | never |

---

## State Machines

### CoreClosure
```
pending → active → sealed
               → failed
```

### RuntimeImmutability
```
pending → active → frozen
               → violated
               → failed
```

### ProductionFreeze (UPSERT)
```
active → degraded → recovering → active
       → failed
```

### DistributedClosure (UPSERT)
```
active → syncing → synced
       → degraded
       → failed
```

### FinalValidation
```
pending → validating → completed
                    → failed
```

---

## API Endpoints

### Core Closure
- `POST /api/v1/core-closure` — initiate closure
- `POST /api/v1/core-closure/:id/start`
- `POST /api/v1/core-closure/:id/seal`
- `POST /api/v1/core-closure/:id/fail`
- `GET  /api/v1/core-closure/:id`

### Production Immutability
- `POST /api/v1/core-closure/immutability` — create immutability
- `POST /api/v1/core-closure/immutability/:id/activate`
- `POST /api/v1/core-closure/immutability/:id/freeze`
- `POST /api/v1/core-closure/immutability/:id/violate`
- `GET  /api/v1/core-closure/immutability/:id`

### Production Freeze
- `POST /api/v1/core-closure/freeze` — initiate freeze (UPSERT by freezeId)
- `POST /api/v1/core-closure/freeze/:freezeId/degrade`
- `POST /api/v1/core-closure/freeze/:freezeId/recover`
- `GET  /api/v1/core-closure/freeze/:freezeId`

### Distributed Closure Nodes
- `POST /api/v1/core-closure/node` — register node (UPSERT by closureNodeId)
- `POST /api/v1/core-closure/node/:closureNodeId/sync`
- `POST /api/v1/core-closure/node/:closureNodeId/complete-sync`
- `POST /api/v1/core-closure/node/:closureNodeId/degrade`
- `GET  /api/v1/core-closure/node/:closureNodeId`

### Final Validation
- `POST /api/v1/core-closure/validation` — create validation
- `POST /api/v1/core-closure/validation/:id/begin`
- `POST /api/v1/core-closure/validation/:id/complete`
- `POST /api/v1/core-closure/validation/:id/fail`
- `GET  /api/v1/core-closure/validation/:id`

### Cleanup
- `POST /api/v1/core-closure/cleanup` — body: `{ "thresholdMs": 300000 }`

---

## FiveM Events

Events registered in `game/atc-core/server/core_closure.lua`.

| Event | Action |
|---|---|
| `atc:closure:initiate` | Initiate closure |
| `atc:closure:start` | Start closure |
| `atc:closure:seal` | Seal closure |
| `atc:closure:fail` | Fail closure |
| `atc:closure:immutability:create` | Create immutability |
| `atc:closure:immutability:activate` | Activate immutability |
| `atc:closure:immutability:freeze` | Freeze immutability |
| `atc:closure:immutability:violate` | Violate immutability |
| `atc:closure:freeze:initiate` | Initiate production freeze |
| `atc:closure:freeze:degrade` | Degrade freeze |
| `atc:closure:freeze:recover` | Recover freeze |
| `atc:closure:node:register` | Register closure node |
| `atc:closure:node:sync` | Sync node |
| `atc:closure:node:complete-sync` | Complete node sync |
| `atc:closure:node:degrade` | Degrade node |
| `atc:closure:validation:create` | Create final validation |
| `atc:closure:validation:begin` | Begin validating |
| `atc:closure:validation:complete` | Complete validation |
| `atc:closure:validation:fail` | Fail validation |

Scheduled cleanup fires automatically every 5 minutes via `CreateThread`.

---

## EventBus Signals

| Signal | Emitted by |
|---|---|
| `core_closure_started` | `startClosure` |
| `runtime_frozen` | `freezeImmutability`, `initiateFreeze` |
| `deterministic_validation_completed` | `completeValidation` |
| `distributed_closure_completed` | `completeSyncNode` |
| `immutable_production_seal_applied` | `sealClosure` |
| `final_runtime_reconciliation_completed` | `completeValidation` |
| `atc_core_completed` | `completeValidation` |

---

## Final Closure Flow

1. `POST /core-closure` → initiate with `closureType: 'final'`
2. `POST /core-closure/:id/start` → emit `core_closure_started`
3. `POST /core-closure/immutability` → create immutability record
4. `POST /core-closure/immutability/:id/activate` → activate
5. `POST /core-closure/freeze` → initiate production freeze (UPSERT)
6. `POST /core-closure/node` → register distributed closure nodes
7. `POST /core-closure/node/:id/sync` → begin syncing
8. `POST /core-closure/node/:id/complete-sync` → emit `distributed_closure_completed`
9. `POST /core-closure/validation` → create final validation
10. `POST /core-closure/validation/:id/begin` → begin deterministic validation
11. `POST /core-closure/validation/:id/complete` → emit `deterministic_validation_completed` + `final_runtime_reconciliation_completed` + `atc_core_completed`
12. `POST /core-closure/immutability/:id/freeze` → emit `runtime_frozen`
13. `POST /core-closure/:id/seal` → emit `immutable_production_seal_applied`

---

## Operational Checklist

- [ ] Verify migrations 361–366 applied
- [ ] Confirm all 6 context fields non-null at startup
- [ ] Test closure round-trip: initiate → start → seal (`sealedAt` present)
- [ ] Test immutability: create → activate → freeze (`frozenAt` present)
- [ ] Test production freeze UPSERT: initiate → degrade → recover
- [ ] Test distributed node UPSERT: register → sync → complete-sync
- [ ] Test final validation: create → begin → complete (`validatedAt` present)
- [ ] Verify `atc_core_completed` emitted on `completeValidation`
- [ ] Verify all 3 signals emitted by `completeValidation`
- [ ] Verify stale records cleaned up per entity
- [ ] Confirm audit entries on all state transitions
- [ ] Test cleanup with low threshold
- [ ] Verify FiveM bridge events reach the API
