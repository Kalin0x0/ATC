# Phase 34 Runbook — World Synchronization & Scene Runtime

**Package:** `@atc/world-runtime`  
**Migrations:** 086–090  
**API routes:** 10  
**FiveM bridge:** `game/atc-core/server/world.lua`  
**Tests:** `packages/tests/src/world-runtime.test.ts`

---

## Overview

Phase 34 implements the authoritative server-side world synchronization and scene runtime for ATC. It covers the full lifecycle of world entities (vehicles, objects, peds, pickups, blips, zones) from registration through despawn and cleanup, coordinated scene containers with locking semantics, persistent scene snapshots, append-only entity ownership tracking, stale-state replication reconciliation, and a scheduled cleanup orchestrator that auto-runs on server restart.

All coordinate values are server-sanitized; no position data from the client is trusted without `tonumber()` validation. `networkId` is always mapped server-side from `GetNetworkIdFromEntity()`.

**Agent 1 scope only.** World state analytics, scene persistence dashboards, entity heatmaps, and cleanup audit reporting are owned by Agent 2 and are not built here.

---

## Package: `@atc/world-runtime`

Location: `packages/world-runtime/`

### Files

| File | Purpose |
|------|---------|
| `src/errors.ts` | 12 domain error classes |
| `src/world-entity.repository.ts` | Entity CRUD, status transitions, position reconcile |
| `src/scene-runtime.repository.ts` | Scene lifecycle CRUD with FOR UPDATE locking |
| `src/entity-ownership.repository.ts` | Append-only ownership acquire/release |
| `src/persistent-scene.repository.ts` | Persist/restore/prune scene snapshots |
| `src/runtime-cleanup.repository.ts` | Cleanup record insert, batch fetch, mark completed |
| `src/world-runtime.service.ts` | Entity registration and status orchestration |
| `src/scene-synchronization.service.ts` | Scene lifecycle orchestration |
| `src/persistent-scene.service.ts` | Scene snapshot persist/restore/prune |
| `src/entity-ownership.service.ts` | Entity ownership acquire/release |
| `src/runtime-replication.service.ts` | Position/state reconcile, stale entity detection |
| `src/cleanup-orchestration.service.ts` | Cleanup scheduling and batch processing |
| `src/index.ts` | Barrel exports |

---

## State Machines

### World Entity Status

```
registered  ──────────────────────────────► active
     │        ──────────────────────────────► despawned
     └────────────────────────────────────► cleanup_pending

active      ──────────────────────────────► despawned
     │        ──────────────────────────────► cleanup_pending
     └────────────────────────────────────► cleaned

despawned   ──────────────────────────────► active
     │        ──────────────────────────────► cleanup_pending
     └────────────────────────────────────► cleaned

cleanup_pending ──────────────────────────► cleaned

cleaned     ──────────────────────────────► (terminal)
```

Valid transitions:

| From | To allowed |
|------|------------|
| registered | active, despawned, cleanup_pending |
| active | despawned, cleanup_pending, cleaned |
| despawned | active, cleanup_pending, cleaned |
| cleanup_pending | cleaned |
| cleaned | (none — terminal) |

Any attempt to transition out of `cleaned` raises `WorldEntityImmutableError`.

### Scene Status

```
active          ──── suspend ────► suspended
  │              ──── destroy ────► destroyed        (terminal)
  └────────────── cleanup ──────► cleanup_pending

suspended       ──── resume ─────► active
  │              ──── destroy ────► destroyed        (terminal)
  └────────────── cleanup ──────► cleanup_pending

cleanup_pending ──── complete ───► destroyed        (terminal)

destroyed       ──────────────────────────────────► (terminal)
```

Valid transitions:

| From | To allowed |
|------|------------|
| active | suspended, destroyed, cleanup_pending |
| suspended | active, destroyed, cleanup_pending |
| cleanup_pending | destroyed |
| destroyed | (none — terminal) |

Scene rows with `is_locked = 1` reject all destructive transitions (`destroy`, `cleanup_pending`) and raise `SceneLockedError` before any write.

---

## Database Migrations

| # | File | Table | Key Notes |
|---|------|-------|-----------|
| 086 | `086_create_world_entities.sql` | `atc_world_entities` | UNIQUE KEY `uq_spawn_nonce(owner_principal_id, spawn_nonce)` prevents duplicate entity registration per owner |
| 087 | `087_create_scene_runtime.sql` | `atc_scene_runtime` | UNIQUE KEY `uq_scene_id(scene_id)` prevents duplicate scene creation |
| 088 | `088_create_entity_ownership.sql` | `atc_entity_ownership` | Append-only; INDEX `idx_entity_active(entity_id, released_at)` for active owner lookup |
| 089 | `089_create_persistent_scenes.sql` | `atc_persistent_scenes` | `data` column is opaque JSON; `expires_at` nullable for non-expiring scenes |
| 090 | `090_create_runtime_cleanup.sql` | `atc_runtime_cleanup` | INDEX `idx_pending(completed_at, scheduled_at)` drives oldest-first batch processing |

### Schema Notes

**`atc_world_entities`**  
`id CHAR(26)`, `entity_type ENUM('vehicle','object','ped','pickup','blip','zone','other')`, `owner_principal_id` nullable, `network_id INT` nullable, `model VARCHAR(128)`, `x/y/z/heading DECIMAL(10,4)`, `spawn_nonce VARCHAR(128)`, `status ENUM('registered','active','despawned','cleanup_pending','cleaned')`, `scene_id VARCHAR(128)` nullable, `spawned_at` nullable, `despawned_at` nullable, `created_at`

**`atc_scene_runtime`**  
`id CHAR(26)`, `scene_id VARCHAR(128)`, `creator_principal_id`, `label VARCHAR(255)`, `is_locked TINYINT`, `status ENUM('active','suspended','destroyed','cleanup_pending')`, `replication_node VARCHAR(128)` nullable, `entity_count INT UNSIGNED`, `created_at`, `updated_at`

**`atc_entity_ownership`**  
`id CHAR(26)`, `entity_id` FK → `atc_world_entities`, `scene_id VARCHAR(128)` nullable, `principal_id`, `acquired_at`, `released_at` nullable; never DELETE — `released_at` set on release

**`atc_persistent_scenes`**  
`id CHAR(26)`, `scene_id VARCHAR(128)`, `scene_type ENUM('crime_scene','accident','blockade','event','construction','other')`, `world_region VARCHAR(128)` nullable, `data JSON`, `persisted_at`, `expires_at` nullable, `restored_at` nullable

**`atc_runtime_cleanup`**  
`id CHAR(26)`, `target_type VARCHAR(64)`, `target_id VARCHAR(128)`, `cleanup_reason ENUM('timeout','manual','server_restart','owner_disconnect','scene_destroyed')`, `scheduled_at`, `completed_at` nullable, `node_id VARCHAR(128)` nullable

Run migrations:
```bash
pnpm --filter "@atc/db" db:migrate
```

---

## Services Architecture

```
WorldRuntimeService
  └── WorldEntityRepository (register, despawn, status transitions, findById, listByScene)

SceneSynchronizationService
  └── SceneRuntimeRepository (createScene, destroyScene, suspendScene, resumeScene, FOR UPDATE)

PersistentSceneService
  └── PersistentSceneRepository (persistScene, restoreScene, findBySceneId, pruneExpired)

EntityOwnershipService
  └── EntityOwnershipRepository (acquireOwnership, releaseOwnership, listByPrincipal, findActiveOwner)

RuntimeReplicationService
  └── WorldEntityRepository (reconcileEntity, batchReconcile, listStaleEntities)

CleanupOrchestrationService
  └── RuntimeCleanupRepository (scheduleCleanup, processNextBatch, markCompleted)
```

---

## Service Responsibilities

### `WorldRuntimeService`
Manages entity registration and status lifecycle. `registerEntity` inserts into `atc_world_entities` with the `spawn_nonce`; the UNIQUE KEY `uq_spawn_nonce(owner_principal_id, spawn_nonce)` rejects duplicate registrations and raises `WorldEntityAlreadySpawnedError` (409) without requiring a SELECT guard. `despawnEntity` transitions status to `despawned` and records `despawned_at`. `reconcilePosition` delegates to `RuntimeReplicationService`. Emits `atc:world:entity:registered`, `atc:world:entity:despawned`, `atc:world:entity:reconciled`.

### `SceneSynchronizationService`
Manages scene container lifecycle. `createScene` inserts into `atc_scene_runtime`; UNIQUE KEY `uq_scene_id` rejects duplicate `scene_id` values as `SceneAlreadyExistsError` (409). All destructive transitions (`destroyScene`, `suspendScene`) use `SELECT ... FOR UPDATE` on the scene row and check `is_locked = 1` before proceeding; a locked scene raises `SceneLockedError` (409). `resumeScene` re-activates a suspended scene. `listActive` returns all scenes with status `active`. Emits `atc:world:scene:created`, `atc:world:scene:destroyed`, `atc:world:scene:suspended`.

### `PersistentSceneService`
Handles scene snapshot persistence and restoration. `persistScene` writes or upserts a snapshot row in `atc_persistent_scenes` with a computed `expires_at` (from `expiresInSeconds`, if provided). `restoreScene` looks up by `scene_id` and sets `restored_at`. `pruneExpired` deletes rows where `expires_at < NOW()` — called periodically via the task scheduler. Scene `data` is stored as opaque JSON; no server-side evaluation occurs. Emits `atc:world:scene:persisted`, `atc:world:scene:restored`.

### `EntityOwnershipService`
Tracks which principal owns a given entity at any point in time. `acquireOwnership` uses `SELECT ... FOR UPDATE` on the entity row to prevent concurrent acquisition; if an active owner already exists (released_at IS NULL), raises `OwnershipConflictError` (409). `releaseOwnership` sets `released_at = NOW()` on the active ownership record. Records are append-only — never DELETE. `listByPrincipal` returns all ownership records (active and historical) for a principal. `findActiveOwner` returns the current owner via `released_at IS NULL`. Emits `atc:world:entity:ownership:acquired`, `atc:world:entity:ownership:released`.

### `RuntimeReplicationService`
Synchronizes live entity positions. `reconcileEntity` updates `x/y/z/heading`, `network_id`, and `last_sync_at` on the entity row; stale updates where the incoming timestamp is behind `last_sync_at` are rejected silently to prevent out-of-order overwrites. `batchReconcile` applies multiple position updates in a single transaction. `listStaleEntities` returns entities whose `last_sync_at` is older than a caller-supplied threshold, used by the periodic reconciliation sweep. Emits `atc:world:entity:reconciled`.

### `CleanupOrchestrationService`
Schedules and processes deferred cleanup work. `scheduleCleanup` inserts a record with a `cleanup_reason` and `scheduled_at`. `processNextBatch(limit)` fetches up to `limit` pending records (ordered by `scheduled_at` ASC, `completed_at IS NULL`) using row-level locks to prevent concurrent completion of the same record, then dispatches each cleanup. `markCompleted` sets `completed_at = NOW()` and `node_id`. Emits `atc:world:cleanup:scheduled`, `atc:world:cleanup:completed`.

---

## API Routes

**File:** `apps/api/src/routes/world.ts`

| Method | Path | Capability | Service |
|--------|------|------------|---------|
| POST | `/api/v1/world/entities` | `world:entity:register` | WorldRuntimeService.registerEntity |
| POST | `/api/v1/world/entities/:entityId/despawn` | `world:entity:register` | WorldRuntimeService.despawnEntity |
| POST | `/api/v1/world/entities/:entityId/reconcile` | `world:entity:reconcile` | RuntimeReplicationService.reconcileEntity |
| GET | `/api/v1/world/scenes` | `world:scene:read` | SceneSynchronizationService.listActive |
| POST | `/api/v1/world/scenes` | `world:scene:manage` | SceneSynchronizationService.createScene |
| POST | `/api/v1/world/scenes/:sceneId/destroy` | `world:scene:manage` | SceneSynchronizationService.destroyScene |
| POST | `/api/v1/world/scenes/persist` | `world:scene:manage` | PersistentSceneService.persistScene |
| POST | `/api/v1/world/scenes/:sceneId/restore` | `world:scene:manage` | PersistentSceneService.restoreScene |
| POST | `/api/v1/world/cleanup` | `world:cleanup:manage` | CleanupOrchestrationService.scheduleCleanup |
| POST | `/api/v1/world/cleanup/process` | `world:cleanup:manage` | CleanupOrchestrationService.processNextBatch |

---

## EventBus Events

All events emitted via `EventBus.emit()`. Fire-and-forget with `.catch(() => undefined)` to avoid blocking database transactions.

| Event | Emitter | Payload |
|-------|---------|---------|
| `atc:world:scene:created` | SceneSynchronizationService.createScene | `{ sceneId, creatorPrincipalId, label }` |
| `atc:world:scene:destroyed` | SceneSynchronizationService.destroyScene | `{ sceneId }` |
| `atc:world:scene:suspended` | SceneSynchronizationService.suspendScene | `{ sceneId }` |
| `atc:world:entity:registered` | WorldRuntimeService.registerEntity | `{ entityId, entityType, model, ownerPrincipalId }` |
| `atc:world:entity:despawned` | WorldRuntimeService.despawnEntity | `{ entityId }` |
| `atc:world:entity:reconciled` | RuntimeReplicationService.reconcileEntity | `{ entityId, x, y, z, heading }` |
| `atc:world:entity:ownership:acquired` | EntityOwnershipService.acquireOwnership | `{ entityId, principalId }` |
| `atc:world:entity:ownership:released` | EntityOwnershipService.releaseOwnership | `{ entityId, principalId }` |
| `atc:world:cleanup:scheduled` | CleanupOrchestrationService.scheduleCleanup | `{ cleanupId, targetType, targetId, cleanupReason }` |
| `atc:world:cleanup:completed` | CleanupOrchestrationService.markCompleted | `{ cleanupId, targetType, targetId }` |
| `atc:world:scene:persisted` | PersistentSceneService.persistScene | `{ sceneId, sceneType }` |
| `atc:world:scene:restored` | PersistentSceneService.restoreScene | `{ sceneId, sceneType }` |

---

## Error Hierarchy

```
WorldError (base)
├── WorldEntityNotFoundError(id)
├── WorldEntityValidationError(message)
├── WorldEntityAlreadySpawnedError(nonce)
├── WorldEntityImmutableError(id, from, to)
├── SceneNotFoundError(sceneId)
├── SceneAlreadyExistsError(sceneId)
├── SceneImmutableError(sceneId, from, to)
├── SceneLockedError(sceneId)
├── OwnershipConflictError(entityId)
├── OwnershipNotFoundError(entityId, principalId)
├── PersistentSceneNotFoundError(sceneId)
└── CleanupNotFoundError(id)
```

---

## Error Response Map

| Error Class | HTTP | Notes |
|-------------|------|-------|
| `WorldEntityNotFoundError` | 404 | |
| `SceneNotFoundError` | 404 | |
| `OwnershipNotFoundError` | 404 | |
| `PersistentSceneNotFoundError` | 404 | |
| `CleanupNotFoundError` | 404 | |
| `WorldEntityAlreadySpawnedError` | 409 | UNIQUE KEY `uq_spawn_nonce` violation |
| `WorldEntityImmutableError` | 409 | Illegal status transition (e.g., out of `cleaned`) |
| `SceneAlreadyExistsError` | 409 | UNIQUE KEY `uq_scene_id` violation |
| `SceneImmutableError` | 409 | Illegal scene status transition |
| `SceneLockedError` | 409 | `is_locked = 1` on scene row |
| `OwnershipConflictError` | 409 | FOR UPDATE + active owner already present |
| `WorldEntityValidationError` | 422 | Schema / input validation failure |

---

## Concurrency Design

### Duplicate Entity Registration Prevention
`WorldRuntimeService.registerEntity()` relies on the UNIQUE KEY `uq_spawn_nonce(owner_principal_id, spawn_nonce)` on `atc_world_entities`. Any race on concurrent registrations for the same owner and nonce raises `ER_DUP_ENTRY` on INSERT, caught and re-thrown as `WorldEntityAlreadySpawnedError` (409). No SELECT guard is needed.

### Scene Transition Locking
`SceneSynchronizationService` issues `SELECT ... FOR UPDATE` on the `atc_scene_runtime` row before any status transition. The `is_locked` flag is checked immediately after the lock is acquired; a value of `1` raises `SceneLockedError` before any mutation. Duplicate scene creation is prevented by the UNIQUE KEY `uq_scene_id(scene_id)`.

### Ownership Acquisition
`EntityOwnershipService.acquireOwnership()` issues `SELECT ... FOR UPDATE` on the entity row to serialize concurrent acquisition attempts. After acquiring the lock, it checks for an existing active ownership record (`released_at IS NULL`). If one is found, `OwnershipConflictError` is raised without an INSERT. Ownership records are never deleted — `released_at` is set on release. The index `idx_entity_active(entity_id, released_at)` keeps `findActiveOwner` fast.

### Stale Update Rejection
`RuntimeReplicationService.reconcileEntity()` compares the incoming `timestamp` against the stored `last_sync_at`. If the incoming value is behind `last_sync_at`, the update is discarded silently. This prevents out-of-order network packets from overwriting a more recent authoritative position.

### Cleanup Batch Safety
`CleanupOrchestrationService.processNextBatch()` fetches pending records with row-level locks to prevent two concurrent processing workers from completing the same cleanup record. `markCompleted` sets `completed_at` only once; a second attempt finds no matching incomplete row and is a no-op.

### Append-Only Ownership
Ownership records are never deleted. Active ownerships are identified by `released_at IS NULL`. `releaseOwnership` issues `UPDATE ... SET released_at = NOW() WHERE entity_id = ? AND principal_id = ? AND released_at IS NULL`. The permanent record of all past owners is available for audit and rollback.

---

## FiveM Bridge

**File:** `game/atc-core/server/world.lua`  
**SDK namespace:** `ATC.World`

### SDK Functions

| Function | Description |
|----------|-------------|
| `ATC.World.RegisterEntity(source, params, cb)` | Register a new world entity |
| `ATC.World.DespawnEntity(source, entityId, cb)` | Mark entity as despawned |
| `ATC.World.ReconcileEntity(source, entityId, pos, cb)` | Reconcile position and heading |
| `ATC.World.ListScenes(cb)` | List all active scenes |
| `ATC.World.CreateScene(source, params, cb)` | Create a new scene |
| `ATC.World.DestroyScene(source, sceneId, cb)` | Destroy an existing scene |
| `ATC.World.PersistScene(source, params, cb)` | Persist a scene snapshot |
| `ATC.World.RestoreScene(source, sceneId, cb)` | Restore a persisted scene |
| `ATC.World.ScheduleCleanup(source, params, cb)` | Schedule a cleanup record |
| `ATC.World.ProcessCleanups(cb)` | Process next cleanup batch |

### Server Events (client → server)

```lua
-- Client fires:
TriggerServerEvent('atc:world:entity:register:request', payload)
TriggerServerEvent('atc:world:entity:despawn:request',  entityId)
```

All principal IDs are resolved server-side via `ATC.Accounts.GetPrincipalId(source)`. Coordinates received from any source are sanitized with `tonumber()` before forwarding to the API — never trusted raw. `networkId` is always derived server-side via `GetNetworkIdFromEntity()` and is never accepted from the client.

### `onResourceStart` Handler

On `onResourceStart` for `atc-core`, the bridge waits 5 seconds then automatically calls `ATC.World.ProcessCleanups()`. This purges entities and scenes that were left in `registered`, `active`, or `cleanup_pending` states from the previous server session, preventing stale world state from persisting across restarts.

---

## Security Checklist

- [x] All coordinates server-sanitized with `tonumber()` in FiveM bridge — never trusted from client
- [x] `networkId` always resolved server-side via `GetNetworkIdFromEntity()` — never client-provided
- [x] Principal IDs resolved server-side via `ATC.Accounts.GetPrincipalId(source)` in bridge
- [x] UNIQUE KEY `uq_spawn_nonce(owner_principal_id, spawn_nonce)` prevents duplicate entity registration
- [x] FOR UPDATE on scene rows during status transitions; `is_locked` check before any destructive write
- [x] FOR UPDATE on entity rows during ownership acquisition; conflict check before INSERT
- [x] UNIQUE KEY `uq_scene_id(scene_id)` prevents duplicate scene creation
- [x] `WorldEntityImmutableError` and `SceneImmutableError` guard all terminal-state transitions
- [x] Capability checks on all write routes (`world:entity:register`, `world:entity:reconcile`, `world:scene:manage`, `world:cleanup:manage`)
- [x] Persistent scene `data` stored as opaque JSON — no server-side eval
- [x] Ownership records append-only — `released_at` set on release, never DELETE
- [x] Cleanup records append-only — `completed_at` set on completion, never DELETE
- [x] Model name validated at API boundary before any repository call
- [x] Input validated with Zod schema at API boundary before any repository call
- [x] No direct DB access outside repository layer
- [x] No hardcoded strings or credentials

---

## Agent Scope Boundary

This is an **Agent 1** deliverable. The following are explicitly **out of scope** and belong to Agent 2:

- World state analytics and aggregate reporting
- Scene persistence dashboards and management UIs
- Entity heatmaps and spatial density analytics
- Cleanup audit reporting and history views
- Entity count trends and replication health dashboards

---

## Operational Notes

### Automatic Post-Restart Cleanup
The `onResourceStart` handler in `game/atc-core/server/world.lua` triggers `ProcessCleanups` with a 5-second delay on each server start. This automatically purges stale entities and scenes from the previous session. Monitor logs for `cleanup:completed` events immediately after server start to confirm the sweep ran.

### Expired Persistent Scene Pruning
`PersistentSceneService.pruneExpired()` removes rows from `atc_persistent_scenes` where `expires_at < NOW()`. This must be called periodically via the ATC task scheduler. If not scheduled, expired scenes accumulate silently and `restoreScene` may return stale data for IDs that should no longer exist.

### Reconciliation Sweep
`RuntimeReplicationService.listStaleEntities(threshold)` returns entities whose `last_sync_at` is older than `threshold` milliseconds. The periodic reconciliation sweep uses this to detect desynchronized entities. Stale entities should either be reconciled with a fresh position or transitioned to `cleanup_pending`.

### Scene Lock Flag
The `is_locked` flag on `atc_scene_runtime` is set externally by privileged operations (e.g., raid coordination) to protect a scene from destructive transitions while a critical game event is in progress. Always verify `is_locked` status before attempting `destroyScene` or `suspendScene` programmatically. Use the SQL below to inspect or clear stuck locks.

---

## Operational SQL

### List all active world entities by scene

```sql
SELECT e.id, e.entity_type, e.model, e.owner_principal_id,
       e.x, e.y, e.z, e.status, e.scene_id, e.spawned_at
FROM atc_world_entities e
WHERE e.scene_id = ? AND e.status = 'active'
ORDER BY e.spawned_at ASC;
```

### List all entities in cleanup_pending (stale after restart)

```sql
SELECT id, entity_type, model, owner_principal_id, status,
       scene_id, spawned_at, despawned_at
FROM atc_world_entities
WHERE status = 'cleanup_pending'
ORDER BY spawned_at ASC;
```

### Force-transition a stuck entity to cleaned (manual recovery)

```sql
-- Verify first:
SELECT id, status, model, spawned_at FROM atc_world_entities WHERE id = ?;

-- Then force-clean:
UPDATE atc_world_entities
SET status = 'cleaned'
WHERE id = ? AND status = 'cleanup_pending';
```

### List all active scenes

```sql
SELECT id, scene_id, creator_principal_id, label,
       is_locked, entity_count, replication_node,
       created_at, updated_at
FROM atc_scene_runtime
WHERE status = 'active'
ORDER BY created_at ASC;
```

### Clear a stuck scene lock

```sql
-- Verify first:
SELECT scene_id, label, is_locked, status FROM atc_scene_runtime WHERE scene_id = ?;

-- Unlock only if safe to do so:
UPDATE atc_scene_runtime
SET is_locked = 0
WHERE scene_id = ? AND is_locked = 1;
```

### Force-destroy a stuck scene (after server crash)

```sql
-- Verify first:
SELECT scene_id, status, is_locked, entity_count FROM atc_scene_runtime WHERE scene_id = ?;

-- Unlock and destroy:
UPDATE atc_scene_runtime
SET is_locked = 0, status = 'destroyed', updated_at = NOW()
WHERE scene_id = ? AND status IN ('active', 'suspended', 'cleanup_pending');
```

### Find the active owner of an entity

```sql
SELECT eo.principal_id, eo.acquired_at, eo.scene_id
FROM atc_entity_ownership eo
WHERE eo.entity_id = ? AND eo.released_at IS NULL;
```

### List all ownership history for an entity

```sql
SELECT eo.id, eo.principal_id, eo.scene_id,
       eo.acquired_at, eo.released_at
FROM atc_entity_ownership eo
WHERE eo.entity_id = ?
ORDER BY eo.acquired_at ASC;
```

### List pending cleanups (not yet completed)

```sql
SELECT id, target_type, target_id, cleanup_reason,
       scheduled_at, node_id
FROM atc_runtime_cleanup
WHERE completed_at IS NULL
ORDER BY scheduled_at ASC;
```

### List completed cleanups in the last hour

```sql
SELECT id, target_type, target_id, cleanup_reason,
       scheduled_at, completed_at, node_id
FROM atc_runtime_cleanup
WHERE completed_at >= NOW() - INTERVAL 1 HOUR
ORDER BY completed_at DESC;
```

### List persistent scenes expiring within the next 24 hours

```sql
SELECT id, scene_id, scene_type, world_region,
       persisted_at, expires_at, restored_at
FROM atc_persistent_scenes
WHERE expires_at IS NOT NULL
  AND expires_at BETWEEN NOW() AND NOW() + INTERVAL 24 HOUR
ORDER BY expires_at ASC;
```

### Prune expired persistent scenes (manual run)

```sql
-- Audit what will be removed:
SELECT id, scene_id, scene_type, expires_at
FROM atc_persistent_scenes
WHERE expires_at IS NOT NULL AND expires_at < NOW();

-- Delete expired scenes:
DELETE FROM atc_persistent_scenes
WHERE expires_at IS NOT NULL AND expires_at < NOW();
```

### Identify stale entities (last_sync_at older than 5 minutes)

```sql
SELECT id, entity_type, model, owner_principal_id,
       scene_id, status, last_sync_at,
       TIMESTAMPDIFF(SECOND, last_sync_at, NOW()) AS seconds_stale
FROM atc_world_entities
WHERE status = 'active'
  AND last_sync_at < NOW() - INTERVAL 5 MINUTE
ORDER BY last_sync_at ASC;
```

### Check for duplicate spawn nonces (anti-double-registration audit)

```sql
SELECT owner_principal_id, spawn_nonce, COUNT(*) AS hits
FROM atc_world_entities
GROUP BY owner_principal_id, spawn_nonce
HAVING hits > 1;
-- Should always return 0 rows due to UNIQUE KEY.
-- Any results indicate a constraint violation that requires investigation.
```
