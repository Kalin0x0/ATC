# Phase 48 — Reputation, Diplomacy & Social Influence Runtime

## Overview

Server-authoritative reputation system tracking per-faction reputation scores, inter-faction diplomatic relations, global social standing, scheduled reputation decay, and influence change history. Score adjustments use `SELECT FOR UPDATE` to prevent race conditions on concurrent updates. Diplomacy uses a UNIQUE constraint on `(faction_a_id, faction_b_id)` with bidirectional lookup.

## Package

`@atc/reputation-runtime` — `/packages/reputation-runtime`

## DB Tables

| Table | Purpose |
|---|---|
| `atc_reputation_runtime` | Per-principal per-faction reputation scores with tier |
| `atc_diplomatic_relations` | Bilateral faction relationships with status and relation score |
| `atc_social_standing` | Global social standing score and tier per principal |
| `atc_influence_history` | Append-only influence change log |
| `atc_reputation_decay` | Scheduled decay configuration per principal/faction |
| `atc_relationship_audit` | Append-only relationship audit log |

## Migrations

169–174 (`packages/db/migrations/169_create_reputation_runtime.sql` through `174_create_relationship_audit.sql`)

## API Endpoints

| Method | Path | Capability | Purpose |
|---|---|---|---|
| POST | `/api/v1/reputation/adjust` | `reputation:write` | Adjust reputation by delta |
| POST | `/api/v1/reputation/upsert` | `reputation:write` | Set reputation score directly |
| GET | `/api/v1/reputation/:principalId/:factionId` | `reputation:read` | Get reputation record |
| POST | `/api/v1/reputation/diplomacy` | `reputation:write` | Set diplomatic relation |
| GET | `/api/v1/reputation/diplomacy/:factionAId/:factionBId` | `reputation:read` | Get diplomatic relation |
| POST | `/api/v1/reputation/standing/adjust` | `reputation:write` | Adjust social standing by delta |
| POST | `/api/v1/reputation/standing/upsert` | `reputation:write` | Set social standing score directly |
| GET | `/api/v1/reputation/standing/:principalId` | `reputation:read` | Get social standing |
| POST | `/api/v1/reputation/decay/schedule` | `reputation:write` | Schedule reputation decay |
| POST | `/api/v1/reputation/decay/apply` | `reputation:write` | Apply all due decay (batch operation) |
| POST | `/api/v1/reputation/influence` | `reputation:write` | Record influence change |
| GET | `/api/v1/reputation/influence/:principalId` | `reputation:read` | Get influence history |

## EventBus Events Emitted

| Event | Payload | When |
|---|---|---|
| `atc:reputation:reputation:adjusted` | `{ principalId, factionId, delta, newScore }` | After score adjustment |
| `atc:reputation:reputation:updated` | `{ principalId, factionId, reputationScore }` | After direct score set |
| `atc:reputation:diplomacy:set` | `{ factionAId, factionBId, status }` | After diplomatic relation set |
| `atc:reputation:standing:adjusted` | `{ principalId, delta, newScore }` | After standing adjustment |
| `atc:reputation:standing:updated` | `{ principalId, standingScore }` | After direct standing set |

## FiveM SDK

`ATC.Reputation.Adjust(principalId, factionId, delta, reason, actorId, cb)` — adjust reputation  
`ATC.Reputation.Upsert(principalId, factionId, reputationScore, tier, cb)` — set reputation  
`ATC.Reputation.Get(principalId, factionId, cb)` — get reputation  
`ATC.Reputation.SetDiplomacy(factionAId, factionBId, status, relationScore, cb)` — set relation  
`ATC.Reputation.GetDiplomacy(factionAId, factionBId, cb)` — get relation  
`ATC.Reputation.AdjustStanding(principalId, delta, reason, cb)` — adjust standing  
`ATC.Reputation.UpsertStanding(principalId, standingScore, tier, cb)` — set standing  
`ATC.Reputation.GetStanding(principalId, cb)` — get standing  
`ATC.Reputation.ScheduleDecay(params, cb)` — schedule decay  
`ATC.Reputation.ApplyDecay(cb)` — apply due decay  
`ATC.Reputation.RecordInfluence(params, cb)` — record influence change  
`ATC.Reputation.GetInfluenceHistory(principalId, cb)` — get influence history  

## Error Codes

| HTTP | Error Class | Cause |
|---|---|---|
| 409 | `DuplicateDiplomaticRelationError` | Diplomatic relation already exists (use PUT-semantics endpoint) |
| 422 | `InvalidReputationScoreError` | Score would exceed allowed range |
| 404 | `ReputationRecordNotFoundError` | Unknown principal+faction combination |
| 404 | `DiplomaticRelationNotFoundError` | Unknown faction pair |
| 404 | `SocialStandingNotFoundError` | No standing record for principal |
| 404 | `ReputationDecayNotFoundError` | No decay record found |

## Reputation Tiers

Reputation tiers are computed by `calculateTier()` helper based on score thresholds:

| Tier | Score Range |
|---|---|
| `hostile` | ≤ -500 |
| `unfriendly` | -499 to -1 |
| `neutral` | 0 to 99 |
| `friendly` | 100 to 499 |
| `allied` | 500 to 899 |
| `revered` | ≥ 900 |

## Social Standing Tiers

| Tier | Description |
|---|---|
| `criminal` | Actively flagged as criminal element |
| `disreputable` | Poor public standing |
| `common` | Default standing |
| `respected` | Positive community standing |
| `prominent` | Notable community figure |
| `elite` | Highest social standing |

## Decay Scheduling

`POST /api/v1/reputation/decay/schedule` registers a decay rate and next decay timestamp. `POST /api/v1/reputation/decay/apply` processes all records where `next_decay_at <= NOW()` and applies the decay rate, then reschedules the next decay. Call `apply` from a scheduled task (e.g., every hour via a task worker).

## Diplomatic Relation Bidirectionality

The system stores relations with `faction_a_id < faction_b_id` ordering (or whichever comes first). The `DiplomaticRelationsRepository.find()` method searches both orderings so callers do not need to know the canonical order.
