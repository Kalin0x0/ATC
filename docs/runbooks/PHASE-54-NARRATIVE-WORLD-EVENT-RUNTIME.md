# Phase 54 — Persistent Narrative, Campaign & World Event Runtime

## Overview

Phase 54 provides a server-side runtime for persistent campaign management, dynamic world events, branching story progression, and narrative session tracking. The system maintains full audit trails for all narrative state transitions.

---

## Package

**`@atc/narrative-runtime`**

| Service | Responsibility |
|---|---|
| `NarrativeRuntimeService` | Narrative session lifecycle: start, end, list active, cleanup |
| `CampaignOrchestrationService` | Campaign start, complete, fail, list active, cleanup |
| `WorldEventService` | World event triggering, completion, active listing, cleanup |
| `StoryProgressionService` | Stage progression, entity-campaign queries |
| `DynamicNarrativeService` | Story state upsert, entity state listing, deactivation |
| `NarrativeRecoveryService` | Entity recovery, aggregate stale cleanup |

---

## DB Tables

| Migration | Table |
|---|---|
| 205 | `atc_campaign_runtime` |
| 206 | `atc_world_events` |
| 207 | `atc_story_progression` |
| 208 | `atc_narrative_runtime` |
| 209 | `atc_dynamic_story_state` |
| 210 | `atc_narrative_audit` |

---

## API Routes (`/api/v1/narrative/*`)

| Method | Path | Service call |
|---|---|---|
| POST | `/campaigns/start` | `CampaignOrchestrationService.startCampaign` |
| GET  | `/campaigns/:id` | `CampaignOrchestrationService.getCampaign` |
| GET  | `/campaigns/active` | `CampaignOrchestrationService.listActiveCampaigns` |
| POST | `/campaigns/:id/complete` | `CampaignOrchestrationService.completeCampaign` |
| POST | `/campaigns/:id/fail` | `CampaignOrchestrationService.failCampaign` |
| POST | `/world-events/trigger` | `WorldEventService.triggerEvent` |
| GET  | `/world-events/active` | `WorldEventService.listActiveEvents` |
| POST | `/world-events/:id/complete` | `WorldEventService.completeEvent` |
| POST | `/progression/advance` | `StoryProgressionService.advanceProgression` |
| GET  | `/progression/:entityId/:campaignId` | `StoryProgressionService.getProgressions` |
| POST | `/sessions/start` | `NarrativeRuntimeService.startSession` |
| GET  | `/sessions/active` | `NarrativeRuntimeService.listActiveSessions` |
| POST | `/sessions/:id/complete` | `NarrativeRuntimeService.endSession('completed')` |
| POST | `/sessions/:id/skip` | `NarrativeRuntimeService.endSession('skipped')` |
| POST | `/story-state/set` | `DynamicNarrativeService.setStoryState` |
| GET  | `/story-state/:entityId` | `DynamicNarrativeService.listEntityStates` |
| POST | `/cleanup` | `NarrativeRecoveryService.cleanupStale` |

---

## FiveM Bridge

File: `game/atc-core/server/narrative.lua`

| Event | Direction | Description |
|---|---|---|
| `atc:narrative:campaign:start` | Server-only | Starts a campaign |
| `atc:narrative:campaign:complete` | Server-only | Completes a campaign |
| `atc:narrative:campaign:fail` | Server-only | Fails a campaign |
| `atc:narrative:world_event:trigger` | Server-only | Triggers a world event |
| `atc:narrative:world_event:complete` | Server-only | Completes a world event |
| `atc:narrative:session:start` | Server-only | Starts a narrative session |
| `atc:narrative:session:complete` | Server-only | Completes a narrative session |
| `atc:narrative:session:skip` | Server-only | Skips a narrative session |
| `atc:narrative:story_state:set` | Server-only | Sets a story state flag/choice |
| `atc:narrative:cleanup` | Scheduler | Purges stale records |

---

## Idempotency

- Campaigns: `UNIQUE KEY uk_campaign_id (campaign_id)` + nonce field — duplicate starts return `DuplicateCampaignError`
- Dynamic story states: `ON DUPLICATE KEY UPDATE` upsert — idempotent by entity+branch

---

## EventBus Events (outbound)

| Event | Payload |
|---|---|
| `atc:narrative:session:started` | `{ sessionId }` |
| `atc:narrative:session:ended` | `{ sessionId }` |
| `atc:narrative:campaign:started` | `{ campaignId }` |
| `atc:narrative:campaign:completed` | `{ campaignId }` |
| `atc:narrative:campaign:failed` | `{ campaignId }` |
| `atc:narrative:world_event:triggered` | `{ eventId }` |
| `atc:narrative:world_event:completed` | `{ eventId }` |
| `atc:narrative:progression:started` | `{ id, entityId }` |
| `atc:narrative:progression:advanced` | `{ id, stageKey }` |
| `atc:narrative:entity:recovered` | `{ entityId, recovered }` |

---

## Scheduler Guidance

Run `atc:narrative:cleanup` every 5 minutes with `thresholdMs: 300000`.
World events with `expiresAt` past due are cleaned up by `WorldEventService.cleanupExpired()`.

---

## Alerts

- **Campaign stuck active > 24 hours**: `SELECT * FROM atc_campaign_runtime WHERE status = 'active' AND started_at < NOW() - INTERVAL 24 HOUR`
- **World event count > 100 active**: possible event spam; audit trigger conditions
- **Narrative sessions for disconnected players**: run `atc:narrative:cleanup` or call `NarrativeRecoveryService.recoverEntity(entityId)`
