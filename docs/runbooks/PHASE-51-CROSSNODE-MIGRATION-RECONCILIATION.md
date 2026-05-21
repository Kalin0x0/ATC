# Phase 51 — Cross-Node Migration & Runtime Reconciliation

## Overview

Phase 51 implements the cross-server entity migration pipeline and runtime reconciliation engine for ATC. It handles the lifecycle of entity migrations (start → complete/fail), node ownership transfers, snapshot replay, and runtime consistency validation across the cluster.

**Package:** `@atc/reconciliation-runtime`  
**API Routes:** `/api/v1/reconciliation/*`  
**FiveM Bridge:** `ATC.Reconciliation.*`

---

## DB Tables

| Table | Purpose |
|---|---|
| `atc_runtime_migrations` | Cross-node migration records with nonce idempotency |
| `atc_node_transfers` | Ownership transfer records between servers |
| `atc_reconciliation_runtime` | Active reconciliation run tracking |
| `atc_snapshot_replays` | Snapshot replay queue and status |
| `atc_runtime_recoveries` | Recovery attempt records |
| `atc_consistency_audit` | Consistency check results and issue logs |

Migrations: `187_create_runtime_migrations.sql` through `192_create_consistency_audit.sql`

---

## Services

| Service | Responsibility |
|---|---|
| `RuntimeMigrationService` | Start, complete, fail, and query migrations |
| `OwnershipTransferService` | Initiate, complete, fail node ownership transfers |
| `RuntimeRecoveryService` | Trigger and track entity recovery operations |
| `CrossNodeReconciliationService` | Run reconciliation passes across the cluster |
| `SnapshotReplayService` | Queue and execute snapshot replays |
| `RuntimeConsistencyService` | Validate consistency state across nodes |

---

## API Endpoints

### Runtime Migrations
- `POST /api/v1/reconciliation/migrations/start` — Start a new cross-node migration
- `POST /api/v1/reconciliation/migrations/:migrationId/complete` — Mark migration complete
- `POST /api/v1/reconciliation/migrations/:migrationId/fail` — Mark migration failed with reason
- `GET /api/v1/reconciliation/migrations/:migrationId` — Get migration record

### Node Transfers
- `POST /api/v1/reconciliation/transfers/initiate` — Initiate an ownership transfer
- `POST /api/v1/reconciliation/transfers/:transferId/complete` — Complete a transfer
- `POST /api/v1/reconciliation/transfers/:transferId/fail` — Fail a transfer

### Reconciliation
- `POST /api/v1/reconciliation/run` — Run a reconciliation pass (type + optional region/server scope)

### Snapshot Replay
- `POST /api/v1/reconciliation/snapshots/replay` — Queue a snapshot replay for an entity
- `GET /api/v1/reconciliation/snapshots/pending` — List all pending replays

### Recovery
- `POST /api/v1/reconciliation/recovery/start` — Start a recovery operation

### Consistency
- `GET /api/v1/reconciliation/consistency/check` — Validate cluster consistency state

---

## FiveM Bridge Usage

```lua
-- Start a migration (idempotency via nonce)
local migration = ATC.Reconciliation.StartMigration(
  'nonce-player-123-to-server2',
  'entity-player-123',
  'server-1',
  'server-2',
  { position = { x = 100, y = 200 } }
)

-- Complete migration after entity arrives
ATC.Reconciliation.CompleteMigration(migration.id)

-- If migration fails
ATC.Reconciliation.FailMigration(migration.id, 'Target server disconnected')

-- Initiate ownership transfer
local transfer = ATC.Reconciliation.InitiateTransfer(
  'entity-vehicle-456',
  'server-1',
  'server-2',
  { fuel = 0.8, health = 1000 }
)
ATC.Reconciliation.CompleteTransfer(transfer.id)

-- Run ownership reconciliation for a region
ATC.Reconciliation.Run('ownership', 'region-downtown', 'server-1', nil)

-- Replay a specific checkpoint
ATC.Reconciliation.ReplayCheckpoint('entity-player-123', 'snap-01JX...')

-- Start snapshot recovery
ATC.Reconciliation.StartRecovery('entity-player-123', 'snapshot', 'server-1')

-- Check cluster consistency
local result = ATC.Reconciliation.CheckConsistency()
```

---

## Migration Lifecycle

```
pending → in_progress → completed
                      ↘ failed
```

- `pending` — Created, waiting for migration to begin
- `in_progress` — Entity is being transferred
- `completed` — Migration finished successfully
- `failed` — Migration aborted; entity remains on source server

Idempotency is enforced via `migration_nonce` (UNIQUE constraint). Duplicate nonce triggers `DuplicateMigrationNonceError` (HTTP 409).

---

## Transfer Lifecycle

```
initiated → in_progress → completed
                        ↘ failed
```

---

## Reconciliation Types

| Type | What it checks |
|---|---|
| `ownership` | Entity ownership consistency across servers |
| `snapshot` | Snapshot freshness and completeness |
| `migration` | Stuck or orphaned migrations |
| `consistency` | Full cross-node state validation |
| `custom` | Plugin-defined reconciliation logic |

---

## Operational Runbook

### Stuck migration cleanup

Migrations stuck in `in_progress` for more than N minutes should be failed:

1. Query `atc_runtime_migrations` for records where `status = 'in_progress' AND updated_at < NOW() - INTERVAL 5 MINUTE`
2. For each stuck migration: `POST /api/v1/reconciliation/migrations/:id/fail` with `reason: "timeout"`
3. Trigger snapshot recovery: `POST /api/v1/reconciliation/recovery/start`

### Consistency check failure

When `GET /api/v1/reconciliation/consistency/check` returns `{ consistent: false, issues: N }`:

1. Run `POST /api/v1/reconciliation/run` with `reconciliationType: 'ownership'` for each region
2. Check `atc_consistency_audit` table for specific issue details
3. If issues persist: run `reconciliationType: 'snapshot'` to repair snapshot gaps

### Snapshot replay queue backlog

When `GET /api/v1/reconciliation/snapshots/pending` returns a large list:

1. Check `atc_snapshot_replays` for records in `pending` or `replaying` state
2. If `replaying` records are stuck: restart the API server to release locks
3. Replays are processed in order; backlog clears automatically after restart

### Post-crash recovery flow

After a server node crashes unexpectedly:

1. `POST /api/v1/reconciliation/recovery/start` for each affected entity with `recoveryType: 'snapshot'`
2. `POST /api/v1/reconciliation/run` with `reconciliationType: 'consistency'`
3. Verify with `GET /api/v1/reconciliation/consistency/check`

---

## Error Reference

| Error | HTTP | Meaning |
|---|---|---|
| `RuntimeMigrationNotFoundError` | 404 | Migration ID not found |
| `DuplicateMigrationNonceError` | 409 | Migration with this nonce already started |
| `MigrationAlreadyCompletedError` | 409 | Migration already in terminal state |
| `NodeTransferNotFoundError` | 404 | Transfer ID not found |
| `ReconciliationNotFoundError` | 404 | Reconciliation run not found |
| `SnapshotReplayNotFoundError` | 404 | Replay record not found |
| `RuntimeRecoveryNotFoundError` | 404 | Recovery record not found |
