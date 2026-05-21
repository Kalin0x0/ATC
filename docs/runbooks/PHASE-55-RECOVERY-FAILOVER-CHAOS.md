# Phase 55 — Runtime Recovery, Failover & Chaos Resilience Platform

## Overview

Phase 55 provides the infrastructure for coordinating server failovers, executing recovery operations, managing resilience health scores, taking and restoring runtime snapshots, and running controlled chaos tests. All operations are internal server-to-server with no client exposure.

---

## Package

**`@atc/runtime-resilience`**

| Service | Responsibility |
|---|---|
| `RuntimeRecoveryCoordinator` | Recovery operation lifecycle: initiate, complete, fail, list |
| `FailoverOrchestrationService` | Failover initiation, completion, failure, cleanup |
| `ChaosSimulationService` | Chaos test start, complete, abort, active listing |
| `RuntimeResilienceService` | Health upsert, score update with auto-status derivation, list |
| `SnapshotRecoveryService` | Snapshot creation, restoration, entity listing |
| `DistributedHealthRecoveryService` | Cross-node health recovery coordination |

---

## DB Tables

| Migration | Table |
|---|---|
| 211 | `atc_runtime_failover` |
| 212 | `atc_recovery_snapshots` |
| 213 | `atc_chaos_runtime` |
| 214 | `atc_runtime_resilience` |
| 215 | `atc_failover_audit` |
| 216 | `atc_recovery_operations` |

---

## API Routes (`/api/v1/resilience/*`)

| Method | Path | Service call |
|---|---|---|
| POST | `/failover/initiate` | `FailoverOrchestrationService.initiateFailover` |
| GET  | `/failover/:id` | `FailoverOrchestrationService.getFailover` |
| GET  | `/failover/active` | `FailoverOrchestrationService.listActiveFailovers` |
| POST | `/failover/:id/complete` | `FailoverOrchestrationService.completeFailover` |
| POST | `/failover/:id/fail` | `FailoverOrchestrationService.failFailover` |
| POST | `/recovery/initiate` | `RuntimeRecoveryCoordinator.initiateRecovery` |
| GET  | `/recovery/:id` | `RuntimeRecoveryCoordinator.getOperation` |
| GET  | `/recovery/active` | `RuntimeRecoveryCoordinator.listActiveOperations` |
| POST | `/recovery/:id/complete` | `RuntimeRecoveryCoordinator.completeRecovery` |
| POST | `/recovery/:id/fail` | `RuntimeRecoveryCoordinator.failRecovery` |
| POST | `/snapshots/create` | `SnapshotRecoveryService.createSnapshot` |
| GET  | `/snapshots/:id` | `SnapshotRecoveryService.getSnapshot` |
| GET  | `/snapshots/entity/:entityId` | `SnapshotRecoveryService.listByEntity` |
| POST | `/snapshots/:id/restore` | `SnapshotRecoveryService.restoreSnapshot` |
| POST | `/chaos/start` | `ChaosSimulationService.startTest` |
| GET  | `/chaos/:id` | `ChaosSimulationService.getTest` |
| GET  | `/chaos/active` | `ChaosSimulationService.listActiveTests` |
| POST | `/chaos/:id/complete` | `ChaosSimulationService.completeTest` |
| POST | `/chaos/:id/abort` | `ChaosSimulationService.abortTest` |
| POST | `/health/upsert` | `RuntimeResilienceService.upsertHealth` |
| GET  | `/health/:recordId` | `RuntimeResilienceService.getHealthStatus` |
| GET  | `/health` | `RuntimeResilienceService.listAll` |
| POST | `/cleanup` | `FailoverOrchestrationService.cleanupStale` |

---

## FiveM Bridge

File: `game/atc-core/server/runtime_resilience.lua`

| Event | Direction | Description |
|---|---|---|
| `atc:resilience:failover:initiate` | Server-only | Initiates a server failover |
| `atc:resilience:failover:complete` | Server-only | Marks failover completed |
| `atc:resilience:failover:fail` | Server-only | Marks failover failed |
| `atc:resilience:recovery:initiate` | Server-only | Initiates a recovery operation |
| `atc:resilience:recovery:complete` | Server-only | Marks recovery completed |
| `atc:resilience:snapshot:create` | Server-only | Creates a state snapshot |
| `atc:resilience:snapshot:restore` | Server-only | Restores a snapshot |
| `atc:resilience:health:update` | Server-only | Updates health score |
| `atc:resilience:chaos:start` | Server-only | Starts a chaos test |
| `atc:resilience:chaos:complete` | Server-only | Completes a chaos test |
| `atc:resilience:chaos:abort` | Server-only | Aborts a chaos test |
| `atc:resilience:cleanup` | Scheduler | Purges stale failover records |

---

## Health Score → Status Mapping

| Health Score | Status |
|---|---|
| ≥ 80 | `healthy` |
| 50–79 | `degraded` |
| 20–49 | `critical` |
| < 20 | `failed` |

`atc:resilience:health:degraded` is emitted whenever status is non-healthy.

---

## Idempotency

- Failovers: `UNIQUE KEY uk_failover_id (failover_id)` + nonce — duplicate initiation returns `DuplicateFailoverError`
- Recovery operations: `UNIQUE KEY uk_recovery_operation_id (operation_id)` — duplicate returns `DuplicateRecoveryOperationError`
- Chaos tests: `UNIQUE KEY uk_chaos_test_id (test_id)` — duplicate returns `DuplicateChaosTestError`
- Resilience records: `UNIQUE KEY uk_resilience_record_id (record_id)` — upsert pattern

---

## EventBus Events (outbound)

| Event | Payload |
|---|---|
| `atc:resilience:recovery:started` | `{ operationId }` |
| `atc:resilience:recovery:completed` | `{ operationId }` |
| `atc:resilience:recovery:failed` | `{ operationId }` |
| `atc:resilience:failover:started` | `{ failoverId }` |
| `atc:resilience:failover:completed` | `{ failoverId }` |
| `atc:resilience:failover:failed` | `{ failoverId }` |
| `atc:resilience:chaos:started` | `{ testId }` |
| `atc:resilience:chaos:completed` | `{ testId }` |
| `atc:resilience:chaos:aborted` | `{ testId }` |
| `atc:resilience:snapshot:created` | `{ id, entityId }` |
| `atc:resilience:snapshot:restored` | `{ id, entityId }` |
| `atc:resilience:health:degraded` | `{ recordId, healthScore, status }` |

---

## Scheduler Guidance

- Run `atc:resilience:cleanup` every 10 minutes with `thresholdMs: 600000`
- Run health checks every 60 seconds; update via `atc:resilience:health:update`

---

## Chaos Test Safety

Chaos tests should **only** run in non-production environments or under explicit maintenance windows. Verify `targetServerId` is an authorized test target before initiating. Abort with `/api/v1/resilience/chaos/:id/abort` if a test runs unexpectedly.

---

## Alerts

- **Failover stuck `in_progress` > 15 minutes**: `SELECT * FROM atc_runtime_failover WHERE status = 'in_progress' AND started_at < NOW() - INTERVAL 15 MINUTE`
- **Recovery operation stuck `in_progress` > 30 minutes**: escalate to on-call; may indicate split-brain
- **Health score < 50 on primary server**: trigger alerting; inspect `atc_runtime_resilience` for `owner_server_id`
- **Multiple simultaneous chaos tests running**: `SELECT COUNT(*) FROM atc_chaos_runtime WHERE status = 'running'` — should be ≤ 1
