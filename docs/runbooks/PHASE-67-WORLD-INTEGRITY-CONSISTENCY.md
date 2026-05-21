# Phase 67 Runbook — Final Distributed Consistency, Runtime Locking & Deterministic World Integrity

## Overview

Phase 67 introduces the world integrity and distributed consistency layer for Atlantic Core. This phase establishes:

- **World Integrity** — checkpoint/snapshot/hash verification and state auditing
- **Distributed Locks** — exclusive/shared/advisory/intent resource locking (upsert-based, keyed by `resource_key`)
- **Runtime Consistency** — per-node consistency tracking (upsert-based, keyed by `node_id`)
- **Integrity Validation** — world-state/entity-state/transaction/replication validation lifecycle
- **World Reconciliation** — delta_sync/full_sync/conflict_resolve/merge/rollback operations
- **Audit Log** — append-only integrity event log

---

## Package

**`@atc/world-integrity-runtime`** — `packages/world-integrity-runtime/`

### Key Files

| File | Purpose |
|---|---|
| `pool.ts` | Duck-typed pool interface (`WorldIntegrityPool`) |
| `id.ts` | ULID generator via `ulidx` monotonicFactory |
| `errors.ts` | 8 typed error classes |
| `world-integrity.repository.ts` | CRUD + FOR UPDATE status transitions |
| `distributed-lock.repository.ts` | ON DUPLICATE KEY UPDATE upsert by `resource_key` |
| `runtime-consistency.repository.ts` | ON DUPLICATE KEY UPDATE upsert by `node_id` |
| `integrity-validation.repository.ts` | CRUD + FOR UPDATE status transitions |
| `world-reconciliation.repository.ts` | CRUD + FOR UPDATE status transitions |
| `integrity-audit.repository.ts` | INSERT-only audit log |
| `world-integrity.service.ts` | `WorldIntegrityService` |
| `distributed-locking.service.ts` | `DistributedLockingService` |
| `deterministic-consistency.service.ts` | `DeterministicConsistencyService` |
| `integrity-validation.service.ts` | `GlobalWorldValidationService` |
| `world-reconciliation.service.ts` | `RuntimeIntegrityCoordinator` |
| `integrity-recovery.service.ts` | `IntegrityRecoveryService` — stale cleanup |

---

## Database Migrations

| Migration | Table | Purpose |
|---|---|---|
| 283 | `atc_world_integrity` | World integrity check records |
| 284 | `atc_distributed_locks` | Resource locks (UNIQUE on `resource_key`) |
| 285 | `atc_runtime_consistency` | Per-node consistency state (UNIQUE on `node_id`) |
| 286 | `atc_integrity_validation` | Validation lifecycle records |
| 287 | `atc_world_reconciliation` | Reconciliation operation records |
| 288 | `atc_integrity_audit` | Append-only audit log |

---

## API Endpoints

### World Integrity
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/world-integrity` | Create integrity check |
| POST | `/api/v1/world-integrity/:id/verify` | Mark as verified (optional `worldHash` body) |
| POST | `/api/v1/world-integrity/:id/fail` | Mark as failed |
| POST | `/api/v1/world-integrity/:id/corrupt` | Mark as corrupted |
| GET | `/api/v1/world-integrity/:id` | Get integrity record |

### Distributed Locks
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/world-integrity/lock` | Acquire lock |
| POST | `/api/v1/world-integrity/lock/:resourceKey/release` | Release lock |
| GET | `/api/v1/world-integrity/lock/:resourceKey` | Get lock by resource key |

### Runtime Consistency
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/world-integrity/consistency` | Upsert consistency record |
| POST | `/api/v1/world-integrity/consistency/:nodeId/diverge` | Mark node diverged (204) |
| GET | `/api/v1/world-integrity/consistency/:nodeId` | Get consistency by node |

### Integrity Validation
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/world-integrity/validation` | Start validation |
| POST | `/api/v1/world-integrity/validation/:id/pass` | Mark validation passed |
| POST | `/api/v1/world-integrity/validation/:id/fail` | Mark validation failed |
| GET | `/api/v1/world-integrity/validation/:id` | Get validation |

### World Reconciliation
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/world-integrity/reconcile` | Start reconciliation |
| POST | `/api/v1/world-integrity/reconcile/:id/complete` | Complete reconciliation |
| POST | `/api/v1/world-integrity/reconcile/:id/fail` | Fail reconciliation |
| GET | `/api/v1/world-integrity/reconcile/:id` | Get reconciliation |

### Cleanup
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/world-integrity/cleanup` | Cleanup stale records |

---

## FiveM Event Bridge

Lua bridge: `game/atc-core/server/world_integrity.lua`

### Events (Server-only)

| Event | Parameters | Description |
|---|---|---|
| `atc:integrity:create` | `integrityType, integrityNonce, integrityData` | Create integrity check |
| `atc:integrity:verify` | `id, worldHash?` | Verify integrity |
| `atc:integrity:fail` | `id` | Fail integrity |
| `atc:integrity:corrupt` | `id` | Mark corrupted |
| `atc:lock:acquire` | `resourceKey, lockType, lockNonce, expiresAt?, lockData` | Acquire lock |
| `atc:lock:release` | `resourceKey` | Release lock |
| `atc:consistency:upsert` | `nodeId, consistencyType, consistencyData` | Upsert consistency |
| `atc:consistency:diverge` | `nodeId` | Mark node diverged |
| `atc:validation:start` | `validationType, validationNonce, targetId?, validationData` | Start validation |
| `atc:validation:pass` | `id` | Pass validation |
| `atc:validation:fail` | `id` | Fail validation |
| `atc:reconcile:start` | `reconciliationType, reconciliationNonce, reconciliationData` | Start reconciliation |
| `atc:reconcile:complete` | `id` | Complete reconciliation |
| `atc:reconcile:fail` | `id` | Fail reconciliation |
| `atc:integrity:cleanup` | `thresholdMs` | Trigger cleanup |

Cleanup runs automatically every 5 minutes via `CreateThread`.

---

## Error Reference

| Error Class | Trigger |
|---|---|
| `IntegrityNotFoundError` | Integrity record ID not found in status update |
| `DuplicateIntegrityError` | Duplicate `(integrity_nonce, owner_server_id)` |
| `LockNotFoundError` | Lock resource key not found on release |
| `ConsistencyNotFoundError` | Consistency node not found on markDiverged |
| `ValidationNotFoundError` | Validation ID not found in status update |
| `DuplicateValidationError` | Duplicate `(validation_nonce, owner_server_id)` |
| `ReconciliationNotFoundError` | Reconciliation ID not found in status update |
| `DuplicateReconciliationError` | Duplicate `(reconciliation_nonce, owner_server_id)` |

---

## Operational Notes

- Distributed locks and runtime consistency use `ON DUPLICATE KEY UPDATE` for idempotent upserts
- Lock `expiresAt` is optional; null means the lock does not expire automatically
- World integrity status flow: `pending` → `active` → `verified` | `failed` | `corrupted`
- Validation status flow: `pending` → `passed` | `failed` | `skipped`
- Reconciliation status flow: `in_progress` → `completed` | `failed`
- Consistency status flow: `consistent` | `diverged` | `reconciling` | `unknown`
- The cleanup endpoint fans out to integrity, lock, validation, and reconciliation tables
- All non-upsert status transitions use `FOR UPDATE` transactions
- `verifyIntegrity` accepts an optional `worldHash` string for hash-based verification
