# Phase 66 Runbook — Autonomous Runtime Evolution, Adaptive Optimization & Self-Tuning Infrastructure

## Overview

Phase 66 introduces the autonomous evolution layer for Atlantic Core. This phase establishes:

- **Runtime Evolution** — tracked lifecycle for schema/behavior/protocol/topology/config evolution cycles
- **Adaptive Optimization** — per-node optimization sessions (memory, cpu, latency, throughput, custom)
- **Runtime Tuning** — per-entity self-tuning configuration (upsert-based, keyed by `entity_id`)
- **Autonomous Evolution** — fully autonomous trigger→apply→revert lifecycle
- **Distributed Optimization** — per-node optimization state (upsert-based, keyed by `node_id`)
- **Audit Log** — append-only evolution event log

---

## Package

**`@atc/evolution-runtime`** — `packages/evolution-runtime/`

### Key Files

| File | Purpose |
|---|---|
| `pool.ts` | Duck-typed pool interface (`EvolutionRuntimePool`) |
| `id.ts` | ULID generator via `ulidx` monotonicFactory |
| `errors.ts` | 6 typed error classes |
| `runtime-evolution.repository.ts` | CRUD + FOR UPDATE status transitions |
| `adaptive-optimization.repository.ts` | CRUD + FOR UPDATE status transitions |
| `runtime-tuning.repository.ts` | ON DUPLICATE KEY UPDATE upsert by `entity_id` |
| `autonomous-evolution.repository.ts` | CRUD + FOR UPDATE status transitions |
| `distributed-optimization.repository.ts` | ON DUPLICATE KEY UPDATE upsert by `node_id` |
| `evolution-audit.repository.ts` | INSERT-only audit log |
| `runtime-evolution.service.ts` | `EvolutionRuntimeService` |
| `adaptive-optimization.service.ts` | `AdaptiveOptimizationService` |
| `runtime-tuning.service.ts` | `RuntimeTuningService` |
| `autonomous-evolution.service.ts` | `AutonomousEvolutionService` |
| `distributed-optimization.service.ts` | `DistributedOptimizationService` |
| `evolution-recovery.service.ts` | `EvolutionRecoveryService` — stale cleanup |

---

## Database Migrations

| Migration | Table | Purpose |
|---|---|---|
| 277 | `atc_runtime_evolution` | Evolution lifecycle records |
| 278 | `atc_adaptive_optimization` | Per-node optimization sessions |
| 279 | `atc_runtime_tuning` | Per-entity tuning config (UNIQUE on `entity_id`) |
| 280 | `atc_autonomous_evolution` | Autonomous trigger→apply lifecycle |
| 281 | `atc_distributed_optimization` | Per-node distributed opt state (UNIQUE on `node_id`) |
| 282 | `atc_evolution_audit` | Append-only audit log |

---

## API Endpoints

### Runtime Evolution
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/evolution/start` | Start new evolution |
| POST | `/api/v1/evolution/:id/activate` | Activate pending evolution |
| POST | `/api/v1/evolution/:id/complete` | Complete evolution |
| POST | `/api/v1/evolution/:id/fail` | Fail evolution |
| POST | `/api/v1/evolution/:id/rollback` | Rollback evolution |
| GET | `/api/v1/evolution/:id` | Get evolution |

### Adaptive Optimization
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/evolution/optimize` | Start optimization session |
| POST | `/api/v1/evolution/optimize/:id/complete` | Complete optimization |
| POST | `/api/v1/evolution/optimize/:id/fail` | Fail optimization |
| GET | `/api/v1/evolution/optimize/:id` | Get optimization |

### Runtime Tuning
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/evolution/tune` | Upsert tuning config |
| GET | `/api/v1/evolution/tune/:entityId` | Get tuning by entity |

### Autonomous Evolution
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/evolution/autonomous/trigger` | Trigger autonomous evolution |
| POST | `/api/v1/evolution/autonomous/:id/apply` | Apply autonomous evolution |
| POST | `/api/v1/evolution/autonomous/:id/revert` | Revert autonomous evolution |
| GET | `/api/v1/evolution/autonomous/:id` | Get autonomous evolution |

### Distributed Optimization
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/evolution/distributed-opt` | Upsert distributed optimization |
| POST | `/api/v1/evolution/distributed-opt/:nodeId/fail` | Mark node failed (204) |
| GET | `/api/v1/evolution/distributed-opt/:nodeId` | Get by node |

### Cleanup
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/evolution/cleanup` | Cleanup stale records |

---

## FiveM Event Bridge

Lua bridge: `game/atc-core/server/evolution.lua`

### Events (Server-only)

| Event | Parameters | Description |
|---|---|---|
| `atc:evolution:start` | `evolutionType, evolutionNonce, evolutionData` | Start evolution |
| `atc:evolution:activate` | `id` | Activate evolution |
| `atc:evolution:complete` | `id` | Complete evolution |
| `atc:evolution:fail` | `id` | Fail evolution |
| `atc:evolution:rollback` | `id` | Rollback evolution |
| `atc:optimization:start` | `optimizationType, targetNode, ownerServerId, optimizationNonce, optimizationData` | Start optimization |
| `atc:optimization:complete` | `id` | Complete optimization |
| `atc:tuning:upsert` | `entityId, tuningType, tuningData` | Upsert tuning |
| `atc:autonomous:trigger` | `triggerType, triggerNonce, triggerData` | Trigger autonomous evo |
| `atc:autonomous:apply` | `id` | Apply autonomous evo |
| `atc:autonomous:revert` | `id` | Revert autonomous evo |
| `atc:distopt:upsert` | `nodeId, optType, ownerServerId, optData` | Upsert distributed opt |
| `atc:distopt:fail` | `nodeId` | Mark node failed |
| `atc:evolution:cleanup` | `thresholdMs` | Trigger cleanup |

Cleanup runs automatically every 5 minutes via `CreateThread`.

---

## Error Reference

| Error Class | Trigger |
|---|---|
| `EvolutionRuntimeNotFoundError` | Evolution ID not found in status update |
| `DuplicateEvolutionRuntimeError` | Duplicate `(evolution_nonce, owner_server_id)` |
| `OptimizationNotFoundError` | Optimization ID not found |
| `DuplicateOptimizationError` | Duplicate optimization nonce |
| `AutonomousEvolutionNotFoundError` | Autonomous evolution ID not found |
| `DuplicateAutonomousEvolutionError` | Duplicate autonomous trigger nonce |

---

## Operational Notes

- Runtime tuning and distributed optimization use `ON DUPLICATE KEY UPDATE` for idempotent upserts
- Evolution status flow: `pending` → `active` → `completed` | `failed` | `rolled_back`
- Autonomous evolution status flow: `triggered` → `applying` → `applied` | `failed` | `reverted`
- The cleanup endpoint fans out to all 4 tables and returns per-table counts
- All non-upsert status transitions use `FOR UPDATE` transactions to prevent concurrent corruption
