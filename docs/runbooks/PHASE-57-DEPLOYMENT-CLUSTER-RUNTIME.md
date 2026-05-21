# Phase 57 — Deployment, Cluster Orchestration & Runtime Lifecycle

## Overview

Phase 57 provides server-authoritative cluster node registration, deployment orchestration, node lifecycle management, horizontal/vertical scaling, and entity-to-node allocation. All operations are server-side only and replay-safe via nonce idempotency.

**Package:** `@atc/cluster-runtime`
**API prefix:** `/api/v1/cluster`
**FiveM bridge:** `game/atc-core/server/cluster_runtime.lua`

---

## Services

| Service | Responsibility |
|---|---|
| `ClusterRuntimeService` | Register, deregister, and list cluster nodes |
| `DeploymentOrchestrationService` | Start, complete, fail, and fetch deployments |
| `NodeLifecycleService` | Upsert and deactivate per-node lifecycle state |
| `RuntimeScalingService` | Start, complete, fail, and fetch scaling operations |
| `ClusterAllocationService` | Allocate entities to nodes, release allocations |
| `DistributedDeploymentRecoveryService` | Cleanup stale nodes, deployments, released allocations |

---

## Database Tables

| Table | Purpose |
|---|---|
| `atc_cluster_nodes` | Registered cluster nodes with status and address |
| `atc_runtime_deployments` | Deployment operations with nonce idempotency |
| `atc_cluster_scaling` | Scaling event records (horizontal/vertical) |
| `atc_runtime_allocation` | Per-entity node allocation (upsert by entity_id) |
| `atc_node_lifecycle` | Per-node lifecycle state (upsert by node_id) |
| `atc_cluster_audit` | Append-only audit log for all cluster events |

---

## API Endpoints

### Nodes
- `POST /api/v1/cluster/nodes/register` — Register a cluster node
- `POST /api/v1/cluster/nodes/:id/deregister` — Take node offline
- `GET  /api/v1/cluster/nodes/:id` — Fetch node by ID
- `GET  /api/v1/cluster/nodes/active` — List active nodes

### Deployments
- `POST /api/v1/cluster/deployments/start` — Start a deployment
- `POST /api/v1/cluster/deployments/:id/complete` — Mark deployment completed
- `POST /api/v1/cluster/deployments/:id/fail` — Mark deployment failed
- `GET  /api/v1/cluster/deployments/:id` — Fetch deployment

### Scaling
- `POST /api/v1/cluster/scaling/start` — Start a scaling operation
- `POST /api/v1/cluster/scaling/:id/complete` — Complete scaling
- `POST /api/v1/cluster/scaling/:id/fail` — Fail scaling
- `GET  /api/v1/cluster/scaling/:id` — Fetch scaling record

### Lifecycle
- `POST /api/v1/cluster/lifecycle/upsert` — Upsert node lifecycle state
- `GET  /api/v1/cluster/lifecycle/:nodeId` — Get lifecycle for node
- `POST /api/v1/cluster/lifecycle/:nodeId/deactivate` — Deactivate lifecycle

### Allocation
- `POST /api/v1/cluster/allocation/allocate` — Allocate entity to node
- `GET  /api/v1/cluster/allocation/:entityId` — Get allocation for entity
- `POST /api/v1/cluster/allocation/:entityId/release` — Release allocation

### Cleanup
- `POST /api/v1/cluster/cleanup` — Purge stale nodes, deployments, allocations

---

## FiveM Events

| Event | Direction | Description |
|---|---|---|
| `atc:cluster:node:register` | Server-only | Register a node |
| `atc:cluster:deployment:start` | Server-only | Start a deployment |
| `atc:cluster:lifecycle:upsert` | Server-only | Upsert node lifecycle |
| `atc:cluster:allocation:allocate` | Server-only | Allocate entity to node |
| `atc:cluster:cleanup` | Scheduler | Purge stale cluster data |

---

## Idempotency

Nodes are idempotent by `(node_nonce, owner_server_id)` UNIQUE constraint → `DuplicateNodeError`.
Deployments are idempotent by `(deployment_nonce, owner_server_id)` → `DuplicateDeploymentError`.

---

## Cleanup

Call `POST /api/v1/cluster/cleanup` with `{ "thresholdMs": 300000 }`. Returns `{ nodes, deployments, allocations }` purge counts. The scheduler bridge event `atc:cluster:cleanup` fires this automatically.

---

## Context Keys (AppContext)

```typescript
clusterRuntimeService?:                ClusterRuntimeService
deploymentOrchestrationService?:       DeploymentOrchestrationService
nodeLifecycleService?:                 NodeLifecycleService
runtimeScalingService?:                RuntimeScalingService
clusterAllocationService?:             ClusterAllocationService
distributedDeploymentRecoveryService?: DistributedDeploymentRecoveryService
clusterNodeRepo?:                      ClusterNodeRepository
runtimeDeploymentRepo?:                RuntimeDeploymentRepository
clusterScalingRepo?:                   ClusterScalingRepository
runtimeAllocationRepo?:                RuntimeAllocationRepository
nodeLifecycleRepo?:                    NodeLifecycleRepository
clusterAuditRepo?:                     ClusterAuditRepository
```

---

## Error Reference

| Error | HTTP | Trigger |
|---|---|---|
| `ClusterNodeNotFoundError` | 404 | Node ID not in DB |
| `DuplicateNodeError` | 409 | Duplicate `(node_nonce, owner_server_id)` |
| `DeploymentNotFoundError` | 404 | Deployment ID not in DB |
| `DuplicateDeploymentError` | 409 | Duplicate `(deployment_nonce, owner_server_id)` |
| `ScalingNotFoundError` | 404 | Scaling ID not in DB |
| `DuplicateScalingError` | 409 | Duplicate scaling nonce |
| `AllocationNotFoundError` | 404 | Allocation entity ID not in DB |
