# Phase 53 — Advanced Combat, Ballistics & Tactical Simulation

## Overview

Phase 53 adds a server-authoritative simulation layer for combat engagement tracking, real-time ballistics, tactical damage processing, suppression mechanics, and armor integrity management. All values are calculated server-side; client events carry only identifiers.

---

## Package

**`@atc/combat-simulation-runtime`**

| Service | Responsibility |
|---|---|
| `CombatSimulationService` | Session lifecycle: start, end, list active, cleanup stale |
| `BallisticsRuntimeService` | Impact recording, resolution, pending-by-session queries |
| `TacticalDamageService` | Damage application and processing queue |
| `SuppressionRuntimeService` | Suppression upsert, clear, expired-record cleanup |
| `ArmorPenetrationService` | Armor upsert, integrity degradation, deactivation |
| `CombatRecoveryService` | Entity recovery, stale session + suppression cleanup |

---

## DB Tables

| Migration | Table |
|---|---|
| 199 | `atc_combat_runtime` |
| 200 | `atc_ballistics_runtime` |
| 201 | `atc_tactical_damage` |
| 202 | `atc_suppression_runtime` |
| 203 | `atc_armor_runtime` |
| 204 | `atc_combat_audit` |

---

## API Routes (`/api/v1/combat-simulation/*`)

| Method | Path | Service call |
|---|---|---|
| POST | `/sessions/start` | `CombatSimulationService.startCombat` |
| POST | `/sessions/:id/end` | `CombatSimulationService.endCombat` |
| GET  | `/sessions/:id` | `CombatSimulationService.getSession` |
| GET  | `/sessions/active` | `CombatSimulationService.listActiveSessions` |
| POST | `/ballistics/record` | `BallisticsRuntimeService.recordImpact` |
| POST | `/ballistics/:id/resolve` | `BallisticsRuntimeService.resolveImpact` |
| GET  | `/ballistics/pending/:sessionId` | `BallisticsRuntimeService.listPendingBySession` |
| POST | `/damage/apply` | `TacticalDamageService.applyDamage` |
| POST | `/suppression/apply` | `SuppressionRuntimeService.applySuppression` |
| GET  | `/suppression/:entityId` | `SuppressionRuntimeService.getSuppression` |
| DELETE | `/suppression/:entityId` | `SuppressionRuntimeService.clearSuppression` |
| POST | `/armor/upsert` | `ArmorPenetrationService.upsertArmor` |
| GET  | `/armor/:entityId` | `ArmorPenetrationService.getArmor` |
| DELETE | `/armor/:entityId` | `ArmorPenetrationService.deactivateArmor` |
| POST | `/cleanup` | `CombatSimulationService.cleanupStale` |

All endpoints require `Authorization: Bearer <token>`.

---

## FiveM Bridge

File: `game/atc-core/server/combat_runtime.lua`

| Event | Direction | Description |
|---|---|---|
| `atc:combat:simulation:start` | Server-only | Starts a combat session |
| `atc:combat:simulation:end` | Server-only | Ends a combat session |
| `atc:combat:ballistic:impact` | Client → Server (rate-limited) | Records ballistic impact |
| `atc:combat:suppression:apply` | Server-only | Applies suppression to entity |
| `atc:combat:suppression:clear` | Server-only | Clears suppression |
| `atc:combat:simulation:cleanup` | Scheduler | Purges stale sessions |

Rate limit: 60 requests/minute per source for `atc:combat:ballistic:impact`.

---

## Idempotency

- Combat sessions: `UNIQUE KEY uk_combat_session_id (session_id)` — duplicate starts return `DuplicateCombatSessionError`
- Suppression records: `ON DUPLICATE KEY UPDATE` upsert — idempotent by entity
- Armor records: `ON DUPLICATE KEY UPDATE` upsert — idempotent by entity

---

## EventBus Events (outbound)

| Event | Payload |
|---|---|
| `atc:combat:session:started` | `{ sessionId }` |
| `atc:combat:session:ended` | `{ sessionId }` |
| `atc:combat:ballistic:impact` | `{ id, sessionId }` |
| `atc:combat:damage:applied` | `{ id, entityId, amount }` |
| `atc:combat:suppression:applied` | `{ entityId, level }` |
| `atc:combat:suppression:cleared` | `{ entityId }` |
| `atc:combat:armor:damaged` | `{ entityId, integrity }` |
| `atc:combat:entity:recovered` | `{ entityId, recovered }` |

---

## Scheduler Guidance

Run `atc:combat:simulation:cleanup` every 5 minutes with `thresholdMs: 300000`.

---

## Alerts

- **Combat session stuck active > 1 hour**: query `atc_combat_runtime WHERE status = 'active' AND started_at < NOW() - INTERVAL 60 MINUTE`
- **Unresolved ballistic impacts > 500 in session**: indicates backpressure; check damage processing
- **Suppression not clearing**: run `DELETE FROM atc_suppression_runtime WHERE expires_at < NOW()`
