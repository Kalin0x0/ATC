# Phase 50 — Replication, Streaming & Spatial Ownership Runtime

## Overview

Phase 50 implements the spatial replication backbone for ATC's multi-server persistent world. It manages which server owns which entity, how entities stream across server boundaries, and maintains spatial node topology for region-based partitioning.

**Package:** `@atc/replication-runtime`  
**API Routes:** `/api/v1/replication/*`  
**FiveM Bridge:** `ATC.Replication.*`

---

## DB Tables

| Table | Purpose |
|---|---|
| `atc_spatial_nodes` | Server/zone topology nodes with position data |
| `atc_runtime_snapshots` | Entity state snapshots for cross-server sync |
| `atc_spatial_ownership` | Which server currently owns each entity |
| `atc_interest_regions` | Spatial interest region bounds per server |
| `atc_streaming_runtime` | Per-entity streaming state (active/paused/frozen/culled) |
| `atc_replication_audit` | Audit log for ownership and streaming events |

Migrations: `181_create_spatial_nodes.sql` through `186_create_replication_audit.sql`

---

## Services

| Service | Responsibility |
|---|---|
| `SpatialOwnershipService` | Claim, transfer, release, cleanup entity ownership |
| `ReplicationRuntimeService` | Create and replay snapshots |
| `InterestManagementService` | Register and manage spatial interest regions |
| `RuntimeStreamingService` | Update and cleanup streaming states |
| `SpatialPartitionService` | Register spatial nodes, list active topology |
| `SnapshotSynchronizationService` | High-level snapshot orchestration across nodes |

---

## API Endpoints

### Spatial Nodes
- `POST /api/v1/replication/nodes/upsert` — Register or update a spatial node
- `GET /api/v1/replication/nodes/active` — List all active spatial nodes
- `POST /api/v1/replication/nodes/cleanup` — Remove stale nodes older than `thresholdMs`

### Spatial Ownership
- `POST /api/v1/replication/ownership/claim` — Claim ownership of an entity
- `POST /api/v1/replication/ownership/transfer` — Transfer ownership between servers
- `GET /api/v1/replication/ownership/:entityId` — Get current owner of an entity
- `DELETE /api/v1/replication/ownership/:entityId` — Release ownership
- `POST /api/v1/replication/ownership/cleanup` — Remove stale ownership records

### Streaming Runtime
- `POST /api/v1/replication/streaming/upsert` — Update entity streaming state
- `GET /api/v1/replication/streaming/:entityId` — Get current streaming state
- `POST /api/v1/replication/streaming/cleanup` — Remove stale streaming records

### Snapshots
- `POST /api/v1/replication/snapshots/create` — Create an entity state snapshot
- `POST /api/v1/replication/snapshots/:snapshotId/replay` — Replay a snapshot
- `GET /api/v1/replication/snapshots/entity/:entityId` — List snapshots for an entity

### Interest Regions
- `POST /api/v1/replication/interest-regions/upsert` — Register or update an interest region
- `GET /api/v1/replication/interest-regions/active` — List all active interest regions
- `DELETE /api/v1/replication/interest-regions/:regionId` — Deactivate an interest region

---

## FiveM Bridge Usage

```lua
-- Register this server as a spatial node
ATC.Replication.UpsertNode('node-server-1', 'server', GetConvar('sv_hostname', 'unknown'), 'region-downtown', {
  x = 0, y = 0, z = 0
})

-- Claim ownership of a spawned entity
ATC.Replication.ClaimOwnership('entity-npc-123', 'npc', GetConvar('sv_hostname', 'unknown'), 'region-downtown')

-- Transfer ownership to another server
ATC.Replication.TransferOwnership('entity-npc-123', 'server-1', 'server-2')

-- Update streaming state when entity leaves interest range
ATC.Replication.UpdateStreamingState('entity-npc-123', 'culled', GetConvar('sv_hostname', 'unknown'))

-- Take a checkpoint snapshot before migration
ATC.Replication.CreateSnapshot('entity-player-1', 'checkpoint', GetConvar('sv_hostname', 'unknown'), {
  position = { x = 100, y = 200, z = 10 },
  health   = 750,
}, 42)
```

---

## Entity Types

| Type | Description |
|---|---|
| `npc` | AI-controlled entities |
| `vehicle` | Vehicles (owned or spawned) |
| `player` | Player characters |
| `zone` | Zone entities |
| `object` | World objects |
| `custom` | Extension point |

## Streaming States

| State | Description |
|---|---|
| `active` | Fully simulated and networked |
| `paused` | Simulation paused, state preserved |
| `frozen` | No simulation, position locked |
| `culled` | Outside interest range, not networked |

---

## Operational Runbook

### Ownership conflict detected

When two servers claim ownership of the same entity, `DuplicateSpatialOwnershipError` is thrown.

1. Query `atc_spatial_ownership` by `entity_id`
2. Determine which server is authoritative (lower latency to player)
3. Call `DELETE /api/v1/replication/ownership/:entityId` on the non-authoritative server
4. Re-claim via `POST /api/v1/replication/ownership/claim` on the authoritative server

### Stale ownership cleanup

Run periodically (every 60s recommended):

```lua
ATC.Replication.CleanupStaleOwnership(60000)
ATC.Replication.CleanupStaleStreaming(60000)
ATC.Replication.CleanupStaleNodes(60000)
```

### Entity migration snapshot flow

1. `CreateSnapshot(entityId, 'checkpoint', ...)` — capture state
2. `ClaimOwnership(entityId, ...)` on target server
3. `ReleaseOwnership(entityId)` on source server
4. `UpdateStreamingState(entityId, 'active', targetServerId)` on target

### Snapshot replay

When an entity's state needs to be restored from a previous checkpoint:

```lua
-- Get list of snapshots
local snapshots = ATC.Replication.ListSnapshotsByEntity('entity-player-1')
-- Replay a specific snapshot
ATC.Replication.ReplaySnapshot(snapshotId)
```

---

## Error Reference

| Error | HTTP | Meaning |
|---|---|---|
| `SpatialOwnershipNotFoundError` | 404 | No ownership record for entity |
| `DuplicateSpatialOwnershipError` | 409 | Entity already owned by a server |
| `SpatialNodeNotFoundError` | 404 | Node ID not registered |
| `SnapshotNotFoundError` | 404 | Snapshot ID does not exist |
| `InterestRegionNotFoundError` | 404 | Interest region not found |
| `StreamingRuntimeNotFoundError` | 404 | No streaming record for entity |
| `StaleOwnershipError` | 409 | Ownership record is too old to transfer |
