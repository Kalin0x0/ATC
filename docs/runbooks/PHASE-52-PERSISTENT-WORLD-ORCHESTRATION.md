# Phase 52 — Persistent World Orchestration

## Overview

Phase 52 implements the top-level world orchestration layer for ATC's massively persistent world. It manages world regions, distributed shards, regional simulations, runtime load balancing, and full-world recovery.

**Package:** `@atc/world-orchestrator`  
**API Routes:** `/api/v1/orchestrator/*`  
**FiveM Bridge:** `ATC.WorldOrchestrator.*`

---

## DB Tables

| Table | Purpose |
|---|---|
| `atc_world_regions` | Persistent world region registry with bounds and capacity |
| `atc_runtime_allocations` | Tracks which server each region/shard is allocated to |
| `atc_shard_runtime` | Distributed shard state (type, owner, region, capacity) |
| `atc_regional_simulations` | Per-region simulation config and active state |
| `atc_world_balancing` | Rebalancing event history |
| `atc_orchestration_audit` | Audit log for orchestration operations |

Migrations: `193_create_world_regions.sql` through `198_create_orchestration_audit.sql`

---

## Services

| Service | Responsibility |
|---|---|
| `WorldOrchestratorService` | Register, transfer, deactivate, recover world regions |
| `DistributedShardService` | Allocate, transfer, list, cleanup shards |
| `RegionalSimulationService` | Start, stop, list regional simulations |
| `RuntimeBalancingService` | Trigger load rebalancing across servers |
| `RuntimeAllocationService` | Track and manage server-to-region allocations |
| `PersistentWorldRecoveryService` | Full-world recovery after cluster events |

---

## API Endpoints

### World Regions
- `POST /api/v1/orchestrator/regions/upsert` — Register or update a world region
- `GET /api/v1/orchestrator/regions/active` — List all active regions
- `POST /api/v1/orchestrator/regions/transfer` — Transfer region ownership between servers
- `DELETE /api/v1/orchestrator/regions/:regionId` — Deactivate a region
- `POST /api/v1/orchestrator/regions/recover` — Trigger region-level recovery

### Shards
- `POST /api/v1/orchestrator/shards/allocate` — Allocate a new shard
- `GET /api/v1/orchestrator/shards/active` — List all active shards
- `POST /api/v1/orchestrator/shards/transfer` — Transfer shard between servers
- `POST /api/v1/orchestrator/shards/cleanup` — Remove stale shards

### Regional Simulations
- `POST /api/v1/orchestrator/simulations/upsert` — Start or update a regional simulation
- `GET /api/v1/orchestrator/simulations/active` — List all running simulations
- `DELETE /api/v1/orchestrator/simulations/:regionId` — Stop a regional simulation

### Rebalancing
- `POST /api/v1/orchestrator/rebalance` — Trigger load rebalancing (optional region + threshold)

### World Recovery
- `POST /api/v1/orchestrator/recovery` — Trigger full-world or shard-level recovery

---

## FiveM Bridge Usage

```lua
-- Register a world region on startup
ATC.WorldOrchestrator.UpsertRegion(
  'region-downtown',
  'city',
  GetConvar('sv_hostname', 'unknown'),
  { minX = -800, maxX = 800, minY = -800, maxY = 800 },
  300
)

-- Allocate a world shard
ATC.WorldOrchestrator.AllocateShard(
  'shard-main-world',
  'world',
  GetConvar('sv_hostname', 'unknown'),
  'region-downtown',
  500
)

-- Start a regional simulation
ATC.WorldOrchestrator.UpsertSimulation(
  'region-downtown',
  'full',
  GetConvar('sv_hostname', 'unknown'),
  { tickRate = 20, npcBudget = 200 }
)

-- Transfer region to another server
ATC.WorldOrchestrator.TransferRegion('region-downtown', 'server-1', 'server-2')

-- Trigger load rebalance when server is over 80% capacity
ATC.WorldOrchestrator.Rebalance('region-downtown', 80)

-- Recover after a crash
ATC.WorldOrchestrator.Recover('shard-main-world', 'region-downtown')
```

---

## Region Types

| Type | Description |
|---|---|
| `city` | Dense urban area with full simulation |
| `wilderness` | Low-density outdoor area |
| `ocean` | Maritime zone |
| `interior` | Interior instances (buildings, tunnels) |
| `instance` | Instanced content (missions, arenas) |
| `custom` | Plugin-defined regions |

## Shard Types

| Type | Description |
|---|---|
| `world` | Persistent open-world shard |
| `instance` | Private instance shard |
| `arena` | PvP or competitive shard |
| `lobby` | Pre-game/transition area |
| `custom` | Plugin-defined |

## Simulation Types

| Type | Description |
|---|---|
| `full` | Full NPC + physics + event simulation |
| `partial` | Reduced fidelity (fewer NPCs, lower tick) |
| `minimal` | Skeleton simulation (world events only) |
| `frozen` | No simulation (static world) |

---

## Operational Runbook

### Server overload — trigger rebalance

When a server exceeds its entity budget:

```lua
-- Rebalance all regions on this server above 80% load
ATC.WorldOrchestrator.Rebalance(nil, 80)
```

Or per-region:

```lua
ATC.WorldOrchestrator.Rebalance('region-downtown', 75)
```

The service records a balancing event in `atc_world_balancing` for audit.

### Region transfer during rolling restart

Before restarting a server node:

1. List all regions owned by this server: `GET /api/v1/orchestrator/regions/active`
2. For each region: `POST /api/v1/orchestrator/regions/transfer` to a healthy node
3. Verify: `GET /api/v1/orchestrator/regions/active` — all regions on new server
4. Restart the node

### Shard cleanup after crash

After a server crashes without graceful shutdown:

1. `POST /api/v1/orchestrator/shards/cleanup` with `thresholdMs: 120000`
2. Re-allocate orphaned shards on healthy servers
3. Run `POST /api/v1/orchestrator/recovery` with the crashed server's shard IDs

### Stopping a simulation during low-population window

```lua
-- Freeze simulation to save resources
ATC.WorldOrchestrator.UpsertSimulation('region-wilderness-north', 'frozen', serverId, {})

-- Or stop entirely
ATC.WorldOrchestrator.StopSimulation('region-wilderness-north')
```

### Full-world recovery procedure

After a catastrophic event (data center failover, multi-node crash):

1. Start fresh cluster nodes
2. `POST /api/v1/orchestrator/recovery` — no body, recovers all shards and regions
3. `GET /api/v1/orchestrator/regions/active` — verify all regions registered
4. `GET /api/v1/orchestrator/shards/active` — verify all shards allocated
5. `POST /api/v1/orchestrator/simulations/upsert` — restart simulations per region
6. Run Phase 51 consistency check: `GET /api/v1/reconciliation/consistency/check`

### Capacity limit enforcement

`capacityLimit` is stored but enforced at the application layer. When an allocation push exceeds limit:

1. Query `atc_world_regions` for current entity counts
2. Trigger rebalance: `POST /api/v1/orchestrator/rebalance` with `thresholdPercent: 90`
3. Consider allocating a new `instance` shard for overflow

---

## Error Reference

| Error | HTTP | Meaning |
|---|---|---|
| `WorldRegionNotFoundError` | 404 | Region ID not registered |
| `DuplicateWorldRegionError` | 409 | Region with this ID already exists |
| `RuntimeAllocationNotFoundError` | 404 | Allocation record not found |
| `ShardRuntimeNotFoundError` | 404 | Shard ID not found |
| `DuplicateShardError` | 409 | Shard with this ID already allocated |
| `RegionalSimulationNotFoundError` | 404 | No simulation record for this region |
| `StaleShardError` | 409 | Shard record is stale and cannot be transferred |
