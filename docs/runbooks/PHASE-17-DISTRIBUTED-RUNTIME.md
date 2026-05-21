# Phase 17 — Distributed Runtime Foundation

## Overview

Phase 17 adds the distributed runtime foundation for ATC to support multiple API instances, multiple worker processes, distributed event fanout, distributed task coordination, and cluster-safe runtime state using Redis as the only coordination layer.

**Strict constraints:** Local (single-instance) mode continues to work identically with no Redis coordination required. All distributed features are opt-in and fail-open.

---

## What Was Built

### 1. Distributed Runtime Types (`@atc/shared-types`)

New types exported from `packages/shared-types/src/operations.ts`:

```typescript
type AtcRedisConnectionState = 'connected' | 'reconnecting' | 'degraded' | 'failed'

interface AtcRuntimeNodeRecord {
  instanceId: string; hostname: string; pid: number; startedAt: string;
  capabilities: string[]; version: string;
}

interface AtcRuntimeNodeStatus extends AtcRuntimeNodeRecord {
  isStale: boolean; lastHeartbeatAt: string | null;
}

interface AtcClusterSnapshot {
  capturedAt: string; leader: string | null; nodes: AtcRuntimeNodeStatus[];
  totalNodes: number; staleNodes: number; totalWorkers: number;
  activeWorkers: number; schedulerRunning: boolean;
}
```

`AtcStoredEvent` now has an optional `sourceInstanceId?: string` field to track which node appended an event.

---

### 2. Runtime Node Service (`@atc/runtime-node`)

**Package:** `packages/runtime-node/`

Handles node registration and cluster membership:

```typescript
const node = new AtcRuntimeNodeService(redis, {
  instanceId: 'api-node-1',
  capabilities: ['tasks', 'events', 'api'],
})

await node.register()           // HSET atc:runtime:nodes, SETEX heartbeat key (30s TTL)
node.startHeartbeat(10_000)    // Refreshes heartbeat every 10s
await node.listNodes()          // Returns all nodes with stale detection
await node.deregister()         // Removes from registry + heartbeat key
node.stopHeartbeat()
```

**Redis keys:**
- `atc:runtime:nodes` — HSET, field = instanceId, value = JSON(AtcRuntimeNodeRecord)
- `atc:runtime:heartbeat:{instanceId}` — SETEX 30s, value = `'alive'`

A node is **stale** if its heartbeat key has expired (EXISTS returns 0).

**Fail-open:** All Redis operations have try/catch — failures are silent and the process continues.

---

### 3. Redis Event Bridge — Distributed Features (`@atc/events`)

`AtcRedisEventBridge` in `packages/events/src/redis-bridge.ts` enhanced with:

**Loop prevention:** Messages from the same `sourceNodeId` as the local node are dropped.

**Event-level deduplication:** Tracks `eventId` in a `Map<string, expiry>` (60s window). Duplicate messages within 60s are dropped.

**Connection state tracking:** `bridge.connectionState` returns `AtcRedisConnectionState`.

**Auto-resubscription:** On Redis `ready` event (reconnect), all subscribed channels are re-subscribed.

**New methods:**
- `unsubscribe(eventName, handler)` — removes a specific handler
- `getSubscribedEvents()` — returns list of subscribed event names

**Interface change:** `BridgeRedisLike` duck-typed interface replaces direct `ioredis.Redis` import.

---

### 4. Worker Lease Manager (`@atc/task-runtime`)

`AtcWorkerLeaseManager` in `packages/task-runtime/src/lease.ts`:

```typescript
const leaseManager = new AtcWorkerLeaseManager(redis, { ttlMs: 30_000 })

await leaseManager.acquireLease(taskId, workerId)  // SET NX EX — returns false if taken
await leaseManager.renewLease(taskId, workerId)    // Lua: check owner, extend TTL
await leaseManager.releaseLease(taskId, workerId)  // Lua: check owner, delete
await leaseManager.getOwner(taskId)                // GET — returns current holder or null
await leaseManager.registerWorker(workerId, instanceId)  // SETEX worker:key
await leaseManager.deregisterWorker(workerId)             // DEL worker:key
```

**Redis keys:**
- `atc:tasks:lease:{taskId}` — lease holder ID (SET NX EX)
- `atc:tasks:worker:{workerId}` — instance ID (SETEX 2× ttlSeconds)

**Fail-open for acquire:** Redis unavailability returns `true` (degrades to single-instance behavior — tasks may run more than once in this mode, which is acceptable for the fail-open posture).

**Fail-closed for renew/release:** Returns `false` on error (conservative).

---

### 5. Scheduler Leader Election (`@atc/task-runtime`)

`AtcSchedulerLeaderElection` in `packages/task-runtime/src/leader.ts`:

```typescript
const election = new AtcSchedulerLeaderElection(redis, instanceId, {
  ttlMs: 15_000,
  onBecomeLeader: () => telemetry.increment('runtime.leader_changes_total'),
  onLoseLeader: () => { /* log, alert */ },
})

await election.tryAcquire()  // SET NX EX — returns true if leader
await election.renew()       // Lua check-and-extend — returns false if lost leadership
await election.release()     // DEL key + onLoseLeader callback
await election.getLeader()   // GET — returns current leader instanceId or null
election.startRenewLoop()    // Background: renews if leader, acquires if not
election.stopRenewLoop()
await election.stop()        // Closes + releases leadership
```

**Redis key:** `atc:runtime:scheduler:leader` — SET NX EX with instanceId as value

**Fail-open:** If Redis is unavailable during `tryAcquire()`, the node assumes leadership and continues running. This prevents the scheduler from stopping due to Redis unavailability.

---

### 6. Integration into Task Runtime and Scheduler

`AtcTaskRuntimeOptions` now accepts optional distributed fields:

```typescript
const taskRuntime = new AtcTaskRuntime({
  storage,
  telemetry,
  eventBus,
  instanceId: 'api-node-1',           // stable lease holder ID
  leaseManager,                         // optional: prevents duplicate execution
  leaderElection,                       // optional: scheduler runs only on leader
})
```

**Scheduler leader check:** If `leaderElection` is set and `isLeader` is false, `_tick()` returns early — no tasks are processed on non-leader instances.

**Lease guard in `_executeTask()`:** After finding an idle worker:
1. Acquire lease for `task.id` using `instanceId`
2. If lease not acquired → skip (another instance is handling this task)
3. Execute task in try/finally
4. Release lease on completion (or error)

---

### 7. Event Store — Source Instance Metadata

`AtcEventStore.append()` now accepts an optional 4th argument:

```typescript
await eventStore.append(eventName, payload, source, sourceInstanceId)
```

The `sourceInstanceId` is stored in the stream and returned in `AtcStoredEvent.sourceInstanceId`.  Backwards compatible — existing 3-argument calls continue to work.

---

### 8. Cluster API Routes

New endpoints under `/api/v1/ops/` (auth required):

**`GET /api/v1/ops/nodes`**

Returns all registered cluster nodes:
```json
{
  "total": 2,
  "nodes": [
    {
      "instanceId": "api-node-1",
      "hostname": "server-01",
      "pid": 1234,
      "startedAt": "2026-05-17T00:00:00Z",
      "capabilities": ["tasks", "events", "api"],
      "version": "22.0.0",
      "isStale": false,
      "lastHeartbeatAt": "2026-05-17T00:01:00Z"
    }
  ]
}
```

**`GET /api/v1/ops/cluster`**

Returns full cluster snapshot:
```json
{
  "capturedAt": "2026-05-17T00:01:00Z",
  "leader": "api-node-1",
  "nodes": [...],
  "totalNodes": 2,
  "staleNodes": 0,
  "totalWorkers": 4,
  "activeWorkers": 2,
  "schedulerRunning": true
}
```

---

### 9. Cluster Schemas (`@atc/operations`)

Zod schemas for validation:

```typescript
import { runtimeNodeStatusSchema, clusterSnapshotSchema } from '@atc/operations'
```

---

### 10. FiveM Bridge — Cluster Awareness

`game/atc-core/server/ops.lua` new functions:

```lua
-- Fetch full cluster snapshot
ATC.Ops.GetClusterState(function(ok, snapshot, err) end)

-- Get cached cluster snapshot (no HTTP round-trip)
ATC.Ops.GetCachedClusterState()

-- Get just the current leader instanceId
ATC.Ops.GetLeader(function(ok, leaderId, err) end)

-- Get list of active nodes
ATC.Ops.GetNodeInfo(function(ok, nodes, err) end)
```

Event handler for `atc:ops:cluster:snapshot` caches incoming cluster snapshots pushed from the TS layer.

---

## AppContext Changes

```typescript
interface AppContext {
  // ... existing fields
  runtimeNode?: AtcRuntimeNodeService    // optional — cluster membership
  leaderElection?: AtcSchedulerLeaderElection  // optional — scheduler coordination
}
```

`apps/api/src/index.ts` now instantiates `AtcRuntimeNodeService` and:
- Calls `register()` on startup
- Starts the heartbeat loop (10s interval)
- Calls `stopHeartbeat()` + `deregister()` on shutdown

---

## Distributed Telemetry Counter Names

These counter names are used for distributed runtime observability. Increment them in callbacks and event handlers when wiring up the optional services:

| Counter | Where to increment |
|---|---|
| `runtime.nodes_active` | On node register/deregister |
| `runtime.leader_changes_total` | In `onBecomeLeader` + `onLoseLeader` callbacks |
| `runtime.distributed_events_total` | In Redis bridge publish |
| `runtime.redis_reconnects_total` | In Redis bridge `ready` event |
| `runtime.task_recoveries_total` | When lease acquisition fails (skipped task) |
| `runtime.orphan_tasks_total` | When stale nodes are detected with active leases |

---

## Deployment — Running Multiple Instances

To run ATC in distributed mode:

1. **Set unique node IDs:** `ATC_NODE_ID=api-node-1` (different per instance)
2. **Point all instances to the same Redis:** Standard Redis config env vars
3. **No additional config needed:** Leader election and lease management are automatic

Single-instance mode (no change to existing deployments): `ATC_NODE_ID` can be left at its default (`atc-api-1`). All distributed features are fail-open.

---

## Stale Node Recovery

A node is stale when its heartbeat key (`atc:runtime:heartbeat:{instanceId}`) expires (30s TTL, refreshed every 10s). Stale nodes are detected in `listNodes()` via Redis `EXISTS`.

On clean shutdown, `deregister()` removes the node immediately. On crash, the heartbeat key naturally expires after 30s.

To manually remove a stale node:
```bash
redis-cli hdel atc:runtime:nodes <instanceId>
redis-cli del atc:runtime:heartbeat:<instanceId>
```

---

## Tests Added (Phase 17)

| File | Tests | Coverage |
|---|---|---|
| `runtime-node.test.ts` | register, heartbeat, deregister, listNodes (stale/live/error), startHeartbeat, stopHeartbeat |
| `worker-lease.test.ts` | acquireLease (NX, taken, fail-open), renewLease (owner/non-owner), releaseLease (owner/non-owner), getOwner, registerWorker |
| `leader-election.test.ts` | tryAcquire (free/taken/fail-open/stopped), renew (owner/lost/error), release, getLeader, startRenewLoop |
| `redis-bridge-distributed.test.ts` | loop prevention, deduplication, subscribe/unsubscribe, reconnect resubscription, connection state transitions, publish, malformed messages |
| `server.test.ts` (new) | GET /ops/nodes (empty/with nodes/401), GET /ops/cluster (empty/leader/staleNodes/workers/401) |

**Total tests: 1,305** (up from 1,227 in Phase 16)
