# Phase 49 — Advanced AI Tactical & Autonomous Response Runtime

## Overview

Server-authoritative AI runtime managing entity state, autonomous patrols, threat assessments, reinforcement coordination, and tactical responses. All lifecycle transitions are deadlock-safe (FOR UPDATE); patrol and reinforcement nonces enforce idempotency. The recovery service handles stale entity cleanup across distributed server nodes.

## Package

`@atc/ai-runtime` — `/packages/ai-runtime`

## DB Tables

| Table | Purpose |
|---|---|
| `atc_ai_runtime` | AI entity registry with state, behavior mode, and position |
| `atc_ai_patrols` | Active patrol records with nonce idempotency |
| `atc_ai_threat_assessment` | Active threat assessments with expiry |
| `atc_ai_reinforcements` | Reinforcement requests with dispatch lifecycle |
| `atc_ai_response_runtime` | Active tactical responses per entity |
| `atc_ai_audit` | Append-only AI audit log |

## Migrations

175–180 (`packages/db/migrations/175_create_ai_runtime.sql` through `180_create_ai_audit.sql`)

## API Endpoints

| Method | Path | Capability | Purpose |
|---|---|---|---|
| POST | `/api/v1/ai/entities` | `ai:write` | Register or update AI entity |
| GET | `/api/v1/ai/entities` | `ai:read` | List active AI entities |
| POST | `/api/v1/ai/entities/state` | `ai:write` | Update entity AI state |
| POST | `/api/v1/ai/entities/recover` | `ai:write` | Recover a single entity |
| POST | `/api/v1/ai/cleanup` | `ai:write` | Full stale runtime cleanup |
| POST | `/api/v1/ai/patrols` | `ai:write` | Start autonomous patrol (idempotent via nonce) |
| GET | `/api/v1/ai/patrols` | `ai:read` | List active patrols |
| POST | `/api/v1/ai/patrols/:patrolId/complete` | `ai:write` | Complete a patrol |
| POST | `/api/v1/ai/threats` | `ai:write` | Submit threat assessment |
| GET | `/api/v1/ai/threats` | `ai:read` | List active threat assessments |
| POST | `/api/v1/ai/reinforcements` | `ai:write` | Request reinforcements (idempotent via nonce) |
| GET | `/api/v1/ai/reinforcements` | `ai:read` | List active reinforcements |
| POST | `/api/v1/ai/reinforcements/:reinforcementId/status` | `ai:write` | Update reinforcement status |
| POST | `/api/v1/ai/responses` | `ai:write` | Activate tactical response |
| GET | `/api/v1/ai/responses/:entityId` | `ai:read` | List active responses for entity |

## EventBus Events Emitted

| Event | Payload | When |
|---|---|---|
| `atc:ai:entity:registered` | `{ entityId, entityType }` | After entity register/update |
| `atc:ai:entity:state_changed` | `{ entityId, aiState }` | After state update |
| `atc:ai:entity:recovered` | `{ entityId }` | After entity recovery |
| `atc:ai:patrol:started` | `{ patrolId, entityId, patrolType }` | After patrol start |
| `atc:ai:patrol:completed` | `{ patrolId, entityId }` | After patrol completion |
| `atc:ai:threat:assessed` | `{ assessmentId, entityId, threatLevel }` | After threat assessment |
| `atc:ai:reinforcement:requested` | `{ reinforcementId, reinforcementType }` | After reinforcement request |
| `atc:ai:reinforcement:dispatched` | `{ reinforcementId }` | After dispatch |
| `atc:ai:reinforcement:arrived` | `{ reinforcementId }` | After arrival |
| `atc:ai:reinforcement:withdrawn` | `{ reinforcementId }` | After withdrawal |
| `atc:ai:reinforcement:cancelled` | `{ reinforcementId }` | After cancellation |
| `atc:ai:response:activated` | `{ responseId, entityId, responseType }` | After response activation |

## FiveM SDK

`ATC.AI.RegisterEntity(params, cb)` — register or update AI entity  
`ATC.AI.ListActiveEntities(cb)` — list active entities  
`ATC.AI.UpdateEntityState(entityId, aiState, cb)` — update entity state  
`ATC.AI.RecoverEntity(entityId, cb)` — recover stale entity  
`ATC.AI.Cleanup(thresholdMs, cb)` — full stale cleanup  
`ATC.AI.StartPatrol(params, cb)` — start patrol (idempotent)  
`ATC.AI.ListActivePatrols(cb)` — list active patrols  
`ATC.AI.CompletePatrol(patrolId, cb)` — complete patrol  
`ATC.AI.AssessThreat(params, cb)` — submit threat assessment  
`ATC.AI.ListActiveThreats(cb)` — list active threats  
`ATC.AI.RequestReinforcement(params, cb)` — request reinforcements (idempotent)  
`ATC.AI.ListActiveReinforcements(cb)` — list active reinforcements  
`ATC.AI.UpdateReinforcementStatus(reinforcementId, status, cb)` — dispatch/arrive/withdraw/cancel  
`ATC.AI.ActivateResponse(params, cb)` — activate tactical response  
`ATC.AI.ListResponsesByEntity(entityId, cb)` — list entity responses  

## Error Codes

| HTTP | Error Class | Cause |
|---|---|---|
| 409 | `DuplicatePatrolNonceError` | `patrol_nonce` already used |
| 409 | `DuplicateReinforcementNonceError` | `reinforcement_nonce` already used |
| 422 | `PatrolAlreadyActiveError` | Entity already has an active patrol |
| 422 | `AiResponseAlreadyActiveError` | Response is already in active state |
| 404 | `AiEntityNotFoundError` | Unknown `entityId` |
| 404 | `PatrolNotFoundError` | Unknown `patrolId` |
| 404 | `ThreatAssessmentNotFoundError` | Unknown `assessmentId` |
| 404 | `ReinforcementNotFoundError` | Unknown `reinforcementId` |
| 404 | `AiResponseNotFoundError` | Unknown `responseId` |

## AI States

| State | Description |
|---|---|
| `idle` | Entity is standing by, no active task |
| `patrolling` | Entity is executing an autonomous patrol |
| `alert` | Entity is in heightened awareness state |
| `engaged` | Entity is in active conflict |
| `fleeing` | Entity is retreating from threat |
| `dead` | Entity has been eliminated |
| `recovering` | Entity is in post-combat recovery |

## Reinforcement Status Flow

```
requested → dispatched → arrived → withdrawn
         ↓
       cancelled
```

Status transitions are validated server-side; invalid transitions return 422.

## Threat Assessment Expiry

Threat assessments support an optional `expiresAt` datetime. The `expireStale()` method on `AiThreatAssessmentRepository` can be called from a cleanup task to remove expired assessments from the active list.

## Stale Runtime Cleanup

`AiRecoveryService.fullCleanup(thresholdMs)` resets stale entities, marks orphaned patrols as completed, and deactivates expired responses. Returns `{ entities, patrols, responses }` counts of affected records. Invoke this periodically from a scheduled task or after server restart.

## Distributed Node Affinity

Entities and patrols carry an optional `ownerServerId` field. When running multiple FiveM server nodes, each node should set this field to its ID so the recovery service can identify and clean up records belonging to nodes that have gone offline.
