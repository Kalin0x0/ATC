# Phase 42 — Crafting, Manufacturing & Production Runtime

## Overview

Server-authoritative crafting system. Players acquire blueprints, station owners register manufacturing queues, and production jobs run server-side with idempotency nonces. Job state transitions are locked with `SELECT FOR UPDATE` to prevent double-submission.

## Package

`@atc/crafting-runtime` — `/packages/crafting-runtime`

## DB Tables

| Table | Purpose |
|---|---|
| `atc_crafting_recipes` | Recipe definitions (output item, quantity, type, station, time) |
| `atc_crafting_blueprints` | Per-principal unlocked recipes |
| `atc_manufacturing_queues` | Station queue state (idle/running/paused/offline) |
| `atc_production_jobs` | Individual production job records with idempotency nonce |
| `atc_crafting_resource_consumption` | Resource usage tracking per production run |
| `atc_crafting_audit` | Append-only audit log for all job lifecycle events |

## Migrations

133–138 (`packages/db/migrations/133_create_crafting_recipes.sql` through `138_create_crafting_audit.sql`)

## API Endpoints

| Method | Path | Capability | Purpose |
|---|---|---|---|
| POST | `/api/v1/crafting/recipes` | `crafting:write` | Register or update a recipe |
| GET | `/api/v1/crafting/recipes` | `crafting:read` | List all active recipes |
| POST | `/api/v1/crafting/blueprints` | `crafting:write` | Grant blueprint to principal |
| GET | `/api/v1/crafting/blueprints/:principalId` | `crafting:read` | List blueprints for principal |
| POST | `/api/v1/crafting/stations` | `crafting:write` | Register manufacturing station |
| POST | `/api/v1/crafting/jobs` | `crafting:write` | Start a production job |
| GET | `/api/v1/crafting/jobs/:jobId` | `crafting:read` | Get production job |
| POST | `/api/v1/crafting/jobs/:jobId/complete` | `crafting:write` | Mark job completed |
| POST | `/api/v1/crafting/jobs/:jobId/fail` | `crafting:write` | Mark job failed |
| POST | `/api/v1/crafting/jobs/:jobId/cancel` | `crafting:write` | Cancel job |
| GET | `/api/v1/crafting/stations/:stationId/jobs` | `crafting:read` | List recent jobs for station |

## EventBus Events Emitted

| Event | Payload | When |
|---|---|---|
| `atc:crafting:recipe:registered` | `{ recipeId }` | After recipe upsert |
| `atc:crafting:blueprint:acquired` | `{ principalId, recipeId }` | After blueprint grant |
| `atc:crafting:queue:status_changed` | `{ stationId, status }` | After queue status change |
| `atc:crafting:job:started` | `{ jobId, recipeId, queueId }` | After job starts |
| `atc:crafting:job:completed` | `{ jobId, quantityProduced }` | After job completes |
| `atc:crafting:job:failed` | `{ jobId, reason }` | After job fails |
| `atc:crafting:job:cancelled` | `{ jobId, cancelledBy }` | After job cancels |

## FiveM SDK

`ATC.Crafting.RegisterRecipe(params, cb)` — register/update recipe  
`ATC.Crafting.ListRecipes(cb)` — list active recipes  
`ATC.Crafting.AcquireBlueprint(principalId, recipeId, source, cb)` — grant blueprint  
`ATC.Crafting.ListBlueprints(principalId, cb)` — list blueprints  
`ATC.Crafting.RegisterStation(stationId, stationType, cb)` — register station  
`ATC.Crafting.StartJob(params, cb)` — start production job  
`ATC.Crafting.GetJob(jobId, cb)` — get job status  
`ATC.Crafting.CompleteJob(jobId, quantityProduced, cb)` — complete job  
`ATC.Crafting.FailJob(jobId, reason, cb)` — fail job  
`ATC.Crafting.CancelJob(jobId, cancelledBy, cb)` — cancel job  
`ATC.Crafting.ListStationJobs(stationId, cb)` — list station jobs

## Concurrency Model

- Job nonce (`job_nonce` UNIQUE) prevents duplicate job submission — `ER_DUP_ENTRY` → `DuplicateJobNonceError`.
- `ProductionJobRepository.transition()` uses `SELECT FOR UPDATE` to prevent concurrent status transitions.
- `ManufacturingQueueRepository.updateStatus()` uses `SELECT FOR UPDATE` to prevent race conditions on queue state.

## Ops Checklist

- [ ] Run migrations 133–138 before deploying
- [ ] Ensure `crafting:write` and `crafting:read` capabilities are granted to the game server principal
- [ ] Register stations via the API on server startup
- [ ] Monitor for stale `in_progress` jobs (jobs that never received complete/fail signals)
- [ ] Audit log (`atc_crafting_audit`) retains all lifecycle events — no purge without legal review

## Error Reference

| Error | HTTP | Meaning |
|---|---|---|
| `RecipeNotFoundError` | 404 | Recipe ID does not exist |
| `RecipeAlreadyExistsError` | 409 | Recipe upsert conflict (rare) |
| `BlueprintNotFoundError` | 404 | Blueprint ID does not exist |
| `BlueprintAlreadyOwnedError` | 409 | Principal already owns this blueprint |
| `ManufacturingQueueNotFoundError` | 404 | Station/queue not registered |
| `ManufacturingQueueOfflineError` | 422 | Station is offline |
| `ProductionJobNotFoundError` | 404 | Job ID does not exist |
| `ProductionJobAlreadyActiveError` | 409 | Station already has an active job |
| `DuplicateJobNonceError` | 409 | Job nonce already used |
| `ProductionJobNotActiveError` | 422 | Job is not in a cancellable state |
