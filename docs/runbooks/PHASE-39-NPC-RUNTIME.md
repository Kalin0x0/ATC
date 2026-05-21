# Phase 39 — AI Civilian, NPC & Dynamic Population Runtime

## Overview

Phase 39 introduces the `@atc/npc-runtime` package, providing server-authoritative management of NPC lifecycle, crowd simulation, ambient behavior, and dynamic spawning. All NPC state is owned by the server that spawned the NPC and tracked via heartbeats.

## Package: `@atc/npc-runtime`

### Services

| Service | Responsibility |
|---|---|
| `NpcRuntimeService` | Ownership claims, heartbeats, stale reconciliation |
| `DynamicSpawnService` | Spawn/despawn with idempotency via nonce |
| `AmbientBehaviorService` | Record behavior transitions per NPC |
| `CrowdSimulationService` | Zone-level crowd density tracking |
| `CivilianPopulationService` | Population zone management |
| `NpcCleanupService` | Stale NPC cleanup with audit trail |

### Repositories

| Repository | Table |
|---|---|
| `NpcRuntimeRepository` | `atc_npc_runtime` |
| `PopulationZoneRepository` | `atc_population_zones` |
| `NpcBehaviorRepository` | `atc_npc_behaviors` |
| `NpcSpawnPointRepository` | `atc_npc_spawn_points` |
| `CrowdRuntimeRepository` | `atc_crowd_runtime` |
| `NpcCleanupRepository` | `atc_npc_cleanup` |

## API Endpoints

| Method | Path | Capability |
|---|---|---|
| `POST` | `/api/v1/npc/spawn` | `npc:write` |
| `POST` | `/api/v1/npc/despawn` | `npc:write` |
| `GET` | `/api/v1/npc/:npcId` | `npc:read` |
| `POST` | `/api/v1/npc/heartbeat` | `npc:write` |
| `POST` | `/api/v1/npc/:npcId/behavior` | `npc:write` |
| `POST` | `/api/v1/npc/crowd` | `npc:write` |
| `GET` | `/api/v1/npc/crowd/:zoneId` | `npc:read` |
| `POST` | `/api/v1/npc/cleanup` | `npc:admin` |

## DB Migrations

- `115_create_npc_runtime.sql` — `atc_npc_runtime`, UNIQUE on `spawn_nonce`
- `116_create_population_zones.sql` — `atc_population_zones`, UNIQUE on `zone_id`
- `117_create_npc_behaviors.sql` — `atc_npc_behaviors`
- `118_create_npc_spawn_points.sql` — `atc_npc_spawn_points`
- `119_create_crowd_runtime.sql` — `atc_crowd_runtime`, UNIQUE on `zone_id`
- `120_create_npc_cleanup.sql` — `atc_npc_cleanup`

## Events Emitted

| Event | Payload |
|---|---|
| `atc:npc:spawned` | `npcId`, `spawnNonce`, `npcType`, `zoneId` |
| `atc:npc:cleaned_up` | `npcId`, `reason` |
| `atc:npc:behavior_changed` | `npcId`, `behavior` |
| `atc:npc:crowd_density_changed` | `zoneId`, `density`, `targetDensity`, `activeNpcCount` |
| `atc:npc:population_updated` | `zoneId`, `currentPopulation`, `maxPopulation` |

## FiveM Bridge

`game/atc-core/server/npc.lua` exposes:

```lua
ATC.NPC.Spawn(zoneId, spawnNonce, npcType, metadata, cb)
ATC.NPC.Despawn(npcId, reason, cb)
ATC.NPC.Heartbeat(npcId, cb)
ATC.NPC.RecordBehavior(npcId, behavior, params, cb)
ATC.NPC.UpdateCrowd(zoneId, density, targetDensity, activeNpcCount, cb)
ATC.NPC.GetCrowd(zoneId, cb)
ATC.NPC.CleanupStale(cb)
ATC.NPC.TrackOwnership(npcId)  -- auto-heartbeat
ATC.NPC.ReleaseOwnership(npcId)
```

The bridge runs an automatic 10-second heartbeat loop for all tracked NPCs, and triggers stale cleanup on resource start.

## Concurrency & Idempotency

- Spawn is idempotent via `spawnNonce` — `UNIQUE KEY` on `atc_npc_runtime.spawn_nonce`
- `claimOwnership` uses `FOR UPDATE` row locking — same server re-claiming is idempotent, different server gets `NpcAlreadyOwnedError`
- `markForCleanup` and `deleteByIds` guard against empty arrays

## Runbook: Stale NPC Cleanup

Stale NPCs accumulate when servers crash without proper cleanup. Run reconciliation:

```bash
curl -X POST http://api:3000/api/v1/npc/cleanup \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"ownerServerId":"server-1","staleThresholdMs":30000}'
```

Response: `{ "cleaned": <count> }`

## Runbook: Spawn Flow

1. Generate a UUID as `spawnNonce` before spawning
2. Call `ATC.NPC.Spawn(zoneId, spawnNonce, 'civilian', {}, cb)`
3. On success, call `ATC.NPC.TrackOwnership(npc.id)` to enable auto-heartbeat
4. When the NPC leaves the area, call `ATC.NPC.Despawn(npc.id, 'out_of_range')`
5. Call `ATC.NPC.ReleaseOwnership(npc.id)` to stop heartbeats
