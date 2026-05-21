# Phase 41 — Survival, Needs & Environmental Runtime

## Overview

Persistent survival simulation for all connected players. Tracks body temperature, hydration, fatigue, and environmental hazard exposure. State is server-authoritative; FiveM clients report current values and the API persists them.

## Package

`@atc/survival-runtime` — `/packages/survival-runtime`

## DB Tables

| Table | Purpose |
|---|---|
| `atc_survival_runtime` | Composite player survival state (temp, hydration, fatigue, status) |
| `atc_temperature_runtime` | Per-player temperature tracking with trend direction |
| `atc_hydration_runtime` | Per-player hydration level and depletion rate |
| `atc_fatigue_runtime` | Per-player fatigue level and rest debt |
| `atc_environmental_exposure` | Log of player exposure events to hazards |
| `atc_environmental_hazards` | Active environmental hazards in zones |

## Migrations

127–132 (`packages/db/migrations/127_create_survival_runtime.sql` through `132_create_environmental_hazards.sql`)

## API Endpoints

| Method | Path | Capability | Purpose |
|---|---|---|---|
| POST | `/api/v1/survival/tick` | `survival:write` | Submit survival state tick for a player |
| POST | `/api/v1/survival/penalty` | `survival:write` | Apply a penalty flag to a player |
| POST | `/api/v1/survival/reconcile` | `survival:write` | Clean up stale survival records |
| GET | `/api/v1/survival/players/:playerId` | `survival:read` | Get current survival state |
| POST | `/api/v1/survival/hydration/drink` | `survival:write` | Record player drinking |
| POST | `/api/v1/survival/fatigue/rest` | `survival:write` | Record player resting |
| POST | `/api/v1/survival/hazards` | `survival:write` | Create environmental hazard |
| POST | `/api/v1/survival/hazards/:hazardId/deactivate` | `survival:write` | Deactivate hazard |
| GET | `/api/v1/survival/hazards` | `survival:read` | List all active hazards |
| POST | `/api/v1/survival/exposure` | `survival:write` | Record player hazard exposure |

## EventBus Events Emitted

| Event | Payload | When |
|---|---|---|
| `atc:survival:tick_applied` | `{ playerId, bodyTemp, hydrationLevel, fatigueLevel, survivalStatus }` | After tick |
| `atc:survival:penalty_applied` | `{ playerId, penaltyFlag, reason }` | After penalty |
| `atc:survival:hydration_restored` | `{ playerId, amount }` | After drink |
| `atc:survival:environmental_hazard_triggered` | `{ hazardId, hazardType, zoneId, severity }` | After hazard creation |
| `atc:survival:hazard_deactivated` | `{ hazardId, zoneId }` | After deactivation |
| `atc:survival:exposure_recorded` | `{ playerId, hazardId, exposureType, severity }` | After exposure |

## FiveM SDK

`ATC.Survival.Tick(playerId, ownerServerId, params, cb)` — submit tick  
`ATC.Survival.GetState(playerId, cb)` — get state  
`ATC.Survival.ApplyPenalty(playerId, penaltyFlag, reason, cb)` — apply penalty  
`ATC.Survival.Reconcile(activePlayerIds, cb)` — reconcile  
`ATC.Survival.RecordDrink(playerId, amount, cb)` — record drink  
`ATC.Survival.RecordRest(playerId, recoveryAmount, cb)` — record rest  
`ATC.Survival.CreateHazard(hazardId, hazardType, zoneId, severity, ownerServerId, cb)` — create hazard  
`ATC.Survival.DeactivateHazard(hazardId, cb)` — deactivate hazard  
`ATC.Survival.GetActiveHazards(cb)` — list active hazards  
`ATC.Survival.RecordExposure(playerId, hazardId, exposureType, severity, cb)` — record exposure

Auto-tick thread runs every 30 seconds for all connected players.

## Concurrency Model

- `SurvivalRuntimeService.tick()` runs a single 4-table transaction (survival + temp + hydration + fatigue) for atomicity.
- `EnvironmentalHazardRepository.deactivate()` uses `SELECT FOR UPDATE` to prevent double-deactivation.
- `depleteHydration()` / `accumulateFatigue()` use `GREATEST`/`LEAST` SQL to avoid races.

## Ops Checklist

- [ ] Run migrations 127–132 before deploying
- [ ] Ensure `survival:write` and `survival:read` capabilities are granted to the game server principal
- [ ] Survival reconcile should be called periodically (e.g., every 5 minutes) with the current list of connected player IDs
- [ ] Monitor `atc_environmental_hazards` for orphaned active hazards

## Error Reference

| Error | HTTP | Meaning |
|---|---|---|
| `SurvivalStateNotFoundError` | 404 | No survival record for player |
| `TemperatureStateNotFoundError` | 404 | No temperature record for player |
| `HydrationStateNotFoundError` | 404 | No hydration record for player |
| `FatigueStateNotFoundError` | 404 | No fatigue record for player |
| `EnvironmentalHazardNotFoundError` | 404 | Hazard ID not found |
| `HazardAlreadyActiveError` | 409 | Hazard nonce already active |
| `ExposureConflictError` | 409 | Duplicate exposure record |
