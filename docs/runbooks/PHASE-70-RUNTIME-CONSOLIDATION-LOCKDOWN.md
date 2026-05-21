# Phase 70 — Final Runtime Consolidation, Deterministic Simulation Closure & Production Lockdown

## Overview

Phase 70 is the terminal runtime layer for ATC. It manages production lockdowns (server-wide state transitions), deterministic simulation closures (graceful/forced shutdown sequences), production integrity checks, runtime seals (immutability guarantees), and distributed finalizations (epoch/session commits). All operations emit events and are audited append-only.

**Package:** `@atc/runtime-lockdown`  
**API prefix:** `/api/v1/lockdown`  
**FiveM event namespace:** `atc:lockdown:*`

---

## Services

| Service | Responsibility |
|---|---|
| `RuntimeLockdownService` | Initiate, activate, lift, and fail server lockdowns |
| `DeterministicClosureService` | Manage simulation closure sequences |
| `ProductionIntegrityService` | Create and run production integrity checks |
| `RuntimeSealService` | Apply, verify, and break immutability seals |
| `DistributedFinalizationService` | Commit or rollback distributed finalizations |
| `LockdownRecoveryService` | Fan-out stale cleanup across all lockdown domains |

---

## Database Tables

| Table | Purpose |
|---|---|
| `atc_runtime_lockdown` | Lockdown state records |
| `atc_production_integrity` | Integrity check records |
| `atc_runtime_seals` | Seal records (includes `resource_id`) |
| `atc_finalization_runtime` | Finalization records |
| `atc_lockdown_recovery` | Deterministic closure records |
| `atc_lockdown_audit` | Append-only audit log |

Migrations: `301_create_runtime_lockdown.sql` through `306_create_lockdown_audit.sql`

---

## API Endpoints

### Lockdown
| Method | Path | Action |
|---|---|---|
| POST | `/api/v1/lockdown` | Initiate lockdown |
| POST | `/api/v1/lockdown/:id/activate` | Activate |
| POST | `/api/v1/lockdown/:id/lift` | Lift |
| POST | `/api/v1/lockdown/:id/fail` | Fail |
| GET | `/api/v1/lockdown/:id` | Fetch |

### Deterministic Closure
| Method | Path | Action |
|---|---|---|
| POST | `/api/v1/lockdown/closure` | Start closure |
| POST | `/api/v1/lockdown/closure/:id/progress` | Progress to in_progress |
| POST | `/api/v1/lockdown/closure/:id/complete` | Complete |
| POST | `/api/v1/lockdown/closure/:id/abort` | Abort |
| GET | `/api/v1/lockdown/closure/:id` | Fetch |

### Production Integrity
| Method | Path | Action |
|---|---|---|
| POST | `/api/v1/lockdown/integrity` | Create integrity check |
| POST | `/api/v1/lockdown/integrity/:id/run` | Begin running |
| POST | `/api/v1/lockdown/integrity/:id/pass` | Pass |
| POST | `/api/v1/lockdown/integrity/:id/fail` | Fail |
| GET | `/api/v1/lockdown/integrity/:id` | Fetch |

### Runtime Seals
| Method | Path | Action |
|---|---|---|
| POST | `/api/v1/lockdown/seal` | Apply seal |
| POST | `/api/v1/lockdown/seal/:id/verify` | Verify |
| POST | `/api/v1/lockdown/seal/:id/break` | Break |
| GET | `/api/v1/lockdown/seal/:id` | Fetch |

### Distributed Finalization
| Method | Path | Action |
|---|---|---|
| POST | `/api/v1/lockdown/finalization` | Start finalization |
| POST | `/api/v1/lockdown/finalization/:id/commit` | Commit |
| POST | `/api/v1/lockdown/finalization/:id/rollback` | Rollback |
| GET | `/api/v1/lockdown/finalization/:id` | Fetch |

### Cleanup
| Method | Path | Action |
|---|---|---|
| POST | `/api/v1/lockdown/cleanup` | Cleanup stale records |

---

## FiveM Events

```lua
-- Lockdown lifecycle
TriggerEvent('atc:lockdown:initiate', { lockdownType='full', ownerServerId='server-1', lockdownNonce='nonce-1' }, cb)
TriggerEvent('atc:lockdown:activate', id, cb)
TriggerEvent('atc:lockdown:lift', id, cb)
TriggerEvent('atc:lockdown:fail', id, cb)

-- Closure
TriggerEvent('atc:lockdown:closure:start', { closureType='graceful', ownerServerId='server-1', closureNonce='nonce-1' }, cb)
TriggerEvent('atc:lockdown:closure:complete', id, cb)
TriggerEvent('atc:lockdown:closure:abort', id, cb)

-- Production integrity
TriggerEvent('atc:lockdown:integrity:create', { integrityType='runtime', ownerServerId='server-1', integrityNonce='nonce-1' }, cb)
TriggerEvent('atc:lockdown:integrity:pass', id, cb)
TriggerEvent('atc:lockdown:integrity:fail', id, cb)

-- Seals
TriggerEvent('atc:lockdown:seal:apply', { sealType='checksum', ownerServerId='server-1', resourceId='RES_001', sealNonce='nonce-1' }, cb)
TriggerEvent('atc:lockdown:seal:verify', id, cb)
TriggerEvent('atc:lockdown:seal:break', id, cb)

-- Finalization
TriggerEvent('atc:lockdown:finalization:start', { finalizationType='epoch', ownerServerId='server-1', finalizationNonce='nonce-1' }, cb)
TriggerEvent('atc:lockdown:finalization:commit', id, cb)
TriggerEvent('atc:lockdown:finalization:rollback', id, cb)

-- Cleanup fires automatically every 5 minutes
TriggerEvent('atc:lockdown:cleanup', 300000)
```

---

## Status Flows

**Lockdown:** `initiated` → `active` → `lifting` → `lifted` / `failed`

**Closure:** `pending` → `in_progress` → `completed` / `aborted`

**Production integrity:** `pending` → `running` → `passed` / `failed`

**Seal:** `applied` → `verified` / `broken` / `expired`

**Finalization:** `pending` → `committing` → `committed` / `rolling_back` → `rolled_back`

---

## Idempotency

Lockdowns, closures, and finalizations enforce `UNIQUE(nonce, owner_server_id)`. Seals enforce `UNIQUE(seal_nonce, owner_server_id)`. Duplicate nonce submissions return `DuplicateLockdownError` (HTTP 409).

Seals include a `resource_id` field that identifies the resource being sealed — it is stored but not used as a uniqueness key.

---

## Cleanup

`LockdownRecoveryService.cleanupStale(thresholdMs)` fans out in `Promise.all` across all five repos. Returns `{ lockdowns, integrityChecks, seals, finalizations, closures }`.

Triggered automatically in FiveM every 5 minutes. Manual trigger: `POST /api/v1/lockdown/cleanup` with `{ thresholdMs: number }`.

---

## Operational Notes

- The `atc_lockdown_recovery` table stores deterministic closure records (`DeterministicClosureRepository`). The table name reflects its role as a recovery/rollback artifact store.
- `liftLockdown` sets `liftedAt = NOW()`. `verifySeal` sets `verifiedAt = NOW()`. `commitFinalization` sets `committedAt = NOW()`. All other transitions pass no timestamp.
- `LockdownRecoveryService` constructor order: `(lockdownRepo, integrityRepo, sealRepo, finalizationRepo, closureRepo, audit, eventBus)`.
- All writes are audited to `atc_lockdown_audit` before emitting bus events.
- The `beginLifting` transition (`lifting` status) allows a two-phase lift: signal intent, then confirm via `liftLockdown`.
- The `beginCommitting` and `beginRollingBack` transitions enable multi-phase finalization for long-running epoch commits.
