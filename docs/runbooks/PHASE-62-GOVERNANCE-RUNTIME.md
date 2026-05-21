# Phase 62 — Autonomous Civilization, Governance & Political Runtime

## Overview
Persistent governance structures, political elections, legislation, civic influence, and autonomous policy management for ATC's civilization simulation layer.

## Package
`@atc/governance-runtime`

## Services

| Service | Responsibility |
|---|---|
| `GovernanceRuntimeService` | Create/suspend governance entities, list active |
| `PoliticalElectionService` | Start/close/cancel elections, list active |
| `LegislativeRuntimeService` | Enact/repeal legislation, list active |
| `CivicInfluenceService` | Upsert entity civic influence scores, cleanup inactive |
| `AutonomousPolicyService` | Apply/revoke policies, list active |
| `GovernanceRecoveryService` | Bulk stale cleanup across all governance tables |

## Database Tables

| Table | Purpose |
|---|---|
| `atc_governance_runtime` | Active governance entities (democracy/oligarchy/etc.) |
| `atc_political_elections` | Election lifecycle with candidate + result data |
| `atc_legislative_runtime` | Enacted laws, regulations, decrees with expiry |
| `atc_civic_influence` | Per-entity influence scores (ON DUPLICATE KEY UPDATE) |
| `atc_policy_runtime` | Applied policies with expiry |
| `atc_governance_audit` | Append-only audit trail |

## API Routes

| Method | Path | Service |
|---|---|---|
| POST | `/api/v1/governance/create` | GovernanceRuntimeService.createGovernance |
| POST | `/api/v1/governance/:id/suspend` | GovernanceRuntimeService.suspendGovernance |
| GET | `/api/v1/governance/:id` | GovernanceRuntimeService.getGovernance |
| GET | `/api/v1/governance/active` | GovernanceRuntimeService.listActiveGovernances |
| POST | `/api/v1/governance/elections/start` | PoliticalElectionService.startElection |
| POST | `/api/v1/governance/elections/:id/close` | PoliticalElectionService.closeElection |
| POST | `/api/v1/governance/elections/:id/cancel` | PoliticalElectionService.cancelElection |
| GET | `/api/v1/governance/elections/:id` | PoliticalElectionService.getElection |
| POST | `/api/v1/governance/legislation/enact` | LegislativeRuntimeService.enactLegislation |
| POST | `/api/v1/governance/legislation/:id/repeal` | LegislativeRuntimeService.repealLegislation |
| GET | `/api/v1/governance/legislation/:id` | LegislativeRuntimeService.getLegislation |
| POST | `/api/v1/governance/influence` | CivicInfluenceService.upsertInfluence |
| GET | `/api/v1/governance/influence/:entityId` | CivicInfluenceService.getInfluence |
| POST | `/api/v1/governance/policies/apply` | AutonomousPolicyService.applyPolicy |
| POST | `/api/v1/governance/policies/:id/revoke` | AutonomousPolicyService.revokePolicy |
| GET | `/api/v1/governance/policies/:id` | AutonomousPolicyService.getPolicy |
| POST | `/api/v1/governance/cleanup` | GovernanceRecoveryService.cleanupStale |

## FiveM Events (Server-only)

| Event | Description |
|---|---|
| `atc:governance:create` | Create a new governance entity |
| `atc:governance:suspend` | Suspend an existing governance entity |
| `atc:governance:election:start` | Start an election in a region |
| `atc:governance:election:close` | Close an election with optional result data |
| `atc:governance:legislation:enact` | Enact a new law/regulation |
| `atc:governance:legislation:repeal` | Repeal an existing law |
| `atc:governance:influence:upsert` | Upsert civic influence for an entity |
| `atc:governance:policy:apply` | Apply an autonomous policy |
| `atc:governance:policy:revoke` | Revoke an active policy |
| `atc:governance:cleanup` | Trigger stale cleanup (auto-scheduled every 5m) |

## Migrations
- `253_create_governance_runtime.sql`
- `254_create_political_elections.sql`
- `255_create_legislative_runtime.sql`
- `256_create_civic_influence.sql`
- `257_create_policy_runtime.sql`
- `258_create_governance_audit.sql`

## Idempotency
All create operations use nonce-based UNIQUE constraints on `(governance_nonce, owner_server_id)`, `(election_nonce, owner_server_id)`, etc. Duplicate nonce submissions return `DuplicateGovernanceError` / `DuplicateElectionError` / etc.

Civic influence uses `ON DUPLICATE KEY UPDATE` on `entity_id` — safe to call repeatedly.

## Cleanup Policy
`GovernanceRecoveryService.cleanupStale(thresholdMs)` deletes:
- Suspended/dissolved/transitioning governances older than threshold
- Closed/cancelled elections older than threshold
- Repealed/expired legislation older than threshold
- Revoked/expired policies older than threshold

Auto-scheduled every 5 minutes via the FiveM bridge.
