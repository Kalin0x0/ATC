# Phase 47 — Mission, Objective & Dynamic Scenario Runtime

## Overview

Server-authoritative mission system tracking missions, objectives, assignments, scenarios, and dynamic world events. Mission lifecycle transitions use `SELECT FOR UPDATE`; `mission_nonce` and `event_nonce` UNIQUE constraints enforce idempotency at the DB layer. Mission progression is fire-and-forget (returns 204).

## Package

`@atc/mission-runtime` — `/packages/mission-runtime`

## DB Tables

| Table | Purpose |
|---|---|
| `atc_missions` | Mission records with lifecycle status and nonce idempotency |
| `atc_mission_objectives` | Per-mission objectives with sequence ordering |
| `atc_mission_assignments` | Player/group/NPC assignments to missions |
| `atc_scenario_runtime` | Active scenario registrations linked to missions |
| `atc_dynamic_events` | Dynamic world events with expiry and trigger data |
| `atc_mission_audit` | Append-only mission audit log |

## Migrations

163–168 (`packages/db/migrations/163_create_missions.sql` through `168_create_mission_audit.sql`)

## API Endpoints

| Method | Path | Capability | Purpose |
|---|---|---|---|
| POST | `/api/v1/missions` | `mission:write` | Create a new mission (idempotent via nonce) |
| GET | `/api/v1/missions` | `mission:read` | List active missions |
| POST | `/api/v1/missions/:missionId/start` | `mission:write` | Transition mission to active |
| POST | `/api/v1/missions/:missionId/complete` | `mission:write` | Complete a mission |
| POST | `/api/v1/missions/:missionId/fail` | `mission:write` | Fail a mission |
| POST | `/api/v1/missions/objectives` | `mission:write` | Create a mission objective |
| POST | `/api/v1/missions/objectives/:objectiveId/complete` | `mission:write` | Complete an objective |
| POST | `/api/v1/missions/progress` | `mission:write` | Progress mission via objective (204) |
| POST | `/api/v1/missions/assignments` | `mission:write` | Assign player/group to mission |
| POST | `/api/v1/missions/assignments/release` | `mission:write` | Release a mission assignment |
| POST | `/api/v1/missions/scenarios` | `mission:write` | Register a scenario |
| POST | `/api/v1/missions/events` | `mission:write` | Create a dynamic event (idempotent via nonce) |
| GET | `/api/v1/missions/events` | `mission:read` | List active dynamic events |
| POST | `/api/v1/missions/events/:eventId/resolve` | `mission:write` | Resolve a dynamic event |

## EventBus Events Emitted

| Event | Payload | When |
|---|---|---|
| `atc:mission:mission:created` | `{ missionId, missionType, missionNonce }` | After mission creation |
| `atc:mission:mission:started` | `{ missionId }` | After mission start |
| `atc:mission:mission:completed` | `{ missionId }` | After mission completion |
| `atc:mission:mission:failed` | `{ missionId }` | After mission failure |
| `atc:mission:objective:completed` | `{ objectiveId, missionId }` | After objective completion |
| `atc:mission:event:created` | `{ eventId, eventType, eventNonce }` | After dynamic event creation |
| `atc:mission:event:resolved` | `{ eventId }` | After dynamic event resolution |

## FiveM SDK

`ATC.Mission.Create(params, cb)` — create mission (idempotent)  
`ATC.Mission.ListActive(cb)` — list active missions  
`ATC.Mission.Start(missionId, cb)` — start mission  
`ATC.Mission.Complete(missionId, cb)` — complete mission  
`ATC.Mission.Fail(missionId, cb)` — fail mission  
`ATC.Mission.CreateObjective(params, cb)` — create objective  
`ATC.Mission.CompleteObjective(objectiveId, cb)` — complete objective  
`ATC.Mission.Progress(missionId, objectiveId, cb)` — progress mission  
`ATC.Mission.Assign(params, cb)` — assign player/group/npc  
`ATC.Mission.ReleaseAssignment(missionId, assigneeId, cb)` — release assignment  
`ATC.Mission.RegisterScenario(params, cb)` — register scenario  
`ATC.Mission.CreateEvent(params, cb)` — create dynamic event (idempotent)  
`ATC.Mission.ListActiveEvents(cb)` — list active events  
`ATC.Mission.ResolveEvent(eventId, cb)` — resolve event  

## Error Codes

| HTTP | Error Class | Cause |
|---|---|---|
| 409 | `DuplicateMissionNonceError` | `mission_nonce` already used |
| 409 | `DuplicateEventNonceError` | `event_nonce` already used |
| 409 | `AssignmentAlreadyExistsError` | Duplicate assignment for mission+assignee pair |
| 422 | `MissionAlreadyCompletedError` | Lifecycle transition on completed mission |
| 404 | `MissionNotFoundError` | Unknown `missionId` |
| 404 | `ObjectiveNotFoundError` | Unknown `objectiveId` |
| 404 | `AssignmentNotFoundError` | Release on non-existent assignment |
| 404 | `ScenarioNotFoundError` | Unknown `scenarioId` |
| 404 | `DynamicEventNotFoundError` | Unknown `eventId` |

## Idempotency

Both `POST /api/v1/missions` and `POST /api/v1/missions/events` are idempotent via their nonce fields. The caller sends a unique nonce per logical operation; a 409 response means the operation already completed and the caller can safely ignore or retry.

## Cleanup

`MissionCleanupService.cleanupStaleMissions(thresholdMs)` expires missions that have been in `pending` or `active` state without updates beyond the threshold. Call this from a scheduled task or ops endpoint.

## Objective Sequencing

Objectives have an optional `sequenceOrder` field. The mission progression service does not enforce ordering — it is the caller's responsibility to complete objectives in order and call `POST /api/v1/missions/progress` to advance state.
