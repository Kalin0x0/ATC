# Phase 72 — Autonomous Runtime Sovereignty, Infinite Cluster Continuity & Global Runtime Finalization

## Overview

Phase 72 provides the sovereignty layer for ATC's distributed runtime: server ownership establishment, cluster health continuity across infinite node counts, autonomous finalization, and ordered succession protocols. This is the authoritative source of truth for which server instance holds runtime sovereignty at any moment.

**Package:** `@atc/runtime-sovereignty`
**API prefix:** `/api/v1/runtime-sovereignty`
**Migrations:** 313–318

---

## Architecture

### Services

| Service | Context field | Purpose |
|---|---|---|
| `RuntimeSovereigntyService` | `runtimeSovereigntyService` | Establish/confirm/challenge/revoke sovereignty |
| `InfiniteClusterContinuityService` | `infiniteClusterContinuityService` | Register and track cluster node health |
| `AutonomousFinalizationService` | `autonomousFinalizationService` | Initiate/process/complete autonomous finalization |
| `RuntimeSuccessionService` | `runtimeSuccessionService` | Planned and emergency succession between servers |
| `DistributedSovereigntyCoordinator` | `distributedSovereigntyCoordinator` | Cross-cluster sovereignty coordination |
| `SovereigntyRecoveryService` | `sovereigntyRecoveryService` | Stale-record cleanup across all repos |

### Tables

| Table | Key column | Cleanup states |
|---|---|---|
| `atc_runtime_sovereignty` | `sovereignty_id` | `revoked`, `expired` |
| `atc_cluster_continuity` | `cluster_id` (VARCHAR, UPSERT) | `offline`, `failed` |
| `atc_autonomous_finalization` | `finalization_id` | `finalized`, `aborted`, `failed` |
| `atc_runtime_succession` | `succession_id` | `completed`, `failed`, `reverted` |
| `atc_sovereignty_coordination` | `coordination_id` (VARCHAR, UPSERT) | `suspended`, `expired` |
| `atc_sovereignty_audit` | — (append-only) | never |

---

## State Machines

### RuntimeSovereignty
```
establishing → established | challenged | revoked | expired
```

### ClusterContinuity (upsert — no terminal insert status)
```
active → degraded → recovering → active
                  → failed
       → offline
```

### AutonomousFinalization
```
pending → processing → finalized
                     → aborted
                     → failed
```

### RuntimeSuccession
```
pending → transferring → completed
                       → failed
                       → reverted
```

---

## API Endpoints

### Sovereignty
- `POST /api/v1/runtime-sovereignty` — establish
- `POST /api/v1/runtime-sovereignty/:id/confirm`
- `POST /api/v1/runtime-sovereignty/:id/challenge`
- `POST /api/v1/runtime-sovereignty/:id/revoke`
- `POST /api/v1/runtime-sovereignty/:id/expire`
- `GET  /api/v1/runtime-sovereignty/:id`

### Cluster
- `POST /api/v1/runtime-sovereignty/cluster` — register (upsert)
- `POST /api/v1/runtime-sovereignty/cluster/:id/degrade`
- `POST /api/v1/runtime-sovereignty/cluster/:id/recover`
- `POST /api/v1/runtime-sovereignty/cluster/:id/fail`
- `GET  /api/v1/runtime-sovereignty/cluster/:clusterId`

### Autonomous Finalization
- `POST /api/v1/runtime-sovereignty/finalization`
- `POST /api/v1/runtime-sovereignty/finalization/:id/process`
- `POST /api/v1/runtime-sovereignty/finalization/:id/complete`
- `POST /api/v1/runtime-sovereignty/finalization/:id/abort`
- `POST /api/v1/runtime-sovereignty/finalization/:id/fail`
- `GET  /api/v1/runtime-sovereignty/finalization/:id`

### Succession
- `POST /api/v1/runtime-sovereignty/succession`
- `POST /api/v1/runtime-sovereignty/succession/:id/transfer`
- `POST /api/v1/runtime-sovereignty/succession/:id/complete`
- `POST /api/v1/runtime-sovereignty/succession/:id/fail`
- `POST /api/v1/runtime-sovereignty/succession/:id/revert`
- `GET  /api/v1/runtime-sovereignty/succession/:id`

### Coordination
- `POST /api/v1/runtime-sovereignty/coordination`
- `POST /api/v1/runtime-sovereignty/coordination/:id/suspend`
- `POST /api/v1/runtime-sovereignty/coordination/:id/expire`
- `GET  /api/v1/runtime-sovereignty/coordination/:coordinationId`

### Cleanup
- `POST /api/v1/runtime-sovereignty/cleanup` — body: `{ "thresholdMs": 300000 }`

---

## FiveM Events

Events registered in `game/atc-core/server/runtime_sovereignty.lua`.

| Event | Action |
|---|---|
| `atc:sovereignty:establish` | Establish sovereignty |
| `atc:sovereignty:confirm` | Confirm |
| `atc:sovereignty:challenge` | Challenge |
| `atc:sovereignty:revoke` | Revoke |
| `atc:sovereignty:cluster:register` | Register cluster node |
| `atc:sovereignty:cluster:degrade` | Mark node degraded |
| `atc:sovereignty:cluster:fail` | Mark node failed |
| `atc:sovereignty:finalization:initiate` | Initiate finalization |
| `atc:sovereignty:finalization:process` | Begin processing |
| `atc:sovereignty:finalization:complete` | Mark finalized |
| `atc:sovereignty:succession:initiate` | Start succession |
| `atc:sovereignty:succession:transfer` | Begin transfer |
| `atc:sovereignty:succession:complete` | Complete succession |
| `atc:sovereignty:succession:revert` | Revert succession |
| `atc:sovereignty:coordination:upsert` | Upsert coordination |
| `atc:sovereignty:cleanup` | Manual cleanup trigger |

Scheduled cleanup fires automatically every 5 minutes via `CreateThread`.

---

## Sovereignty Conflict Resolution

When two servers simultaneously establish sovereignty (race condition):

1. Both INSERT with status `establishing` — unique nonce prevents duplicate
2. First server calls `confirm` → `established`
3. Second server's confirm attempt finds the record already `established`
4. Second server should call `challenge` on the first server's record
5. Resolution is application-level: the coordinator reviews and either confirms or revokes

The `atc_runtime_succession` table tracks explicit ownership transfers with `target_server_id` to make planned transitions auditable.

---

## Cluster Continuity

Cluster nodes use UPSERT semantics — the same `cluster_id` can be re-registered without error. Node health state transitions:

- **active**: Healthy, participating
- **degraded**: Reduced capacity, still serving
- **recovering**: Coming back from degraded/offline
- **failed**: Unrecoverable — requires manual intervention
- **offline**: Intentionally removed from rotation

Cleanup removes `offline` and `failed` nodes older than `thresholdMs`.

---

## Recovery

`SovereigntyRecoveryService.cleanupStale(thresholdMs)` returns:

```typescript
{ sovereignties, clusterNodes, finalizations, successions, coordinations }
```

---

## Operational Checklist

- [ ] Verify migrations 313–318 applied: `SHOW TABLES LIKE 'atc_runtime_sovereignty'`
- [ ] Confirm all 6 context fields non-null at startup
- [ ] Test sovereignty round-trip: establish → confirm → GET
- [ ] Test cluster register → degrade → recover
- [ ] Test succession: initiate → transfer → complete
- [ ] Verify finalization: initiate → process → complete
- [ ] Verify cleanup fires every 5 min (CreateThread)
- [ ] Confirm audit entries on all state transitions
- [ ] Stress-test sovereignty conflict: two concurrent establish calls for same nonce → only one succeeds
