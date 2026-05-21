# Phase 63 — Deep Simulation Ecology, Resource Evolution & Environmental Persistence

## Overview
Persistent ecological simulation: biome health, environmental evolution cycles, resource regeneration, real-time climate data, and wildlife population dynamics.

## Package
`@atc/ecology-runtime`

## Services

| Service | Responsibility |
|---|---|
| `EcologyRuntimeService` | Create/degrade ecology zones, list active |
| `EnvironmentalEvolutionService` | Start/complete/fail evolution events |
| `ResourceRegenerationService` | Start/complete/fail regeneration cycles |
| `ClimatePersistenceService` | Upsert/read climate data per region |
| `WildlifeSimulationService` | Upsert/read wildlife populations per zone |
| `EcologyRecoveryService` | Bulk stale cleanup across ecology/evolution/regeneration |

## Database Tables

| Table | Purpose |
|---|---|
| `atc_ecology_runtime` | Biome/ecology zones with health status |
| `atc_environmental_evolution` | Evolution events (climate_shift, pollution, etc.) |
| `atc_resource_regeneration` | Resource regeneration cycles (flora, fauna, etc.) |
| `atc_climate_runtime` | Per-region climate state (ON DUPLICATE KEY on region_id) |
| `atc_wildlife_runtime` | Per-zone wildlife populations (ON DUPLICATE KEY on zone_id) |
| `atc_ecology_audit` | Append-only audit trail |

## API Routes

| Method | Path | Service |
|---|---|---|
| POST | `/api/v1/ecology/create` | EcologyRuntimeService.createEcology |
| POST | `/api/v1/ecology/:id/degrade` | EcologyRuntimeService.degradeEcology |
| GET | `/api/v1/ecology/:id` | EcologyRuntimeService.getEcology |
| GET | `/api/v1/ecology/active` | EcologyRuntimeService.listActiveEcologies |
| POST | `/api/v1/ecology/evolution/start` | EnvironmentalEvolutionService.startEvolution |
| POST | `/api/v1/ecology/evolution/:id/complete` | EnvironmentalEvolutionService.completeEvolution |
| POST | `/api/v1/ecology/evolution/:id/fail` | EnvironmentalEvolutionService.failEvolution |
| GET | `/api/v1/ecology/evolution/:id` | EnvironmentalEvolutionService.getEvolution |
| POST | `/api/v1/ecology/regeneration/start` | ResourceRegenerationService.startRegeneration |
| POST | `/api/v1/ecology/regeneration/:id/complete` | ResourceRegenerationService.completeRegeneration |
| POST | `/api/v1/ecology/regeneration/:id/fail` | ResourceRegenerationService.failRegeneration |
| GET | `/api/v1/ecology/regeneration/:id` | ResourceRegenerationService.getRegeneration |
| POST | `/api/v1/ecology/climate` | ClimatePersistenceService.upsertClimate |
| GET | `/api/v1/ecology/climate/:regionId` | ClimatePersistenceService.getClimate |
| POST | `/api/v1/ecology/wildlife` | WildlifeSimulationService.upsertWildlife |
| GET | `/api/v1/ecology/wildlife/:zoneId` | WildlifeSimulationService.getWildlife |
| POST | `/api/v1/ecology/cleanup` | EcologyRecoveryService.cleanupStale |

## FiveM Events (Server-only)

| Event | Description |
|---|---|
| `atc:ecology:create` | Create a new ecology zone |
| `atc:ecology:degrade` | Mark an ecology zone as degrading |
| `atc:ecology:evolution:start` | Start an environmental evolution event |
| `atc:ecology:evolution:complete` | Complete an evolution event |
| `atc:ecology:regeneration:start` | Start a resource regeneration cycle |
| `atc:ecology:regeneration:complete` | Complete a regeneration cycle |
| `atc:ecology:climate:upsert` | Update climate data for a region |
| `atc:ecology:wildlife:upsert` | Update wildlife population for a zone |
| `atc:ecology:cleanup` | Trigger stale cleanup (auto-scheduled every 5m) |

## Migrations
- `259_create_ecology_runtime.sql`
- `260_create_environmental_evolution.sql`
- `261_create_resource_regeneration.sql`
- `262_create_climate_runtime.sql`
- `263_create_wildlife_runtime.sql`
- `264_create_ecology_audit.sql`

## Idempotency
Ecology/evolution/regeneration use nonce-based UNIQUE constraints. Climate uses `ON DUPLICATE KEY UPDATE` on `region_id`. Wildlife uses `ON DUPLICATE KEY UPDATE` on `zone_id` — both are safe to call repeatedly with the same key.

## Cleanup Policy
`EcologyRecoveryService.cleanupStale(thresholdMs)` fans out in parallel across:
- Ecology zones with critical/degrading status older than threshold
- Completed/failed evolution events older than threshold
- Completed/failed regeneration cycles older than threshold

Auto-scheduled every 5 minutes via the FiveM bridge.
