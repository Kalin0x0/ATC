# Phase 58 — Global Persistence, Snapshot Compression & Long-Term State Recovery

## Overview

Phase 58 provides server-authoritative global snapshot management, snapshot compression, per-entity persistence runtime state, long-term recovery operations, cold archival, and consistency cleanup. All operations are server-side only and idempotent via nonce constraints.

**Package:** `@atc/persistence-runtime`
**API prefix:** `/api/v1/persistence`
**FiveM bridge:** `game/atc-core/server/persistence.lua`

---

## Services

| Service | Responsibility |
|---|---|
| `GlobalPersistenceService` | Create, complete, fail, and list global snapshots |
| `SnapshotCompressionService` | Start, complete, fail, and fetch compression jobs |
| `DistributedSnapshotService` | Upsert and deactivate per-entity persistence state |
| `LongTermRecoveryService` | Start, complete, fail, and fetch recovery operations |
| `RuntimeArchivalService` | Create, complete, and fetch cold archives |
| `PersistenceConsistencyService` | Cleanup stale snapshots, states, and recovery records |

---

## Database Tables

| Table | Purpose |
|---|---|
| `atc_global_snapshots` | Global world/entity snapshots with nonce idempotency |
| `atc_snapshot_archives` | Cold storage archives linked to source snapshots |
| `atc_persistence_runtime` | Per-entity active persistence state (upsert by entity_id) |
| `atc_snapshot_compression` | Compression job records with nonce idempotency |
| `atc_longterm_recovery` | Long-term recovery operation records |
| `atc_persistence_audit` | Append-only audit log for all persistence events |

---

## API Endpoints

### Snapshots
- `POST /api/v1/persistence/snapshots/create` — Create a global snapshot
- `POST /api/v1/persistence/snapshots/:id/complete` — Mark snapshot completed
- `GET  /api/v1/persistence/snapshots/:id` — Fetch snapshot by ID
- `GET  /api/v1/persistence/snapshots/active` — List active snapshots

### Compression
- `POST /api/v1/persistence/compression/start` — Start compression job
- `POST /api/v1/persistence/compression/:id/complete` — Complete compression
- `GET  /api/v1/persistence/compression/:id` — Fetch compression record

### Persistence State
- `POST /api/v1/persistence/state/upsert` — Upsert per-entity state
- `GET  /api/v1/persistence/state/:entityId` — Get entity persistence state

### Recovery
- `POST /api/v1/persistence/recovery/start` — Start a recovery operation
- `POST /api/v1/persistence/recovery/:id/complete` — Complete recovery
- `GET  /api/v1/persistence/recovery/:id` — Fetch recovery record

### Archival
- `POST /api/v1/persistence/archive/create` — Create a cold archive
- `GET  /api/v1/persistence/archive/:id` — Fetch archive record

### Cleanup
- `POST /api/v1/persistence/cleanup` — Purge stale snapshots, states, recoveries

---

## FiveM Events

| Event | Direction | Description |
|---|---|---|
| `atc:persistence:snapshot:create` | Server-only | Create a global snapshot |
| `atc:persistence:snapshot:complete` | Server-only | Mark snapshot completed |
| `atc:persistence:state:upsert` | Server-only | Upsert per-entity persistence state |
| `atc:persistence:recovery:start` | Server-only | Start a long-term recovery |
| `atc:persistence:cleanup` | Scheduler | Purge stale persistence data |

---

## Idempotency

Snapshots are idempotent by `(snapshot_nonce, owner_server_id)` UNIQUE constraint → `DuplicateSnapshotError`.
Compression jobs are idempotent by `(compression_nonce, owner_server_id)` → `DuplicateCompressionError`.
Recovery operations are idempotent by `(recovery_nonce, owner_server_id)` → `DuplicateRecoveryError`.

---

## Snapshot Lifecycle

```
create → [active] → complete → [completed]
                  → fail     → [failed]
```

Compression jobs follow the same pattern. Recovery operations: `pending → running → completed | failed`.

---

## Cleanup

Call `POST /api/v1/persistence/cleanup` with `{ "thresholdMs": 300000 }`. Returns `{ snapshots, states, recoveries }` purge counts. The scheduler bridge event `atc:persistence:cleanup` fires this automatically.

---

## Context Keys (AppContext)

```typescript
globalPersistenceService?:       GlobalPersistenceService
snapshotCompressionService?:     SnapshotCompressionService
distributedSnapshotService?:     DistributedSnapshotService
longTermRecoveryService?:        LongTermRecoveryService
runtimeArchivalService?:         RuntimeArchivalService
persistenceConsistencyService?:  PersistenceConsistencyService
globalSnapshotRepo?:             GlobalSnapshotRepository
snapshotArchiveRepo?:            SnapshotArchiveRepository
persistenceRuntimeRepo?:         PersistenceRuntimeRepository
snapshotCompressionRepo?:        SnapshotCompressionRepository
longtermRecoveryRepo?:           LongtermRecoveryRepository
persistenceAuditRepo?:           PersistenceAuditRepository
```

---

## Error Reference

| Error | HTTP | Trigger |
|---|---|---|
| `SnapshotNotFoundError` | 404 | Snapshot ID not in DB |
| `DuplicateSnapshotError` | 409 | Duplicate `(snapshot_nonce, owner_server_id)` |
| `ArchiveNotFoundError` | 404 | Archive ID not in DB |
| `DuplicateArchiveError` | 409 | Duplicate archive nonce |
| `CompressionNotFoundError` | 404 | Compression ID not in DB |
| `DuplicateCompressionError` | 409 | Duplicate `(compression_nonce, owner_server_id)` |
| `RecoveryNotFoundError` | 404 | Recovery ID not in DB |
| `DuplicateRecoveryError` | 409 | Duplicate `(recovery_nonce, owner_server_id)` |
