# Phase 73 — ATC Core Deterministic Runtime Completion & Permanent Production Seal

## Overview

Phase 73 is the terminal phase of ATC's core infrastructure. It provides the permanent production sealing mechanism, deterministic completion orchestration, and distributed coordination for final runtime shutdown or epoch transitions. Records in this phase represent irreversible production operations.

**Package:** `@atc/core-finalization-runtime`
**API prefix:** `/api/v1/core-finalization`
**Migrations:** 319–324

---

## Architecture

### Services

| Service | Context field | Purpose |
|---|---|---|
| `CoreFinalizationService` | `coreFinalizationService` | Orchestrate core finalization lifecycle |
| `DeterministicSealService` | `deterministicSealService` | Apply deterministic hash/merkle/signature seals |
| `ProductionCompletionService` | `productionCompletionService` | Track graceful/forced production completions |
| `RuntimeCompletionCoordinator` | `runtimeCompletionCoordinator` | Coordinate completion across server cluster |
| `DistributedFinalSealService` | `distributedFinalSealService` | Apply, lock, and permanently seal resources |
| `FinalizationRecoveryService` | `finalizationRecoveryService` | Stale-record cleanup across all repos |

### Tables

| Table | Key column | Cleanup states |
|---|---|---|
| `atc_core_finalization` | `finalization_id` | `completed`, `failed` |
| `atc_runtime_completion` | `completion_id` | `completed`, `aborted`, `failed` |
| `atc_production_seals` | `seal_id` | `broken`, `expired` |
| `atc_finalization_coordination` | `coordination_id` (VARCHAR, UPSERT) | `completed` |
| `atc_deterministic_sealing` | `sealing_id` | `sealed`, `broken`, `expired` |
| `atc_core_finalization_audit` | — (append-only) | never |

---

## State Machines

### CoreFinalization
```
pending → active → completing → completed
                              → failed
        → failed
```

### DeterministicSealing
```
pending → sealing → sealed
                  → broken
                  → expired
```

### ProductionCompletion
```
pending → progressing → completed
                      → aborted
                      → failed
```

### ProductionSeal (DistributedFinalSeal)
```
applied → locked    (permanent — cannot transition further)
        → broken
        → expired
```

> **Note:** Production seals INSERT with status `applied` (not `pending`). A `locked` seal is the terminal success state and represents a permanent production seal that MUST NOT be broken except in emergency.

---

## API Endpoints

### Core Finalization
- `POST /api/v1/core-finalization` — initiate
- `POST /api/v1/core-finalization/:id/activate`
- `POST /api/v1/core-finalization/:id/begin-completing`
- `POST /api/v1/core-finalization/:id/complete`
- `POST /api/v1/core-finalization/:id/fail`
- `GET  /api/v1/core-finalization/:id`

### Deterministic Sealing
- `POST /api/v1/core-finalization/sealing`
- `POST /api/v1/core-finalization/sealing/:id/begin`
- `POST /api/v1/core-finalization/sealing/:id/apply`
- `POST /api/v1/core-finalization/sealing/:id/break`
- `GET  /api/v1/core-finalization/sealing/:id`

### Production Completion
- `POST /api/v1/core-finalization/completion`
- `POST /api/v1/core-finalization/completion/:id/progress`
- `POST /api/v1/core-finalization/completion/:id/complete`
- `POST /api/v1/core-finalization/completion/:id/abort`
- `GET  /api/v1/core-finalization/completion/:id`

### Coordination
- `POST /api/v1/core-finalization/coordination`
- `POST /api/v1/core-finalization/coordination/:id/progress`
- `POST /api/v1/core-finalization/coordination/:id/complete`
- `GET  /api/v1/core-finalization/coordination/:coordinationId`

### Distributed Final Seal
- `POST /api/v1/core-finalization/seal` — body must include `resourceId`
- `POST /api/v1/core-finalization/seal/:id/lock`
- `POST /api/v1/core-finalization/seal/:id/break`
- `POST /api/v1/core-finalization/seal/:id/expire`
- `GET  /api/v1/core-finalization/seal/:id`

### Cleanup
- `POST /api/v1/core-finalization/cleanup` — body: `{ "thresholdMs": 300000 }`

---

## FiveM Events

Events registered in `game/atc-core/server/core_finalization.lua`.

| Event | Action |
|---|---|
| `atc:core_finalization:initiate` | Initiate finalization |
| `atc:core_finalization:activate` | Activate |
| `atc:core_finalization:begin_completing` | Begin completing |
| `atc:core_finalization:complete` | Complete |
| `atc:core_finalization:sealing:create` | Create deterministic seal |
| `atc:core_finalization:sealing:begin` | Begin sealing |
| `atc:core_finalization:sealing:apply` | Apply seal |
| `atc:core_finalization:sealing:break` | Break seal |
| `atc:core_finalization:completion:create` | Create completion |
| `atc:core_finalization:completion:progress` | Progress completion |
| `atc:core_finalization:completion:complete` | Mark complete |
| `atc:core_finalization:completion:abort` | Abort completion |
| `atc:core_finalization:coordination:upsert` | Upsert coordination |
| `atc:core_finalization:coordination:progress` | Progress coordination |
| `atc:core_finalization:seal:apply` | Apply final seal |
| `atc:core_finalization:seal:lock` | Lock (permanent) |
| `atc:core_finalization:seal:break` | Emergency break |
| `atc:core_finalization:cleanup` | Manual cleanup trigger |

Scheduled cleanup fires automatically every 5 minutes via `CreateThread`.

---

## Production Seal Safety

The `atc_production_seals` table tracks permanent resource seals. A seal transitions:

1. **`applied`** (INSERT default) — seal placed but not yet locked
2. **`locked`** — permanently sealed; `locked_at` timestamp recorded

Breaking a locked seal (`seal:break`) is an emergency operation that sets status to `broken`. This should only occur during incident response and must be audited. All seal operations are appended to `atc_core_finalization_audit`.

The `resourceId` field is required when creating a seal — it links the seal to the resource being sealed (world epoch ID, session batch ID, etc.).

---

## Recovery

`FinalizationRecoveryService.cleanupStale(thresholdMs)` returns:

```typescript
{ finalizations, completions, seals, coordinations, sealings }
```

Locked seals are **never** cleaned up — only `broken` and `expired` seals are eligible.

---

## Sequencing: Recommended Finalization Flow

For a full epoch finalization:

1. `POST /core-finalization` → initiate with `finalizationType: 'epoch'`
2. `POST /core-finalization/:id/activate`
3. `POST /core-finalization/sealing` → create hash seal for this epoch
4. `POST /core-finalization/sealing/:id/begin` → begin sealing
5. `POST /core-finalization/sealing/:id/apply` → seal applied
6. `POST /core-finalization/completion` → create graceful completion record
7. `POST /core-finalization/completion/:id/progress`
8. `POST /core-finalization/completion/:id/complete`
9. `POST /core-finalization/:id/begin-completing`
10. `POST /core-finalization/seal` → apply permanent production seal with `resourceId`
11. `POST /core-finalization/seal/:id/lock` → permanent lock
12. `POST /core-finalization/:id/complete` → mark core finalization completed

---

## Operational Checklist

- [ ] Verify migrations 319–324 applied: `SHOW TABLES LIKE 'atc_core_finalization%'`
- [ ] Confirm all 6 context fields non-null at startup
- [ ] Test full finalization round-trip: initiate → activate → begin-completing → complete
- [ ] Test sealing round-trip: create → begin → apply
- [ ] Test production seal: apply → lock → GET (verify `lockedAt` present)
- [ ] Confirm `locked` seals are NOT deleted by cleanup
- [ ] Verify `broken` seals are deleted after threshold
- [ ] Confirm audit entries on all state transitions
- [ ] Test cleanup endpoint with low threshold: check counts match expectations
- [ ] Verify FiveM bridge events reach the API in integration environment
