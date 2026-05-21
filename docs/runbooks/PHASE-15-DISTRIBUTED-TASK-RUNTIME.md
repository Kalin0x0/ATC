# Phase 15 — Distributed Task Runtime & Async Job Infrastructure

## Overview

Phase 15 adds a fully isolated, capability-gated async task runtime to ATC. Plugins can enqueue or schedule background jobs without access to arbitrary execution — every operation is permission-checked, payload-validated, queue-scoped, and telemetry-instrumented.

---

## Packages Introduced

| Package | Description |
|---|---|
| `@atc/task-runtime` | Core: queue, worker, scheduler, runtime, retry, error types |
| `@atc/event-store` | Event persistence: append, replay, snapshot, prune |

---

## Architecture

```
Plugin (tasksApi)
    │  tasks.enqueue / tasks.schedule capability required
    ▼
PluginTasksApiImpl (container.ts)
    │  capability check → registry.incrementDeniedCall / incrementApiCall
    │  queueName = atc:tasks:plugin:{pluginId}
    ▼
AtcTaskRuntime
    │  type validation (/^[a-z0-9_.-]+$/)
    │  payload size check (512 KB max)
    │  telemetry increment
    │  EventBus emit atc:task:queued
    ▼
AtcTaskQueue
    │  active queues: Redis LPUSH / RPOP
    │  delayed queue: Redis ZADD (sorted set, score = scheduledAt timestamp)
    ▼
InMemoryTaskQueueStorage (tests) | RedisTaskQueueStorage (production)
```

```
AtcTaskScheduler (setInterval loop)
    │  every intervalMs (default 100ms)
    ▼
  tick()
    ├── promoteReady()  → move due delayed tasks to active queues
    └── for each queue with idle workers:
            dequeue() → fire-and-forget processTask()
                            │
                        AtcWorker.execute()
                            ├── withTimeout(timeoutMs)
                            ├── handler(task)
                            └── outcome: completed | retry | dead-letter
```

---

## Queue Design

### Active Queues (FIFO)

```
atc:tasks:default           — system tasks (no pluginId)
atc:tasks:plugin:{pluginId} — per-plugin isolated queues
```

Redis commands: `LPUSH` (enqueue), `RPOP` (dequeue).

Max depth per queue: **10,000 tasks**. Exceeding throws `TaskQueueOverloadedError`.

### Delayed Queue (sorted set)

```
atc:tasks:delayed
```

Score = Unix timestamp (ms) of `scheduledAt`. Promotion via `ZRANGEBYSCORE 0 <now> LIMIT 0 <n>` + `ZREM`.

Max delay: **24 hours** (86,400,000 ms). Plugin API clamps silently.

### Dead Letter Queue (DLQ)

```
atc:tasks:dlq
```

Redis LPUSH. Tasks land here when:
- Error is non-retryable (permission denied, schema validation, malformed payload)
- Retryable error but `retryCount >= maxRetries`

---

## Retry & Recovery

### Failure Classification

| Error class | Outcome |
|---|---|
| `AtcPermissionDeniedError` | Dead-letter immediately |
| `TaskPayloadInvalidError` | Dead-letter immediately |
| `TaskTypeInvalidError` | Dead-letter immediately |
| Any error with name containing `Invalid` | Dead-letter immediately |
| `TaskTimeoutError` | Retry (timeout is transient) |
| Generic `Error` | Retry if attempts remain |

### Exponential Backoff

```
delay = min(initialDelayMs × backoffMultiplier^attemptNumber, maxDelayMs)
```

Default policy:
- `maxRetries`: 3
- `initialDelayMs`: 1,000ms
- `backoffMultiplier`: 2
- `maxDelayMs`: 30,000ms

Retry tasks are re-scheduled as delayed tasks with `scheduledAt = now + delay`.

---

## Plugin Capability Model

Plugins must declare capabilities in `atc.manifest.json`:

```json
{
  "capabilities": ["tasks.enqueue", "tasks.schedule"]
}
```

- `tasks.enqueue` — required to call `tasksApi.enqueue()`
- `tasks.schedule` — required to call `tasksApi.schedule()`
- Having either capability makes `tasksApi` present on the container
- Missing both capabilities → `container.tasksApi === undefined`
- Denied calls increment `registry.getDeniedCalls(pluginId)`
- Permitted calls increment `registry.getApiCalls(pluginId)`

### Plugin API

```typescript
// Returns ok:true + task ID, or ok:false + error message
container.tasksApi.enqueue(type, payload, opts?)
container.tasksApi.schedule(type, payload, delayMs, opts?)

// opts: { maxRetries?: number, timeoutMs?: number }
```

Plugin tasks are always scoped to `atc:tasks:plugin:{pluginId}` — they cannot write to other queues.

---

## Event Store

The `@atc/event-store` package provides append-only event persistence for `atc:*` domain events.

### Storage Backends

| Backend | Use |
|---|---|
| `InMemoryEventStoreStorage` | Tests (no Redis dependency) |
| `RedisEventStoreStorage` | Production (Redis Streams via XADD/XRANGE/XTRIM) |

### Stream Naming

Events are stored under stream keys matching the `eventName`:
```
atc:events:stream:atc:task:completed
atc:events:stream:atc:task:queued
```

### API

```typescript
store.append(eventName, payload, source)    → AtcStoredEvent
store.replay(eventName, fromStreamId?)      → AtcStoredEvent[]
store.snapshot(eventName, limit?)           → AtcStoredEvent[] (last N)
store.prune(eventName, { maxEvents?, maxAgeMs? })
store.getStreamLength(eventName)            → number
store.getAllStreamNames()                   → string[]
```

### Age-based Trim

`trimByAge` for `InMemoryEventStoreStorage` is fully implemented. For `RedisEventStoreStorage`, age-based trim (MINID) requires Redis 6.2+ and is deferred to Phase 16.

---

## EventBus Events

All events are emitted on the internal `AtcEventBus` (not exposed to clients):

| Event | Payload |
|---|---|
| `atc:task:queued` | `AtcTask` (state: queued) |
| `atc:task:started` | `AtcTask` (state: running) |
| `atc:task:completed` | `AtcTask` (state: completed) |
| `atc:task:failed` | `AtcTask` (state: failed) |
| `atc:task:retrying` | `AtcTask` (state: retrying) |
| `atc:task:cancelled` | `{ id: string }` |

---

## Telemetry

| Key | Type | Description |
|---|---|---|
| `atc.tasks.queued_total` | counter | Total tasks enqueued |
| `atc.tasks.completed_total` | counter | Total tasks completed |
| `atc.tasks.failed_total` | counter | Total tasks failed (DLQ) |
| `atc.tasks.retried_total` | counter | Total retry attempts |
| `atc.tasks.active_workers` | gauge | Current registered worker count |
| `plugin.{id}.tasks_processed` | counter | Per-plugin completed |
| `plugin.{id}.tasks_failed` | counter | Per-plugin DLQ |

---

## Runtime API Endpoints

All endpoints require authentication (inherited from global auth middleware).

### `GET /api/v1/runtime/tasks`

Returns runtime-level task metrics.

```json
{
  "queuedTotal": 1042,
  "completedTotal": 1038,
  "failedTotal": 2,
  "retriedTotal": 8,
  "avgRuntimeMs": 142.5,
  "queues": [
    { "name": "atc:tasks:default", "depth": 2, "deadLetterSize": 2, "processingCount": 1 }
  ]
}
```

### `GET /api/v1/runtime/workers`

```json
{
  "activeWorkers": 3,
  "workers": [
    { "workerId": "worker-test.job-abc", "pluginId": null, "queueName": "atc:tasks:default",
      "processedJobs": 410, "failures": 0, "retries": 0, "totalExecutionMs": 82000,
      "isRunning": false, "startedAt": "2026-05-16T12:00:00.000Z" }
  ]
}
```

### `GET /api/v1/runtime/queues`

```json
{
  "queues": [
    { "name": "atc:tasks:default", "depth": 2, "deadLetterSize": 2, "processingCount": 1 }
  ],
  "eventStreams": ["atc:task:queued", "atc:task:completed"]
}
```

---

## FiveM Lua Bridge (Read-Only)

Located at `game/atc-core/server/tasks.lua`. Provides read-only access to task state for Lua scripts — no task execution from Lua.

```lua
ATC.Tasks.GetMetrics()        -- { queuedTotal, completedTotal, failedTotal, retriedTotal, avgRuntimeMs, activeWorkers }
ATC.Tasks.GetQueue(name)      -- { name, depth }
ATC.Tasks.GetQueueNames()     -- string[]
ATC.Tasks.GetRecentEvents()   -- last 50 events (ring buffer)
ATC.Tasks.IsActive()          -- boolean
```

The Lua bridge populates via EventBus handler registrations. No FiveM client access; the bridge is server-side only.

---

## Scheduler Lifecycle

```
AtcTaskRuntime.start()  → AtcTaskScheduler.start()  → setInterval(tick, intervalMs)
AtcTaskRuntime.stop()   → AtcTaskScheduler.stop()   → clearInterval
```

Both `start()` and `stop()` are idempotent — calling them multiple times is safe.

The scheduler tick is overlap-safe: the interval callback fires the tick as a fire-and-forget promise (`void this._tick().catch(() => undefined)`), so a slow tick never blocks the next interval.

---

## Operational Notes

### Registering Workers

Workers are registered at startup in `apps/api/src/index.ts`:

```typescript
taskRuntime.registerWorker('my.task.type', async (task) => {
  // handle task.payload
}, { queueName: 'atc:tasks:default' })
```

A worker `id` is returned: `worker-{type}-{uuid}`. Workers can be unregistered by ID.

### Queue Depth Monitoring

Watch `atc.tasks.queued_total` vs `atc.tasks.completed_total` — a growing gap indicates a processing backlog.

Alert threshold: any queue depth > 5,000 (50% of max).

### DLQ Inspection

Tasks in `atc:tasks:dlq` are stored as serialized JSON. Use `GET /api/v1/runtime/tasks` to monitor `deadLetterSize`. Manual inspection requires direct Redis access.

### Task Cancellation

```typescript
const cancelled = taskRuntime.cancel(taskId)  // true if cancelled, false if not found
```

Cancellation is best-effort: tasks already dequeued and being executed cannot be cancelled. Cancelled task IDs are tracked in-memory and checked before execution.

### Task Type Format

Valid task types: lowercase alphanumeric, dots, dashes, underscores. Regex: `/^[a-z0-9_.-]+$/`.

Examples: `test.job`, `identity.sync-character`, `inventory.expire_item`

---

## Known Limitations

1. **No Redis persistence for cancelled IDs** — `_cancelledIds` is in-memory. Cancelled tasks not yet executed will re-execute after a process restart if they are already in the Redis queue.
2. **DLQ has no size limit** — Monitor `deadLetterSize` and implement periodic DLQ draining in Phase 16.
3. **Age-based trim for Redis event streams** — requires Redis 6.2+ MINID. Currently a no-op for `RedisEventStoreStorage`. Implement in Phase 16.
4. **Worker registry is in-memory** — Workers must re-register on every process start. This is expected for FiveM server restarts.
5. **No distributed lock on scheduler tick** — Running multiple API instances would result in duplicate task processing. Use a single scheduler instance (one API process) or add Redis-based distributed lock in Phase 16.

---

## Hardening Audit (Phase 15-H)

Four correctness bugs were identified and fixed during a post-Phase-15 security and correctness audit.

### BUG-15H-1 (HIGH): Premature state transition in `_executeTask`

**Problem**: `_executeTask` set `state='running'` and emitted `atc:task:started` before checking for an idle worker. If no idle worker was available and the task was re-enqueued, the in-process state showed `running` — making the task uncanellable via `cancel()` (which blocks cancellation of running tasks).

**Fix**: Move the idle-worker lookup to the FIRST step in `_executeTask`, before any state mutations or event emissions. Only update state and emit `atc:task:started` after a worker is confirmed.

### BUG-15H-2 (HIGH): Silent task loss on overloaded re-enqueue

**Problem**: When no idle worker was available and the re-enqueue failed (queue at `maxQueueDepth`), the `.catch(() => undefined)` handler silently dropped the task.

**Fix**: Replace the silent catch with a full DLQ handler: increment `failedTotal`, emit `atc:task:failed`, and call `sendToDeadLetter`. The task is preserved in `atc:tasks:dlq` instead of being lost.

**Trigger condition**: Concurrent scheduler ticks (overlap-safe design) can both dequeue different tasks before either processTask sets the worker to `isRunning=true`. The second processTask finds no idle worker and must re-enqueue. If the queue is already at capacity, this triggers the overload path.

### BUG-15H-3 (HIGH): Bulk data loss in `promoteReady` on malformed items

**Problem**: `promoteReady()` had no per-item try-catch. A single malformed item (bad JSON) in the delayed sorted set would throw and abort processing of all subsequent items — which had already been atomically removed from the sorted set by `popReadyDelayed()`.

**Fix**: Wrap each item in a per-item try-catch. Malformed items are dead-lettered; valid items continue to be promoted. No item is ever lost permanently.

### BUG-15H-4 (MEDIUM): Malformed active-queue items silently dropped

**Problem**: `dequeue()` threw `TaskPayloadInvalidError` on malformed JSON. The scheduler caught this with `.catch(() => null)`, silently discarding the raw bytes — no DLQ, no audit trail.

**Fix**: `dequeue()` now catches deserialization errors internally, calls `pushToDeadLetter(raw)`, and returns `null`. The raw bytes are preserved in `atc:tasks:dlq` for inspection.

**Impact on tests**: The existing test `'dequeue throws TaskPayloadInvalidError on malformed JSON'` was updated to assert `null` return and DLQ increment instead of a thrown error.

---

## Test Coverage

| Test file | Scope |
|---|---|
| `task-queue.test.ts` | InMemoryTaskQueueStorage + AtcTaskQueue (FIFO, delayed, DLQ, overload, malformed-DLQ) |
| `task-worker.test.ts` | AtcWorker outcomes + AtcWorkerRegistry |
| `task-scheduler.test.ts` | Scheduler tick, promotion, dispatch, start/stop lifecycle |
| `task-runtime.test.ts` | AtcTaskRuntime enqueue/schedule/cancel/register/process loop/metrics |
| `event-store.test.ts` | InMemoryEventStoreStorage + AtcEventStore CRUD |
| `task-plugin-api.test.ts` | Plugin capability gating, scoped queues, deniedCalls, apiCalls |
| `task-runtime-hardening.test.ts` | BUG-15H-1/2/3/4 regression coverage, concurrent-tick DLQ, cancel state machine, retry mechanics, EventBus contract |
| `server.test.ts` (runtime routes) | `GET /api/v1/runtime/tasks`, `GET /api/v1/runtime/workers`, `GET /api/v1/runtime/queues` — 200 shape, 401 auth, no-secrets |
