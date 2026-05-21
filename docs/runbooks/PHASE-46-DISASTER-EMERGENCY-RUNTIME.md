# Phase 46 — Disaster, Crisis & Emergency Management Runtime

## Overview

Server-authoritative disaster management system tracking disaster events, hazard zones, evacuations, emergency response units, and recovery orchestration. Disaster lifecycle transitions use `SELECT FOR UPDATE`; `disaster_nonce` and `evacuation_nonce` UNIQUE constraints enforce idempotency at the DB layer.

## Package

`@atc/disaster-runtime` — `/packages/disaster-runtime`

## DB Tables

| Table | Purpose |
|---|---|
| `atc_disaster_events` | Disaster event records with lifecycle status and affected zones |
| `atc_hazard_zones` | Active hazard zones with type, severity, and propagation radius |
| `atc_evacuation_runtime` | Evacuation operations with progress tracking |
| `atc_emergency_response` | Dispatched emergency response units with lifecycle |
| `atc_recovery_runtime` | Per-disaster recovery phase and progress (one row per disaster) |
| `atc_disaster_audit` | Append-only disaster audit log |

## Migrations

157–162 (`packages/db/migrations/157_create_disaster_events.sql` through `162_create_disaster_audit.sql`)

## API Endpoints

| Method | Path | Capability | Purpose |
|---|---|---|---|
| POST | `/api/v1/disaster/events` | `disaster:write` | Declare a new disaster |
| GET | `/api/v1/disaster/events` | `disaster:read` | List active disasters |
| POST | `/api/v1/disaster/events/:disasterId/escalate` | `disaster:write` | Escalate disaster |
| POST | `/api/v1/disaster/events/:disasterId/contain` | `disaster:write` | Mark disaster as contained |
| POST | `/api/v1/disaster/events/:disasterId/resolve` | `disaster:write` | Mark disaster as resolved |
| POST | `/api/v1/disaster/hazards` | `disaster:write` | Propagate a hazard zone |
| GET | `/api/v1/disaster/hazards` | `disaster:read` | List active hazard zones |
| POST | `/api/v1/disaster/hazards/:zoneId/clear` | `disaster:write` | Clear a hazard zone |
| POST | `/api/v1/disaster/evacuations` | `disaster:write` | Initiate evacuation |
| POST | `/api/v1/disaster/evacuations/:evacuationId/progress` | `disaster:write` | Update evacuation progress |
| POST | `/api/v1/disaster/evacuations/:evacuationId/complete` | `disaster:write` | Complete evacuation |
| POST | `/api/v1/disaster/evacuations/:evacuationId/cancel` | `disaster:write` | Cancel evacuation |
| POST | `/api/v1/disaster/responses` | `disaster:write` | Dispatch emergency response |
| POST | `/api/v1/disaster/responses/:responseId/arrive` | `disaster:write` | Mark response on-scene |
| POST | `/api/v1/disaster/responses/:responseId/complete` | `disaster:write` | Complete response |
| POST | `/api/v1/disaster/responses/:responseId/withdraw` | `disaster:write` | Withdraw response |
| POST | `/api/v1/disaster/recovery` | `disaster:write` | Start/update recovery |
| POST | `/api/v1/disaster/recovery/:disasterId/progress` | `disaster:write` | Update recovery progress |

## EventBus Events Emitted

| Event | Payload | When |
|---|---|---|
| `atc:disaster:event:declared` | `{ disasterId, disasterType, severity }` | After disaster declaration |
| `atc:disaster:event:escalated` | `{ disasterId }` | After escalation |
| `atc:disaster:event:contained` | `{ disasterId }` | After containment |
| `atc:disaster:event:resolved` | `{ disasterId }` | After resolution |
| `atc:disaster:hazard:propagated` | `{ zoneId, hazardType, severity }` | After hazard propagation |
| `atc:disaster:hazard:cleared` | `{ zoneId }` | After zone clearance |
| `atc:disaster:evacuation:initiated` | `{ evacuationId, zoneId }` | After evacuation start |
| `atc:disaster:evacuation:progress` | `{ evacuationId, evacuatedCount }` | After progress update |
| `atc:disaster:evacuation:completed` | `{ evacuationId }` | After completion |
| `atc:disaster:evacuation:cancelled` | `{ evacuationId }` | After cancellation |
| `atc:disaster:response:dispatched` | `{ responseId, responseType }` | After dispatch |
| `atc:disaster:response:on_scene` | `{ responseId }` | After on-scene arrival |
| `atc:disaster:response:completed` | `{ responseId }` | After completion |
| `atc:disaster:response:withdrawn` | `{ responseId }` | After withdrawal |
| `atc:disaster:recovery:started` | `{ disasterId, recoveryPhase }` | After recovery start |
| `atc:disaster:recovery:progress` | `{ disasterId, progressPercent }` | After progress update |

## FiveM SDK

`ATC.Disaster.DeclareDisaster(params, cb)` — declare disaster  
`ATC.Disaster.ListActiveDisasters(cb)` — list active disasters  
`ATC.Disaster.EscalateDisaster(disasterId, cb)` — escalate  
`ATC.Disaster.ContainDisaster(disasterId, cb)` — contain  
`ATC.Disaster.ResolveDisaster(disasterId, cb)` — resolve  
`ATC.Disaster.PropagateHazard(params, cb)` — propagate hazard zone  
`ATC.Disaster.ListActiveHazards(cb)` — list active hazards  
`ATC.Disaster.ClearHazardZone(zoneId, cb)` — clear zone  
`ATC.Disaster.InitiateEvacuation(params, cb)` — initiate evacuation  
`ATC.Disaster.UpdateEvacuationProgress(evacuationId, evacuatedCount, cb)` — update progress  
`ATC.Disaster.CompleteEvacuation(evacuationId, cb)` — complete  
`ATC.Disaster.CancelEvacuation(evacuationId, cb)` — cancel  
`ATC.Disaster.DispatchResponse(params, cb)` — dispatch response  
`ATC.Disaster.ArriveOnScene(responseId, cb)` — mark on-scene  
`ATC.Disaster.CompleteResponse(responseId, cb)` — complete response  
`ATC.Disaster.WithdrawResponse(responseId, cb)` — withdraw response  
`ATC.Disaster.StartRecovery(params, cb)` — start recovery  
`ATC.Disaster.UpdateRecoveryProgress(disasterId, progressPercent, cb)` — update recovery progress

## Concurrency Model

- `DisasterEventRepository.transition()` uses `SELECT FOR UPDATE` — prevents concurrent lifecycle races.
- `HazardZoneRepository.updateStatus()` uses `SELECT FOR UPDATE` for zone clearing.
- `EvacuationRuntimeRepository.updateProgress()` and `transition()` use `SELECT FOR UPDATE`.
- `EmergencyResponseRepository.transition()` uses `SELECT FOR UPDATE`.
- `RecoveryRuntimeRepository.updateProgress()` uses `SELECT FOR UPDATE`.
- `disaster_nonce` UNIQUE constraint: `ER_DUP_ENTRY` → `DuplicateDisasterNonceError`.
- `evacuation_nonce` UNIQUE constraint: `ER_DUP_ENTRY` → `DuplicateEvacuationNonceError`.

## Ops Checklist

- [ ] Run migrations 157–162 before deploying
- [ ] Ensure `disaster:write` and `disaster:read` capabilities are granted to the game server principal
- [ ] Monitor `atc_disaster_events` for stale `active`/`escalated` events with no recent update
- [ ] Monitor `atc_hazard_zones` for orphaned active zones after disaster resolution
- [ ] `atc_disaster_audit` is append-only — no DELETE without audit retention policy review
- [ ] `affected_zone_ids` in `atc_disaster_events` stored as JSON string — validate array before inserting large payloads

## Error Reference

| Error | HTTP | Meaning |
|---|---|---|
| `DisasterEventNotFoundError` | 404 | Disaster ID does not exist |
| `DuplicateDisasterNonceError` | 409 | Disaster nonce already used |
| `DisasterAlreadyContainedError` | 422 | Disaster already in contained/resolved state |
| `HazardZoneNotFoundError` | 404 | Hazard zone ID does not exist |
| `EvacuationNotFoundError` | 404 | Evacuation ID does not exist |
| `DuplicateEvacuationNonceError` | 409 | Evacuation nonce already used |
| `EmergencyResponseNotFoundError` | 404 | Response ID does not exist |
| `RecoveryRuntimeNotFoundError` | 404 | Recovery record for disaster does not exist |
