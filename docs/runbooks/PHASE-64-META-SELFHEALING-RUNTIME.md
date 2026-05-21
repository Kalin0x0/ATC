# Phase 64 — Meta-Orchestration, Runtime Self-Healing & Autonomous Infrastructure Coordination

## Overview
Infrastructure meta-layer for self-healing, distributed repair, resource allocation tracking, and node coordination. Provides the runtime substrate for ATC's autonomous infrastructure management.

## Package
`@atc/meta-runtime`

## Services

| Service | Responsibility |
|---|---|
| `MetaRuntimeService` | Register/pause/terminate meta-orchestration processes |
| `AutonomousHealingService` | Start/complete/fail healing operations on target nodes |
| `DistributedRepairService` | Start/complete/fail distributed repair jobs |
| `MetaAllocationService` | Allocate/release resource allocations per entity |
| `RuntimeCoordinationService` | Upsert/fail node coordination roles (leader/follower/etc.) |
| `SelfHealingRecoveryService` | Bulk stale cleanup across all meta tables |

## Database Tables

| Table | Purpose |
|---|---|
| `atc_meta_runtime` | Meta-orchestration processes (orchestrator/scheduler/etc.) |
| `atc_runtime_healing` | Healing operation lifecycle (restart/failover/rollback/etc.) |
| `atc_distributed_repair` | Distributed repair jobs (data_repair/state_sync/etc.) |
| `atc_meta_allocations` | Resource allocations per entity (ON DUPLICATE KEY on entity_id) |
| `atc_runtime_coordination` | Node coordination roles (ON DUPLICATE KEY on node_id) |
| `atc_meta_audit` | Append-only audit trail |

## API Routes

| Method | Path | Service |
|---|---|---|
| POST | `/api/v1/meta-runtime/register` | MetaRuntimeService.registerMeta |
| POST | `/api/v1/meta-runtime/:id/pause` | MetaRuntimeService.pauseMeta |
| POST | `/api/v1/meta-runtime/:id/terminate` | MetaRuntimeService.terminateMeta |
| GET | `/api/v1/meta-runtime/:id` | MetaRuntimeService.getMeta |
| GET | `/api/v1/meta-runtime/active` | MetaRuntimeService.listActiveMeta |
| POST | `/api/v1/meta-runtime/healing/start` | AutonomousHealingService.startHealing |
| POST | `/api/v1/meta-runtime/healing/:id/complete` | AutonomousHealingService.completeHealing |
| POST | `/api/v1/meta-runtime/healing/:id/fail` | AutonomousHealingService.failHealing |
| GET | `/api/v1/meta-runtime/healing/:id` | AutonomousHealingService.getHealing |
| POST | `/api/v1/meta-runtime/repair/start` | DistributedRepairService.startRepair |
| POST | `/api/v1/meta-runtime/repair/:id/complete` | DistributedRepairService.completeRepair |
| POST | `/api/v1/meta-runtime/repair/:id/fail` | DistributedRepairService.failRepair |
| GET | `/api/v1/meta-runtime/repair/:id` | DistributedRepairService.getRepair |
| POST | `/api/v1/meta-runtime/allocations` | MetaAllocationService.allocate |
| DELETE | `/api/v1/meta-runtime/allocations/:entityId` | MetaAllocationService.release |
| GET | `/api/v1/meta-runtime/allocations/:entityId` | MetaAllocationService.getAllocation |
| POST | `/api/v1/meta-runtime/coordination` | RuntimeCoordinationService.upsertCoordination |
| POST | `/api/v1/meta-runtime/coordination/:nodeId/fail` | RuntimeCoordinationService.failNode |
| GET | `/api/v1/meta-runtime/coordination/:nodeId` | RuntimeCoordinationService.getCoordination |
| POST | `/api/v1/meta-runtime/cleanup` | SelfHealingRecoveryService.cleanupStale |

## FiveM Events (Server-only)

| Event | Description |
|---|---|
| `atc:meta:register` | Register a new meta-orchestration process |
| `atc:meta:pause` | Pause a meta-runtime process |
| `atc:meta:terminate` | Terminate a meta-runtime process |
| `atc:meta:healing:start` | Start a healing operation on a target node |
| `atc:meta:healing:complete` | Mark healing operation complete |
| `atc:meta:repair:start` | Start a distributed repair job |
| `atc:meta:repair:complete` | Mark repair job complete |
| `atc:meta:allocation:upsert` | Upsert resource allocation for an entity |
| `atc:meta:coordination:upsert` | Upsert coordination role for a node |
| `atc:meta:coordination:fail` | Mark a node as failed in coordination |
| `atc:meta:cleanup` | Trigger stale cleanup (auto-scheduled every 5m) |

## Migrations
- `265_create_meta_runtime.sql`
- `266_create_runtime_healing.sql`
- `267_create_distributed_repair.sql`
- `268_create_meta_allocations.sql`
- `269_create_runtime_coordination.sql`
- `270_create_meta_audit.sql`

## Idempotency
Meta runtime and healing/repair operations use nonce-based UNIQUE constraints. Allocations use `ON DUPLICATE KEY UPDATE` on `entity_id`. Coordination uses `ON DUPLICATE KEY UPDATE` on `node_id` — both safe for repeated heartbeat updates.

## Cleanup Policy
`SelfHealingRecoveryService.cleanupStale(thresholdMs)` fans out in parallel across:
- Paused/terminated/degraded meta processes older than threshold
- Completed/failed healing operations older than threshold
- Completed/failed repair jobs older than threshold
- Released allocations older than threshold

Auto-scheduled every 5 minutes via the FiveM bridge.

## Self-Healing Loop
The meta bridge (`meta_runtime.lua`) auto-schedules `atc:meta:cleanup` every 5 minutes. This drives the self-healing cycle — stale processes are cleaned up, freeing resources for new healing/repair operations spawned by the orchestration layer.
