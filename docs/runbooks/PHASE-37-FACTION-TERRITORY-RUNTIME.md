# Phase 37 — Faction & Territory Control Runtime

**Runbook version:** 1.0.0
**Phase:** 37
**Package:** `@atc/faction-runtime`
**Agent scope:** Agent 1 only
**Status:** Production

---

## Table of Contents

1. [Overview](#1-overview)
2. [Package & File Inventory](#2-package--file-inventory)
3. [Database Migrations](#3-database-migrations)
4. [Service Reference](#4-service-reference)
5. [Error Hierarchy & HTTP Map](#5-error-hierarchy--http-map)
6. [State Machines](#6-state-machines)
7. [API Routes](#7-api-routes)
8. [EventBus Integration](#8-eventbus-integration)
9. [FiveM Bridge](#9-fivem-bridge)
10. [Concurrency Model](#10-concurrency-model)
11. [Key Invariants](#11-key-invariants)
12. [Security Checklist](#12-security-checklist)
13. [Diagnostics](#13-diagnostics)
14. [Operational Procedures](#14-operational-procedures)
15. [Agent Scope Boundary](#15-agent-scope-boundary)

---

## 1. Overview

Phase 37 introduces the **Faction & Territory Control Runtime**, a first-party ATC plugin that models all persistent structured-faction state: faction lifecycle, territory ownership, influence-driven territory transfer, conflict lifecycle, zone claiming, and resource node capture. It is distinct from `@atc/criminal-runtime` (gang street operations) — factions represent formal, larger-scale organizations (militias, cartels, corporations, political bodies) competing for geographic control.

All state is server-authoritative, audit-persisted, and protected by row-level locking. No client-supplied territory or influence values are accepted without server re-validation.

### Scope

| In scope (Agent 1) | Out of scope (Agent 2) |
|---|---|
| Faction CRUD & lifecycle | Territory heat maps / analytics |
| Territory claim & release | Faction analytics dashboards |
| Influence accumulation & transfer triggers | Political simulation engines |
| Conflict state machine | Predictive territory spread models |
| Zone claim lifecycle | MDT faction intel views |
| Resource node capture | Gang / criminal correlation |

---

## 2. Package & File Inventory

```
packages/faction-runtime/          # @atc/faction-runtime
├── src/
│   ├── services/
│   │   ├── FactionRuntimeService.ts
│   │   ├── TerritoryControlService.ts
│   │   ├── InfluenceRuntimeService.ts
│   │   ├── ConflictRuntimeService.ts
│   │   ├── ZoneClaimService.ts
│   │   └── ResourceNodeService.ts
│   ├── repositories/
│   │   ├── FactionRepository.ts
│   │   ├── TerritoryRepository.ts
│   │   ├── TerritoryClaimRepository.ts
│   │   ├── FactionConflictRepository.ts
│   │   ├── ResourceNodeRepository.ts
│   │   └── InfluenceRuntimeRepository.ts
│   └── errors/
│       └── index.ts
├── package.json
└── tsconfig.json

apps/api/src/routes/factions.ts     # REST endpoints — /api/v1/factions/*

packages/db/migrations/
├── 103_create_atc_factions.sql
├── 104_create_atc_territories.sql
├── 105_create_atc_territory_claims.sql
├── 106_create_atc_faction_conflicts.sql
├── 107_create_atc_resource_nodes.sql
└── 108_create_atc_influence_runtime.sql

game/atc-core/server/factions.lua   # FiveM SDK bridge — ATC.Factions namespace

packages/tests/src/faction-runtime.test.ts
```

---

## 3. Database Migrations

All migrations must be applied in order (103 → 108). They are idempotent with `IF NOT EXISTS` guards.

### 103 — `atc_factions`

| Column | Type | Notes |
|---|---|---|
| `id` | `CHAR(26)` | UUID v7, PK |
| `name` | `VARCHAR(128)` | Display name; `UNIQUE KEY uq_name(name)` |
| `tag` | `VARCHAR(8)` | Short identifier; `UNIQUE KEY uq_tag(tag)` |
| `leader_principal_id` | `CHAR(26)` | FK → principals |
| `status` | `ENUM('active','disbanded','suspended')` | |
| `member_count` | `INT UNSIGNED` | Maintained by atomic SQL increment/decrement |
| `territory_count` | `INT UNSIGNED` | Maintained by atomic SQL increment/decrement |
| `created_at` | `DATETIME(3)` | |
| `updated_at` | `DATETIME(3)` | |

**Key constraints:** `UNIQUE KEY uq_tag(tag)` and `UNIQUE KEY uq_name(name)` back `FactionAlreadyExistsError`.

---

### 104 — `atc_territories`

| Column | Type | Notes |
|---|---|---|
| `id` | `CHAR(26)` | UUID v7, PK |
| `name` | `VARCHAR(128)` | |
| `zone_label` | `VARCHAR(64)` | |
| `controller_faction_id` | `CHAR(26)` | Nullable FK → `atc_factions.id` |
| `is_contested` | `TINYINT(1)` | Set during active conflict; cleared on resolve/abort |
| `created_at` | `DATETIME(3)` | |
| `updated_at` | `DATETIME(3)` | |

**Index:** `INDEX idx_controller(controller_faction_id)` for efficient faction territory listing.

---

### 105 — `atc_territory_claims`

| Column | Type | Notes |
|---|---|---|
| `id` | `CHAR(26)` | UUID v7, PK |
| `territory_id` | `CHAR(26)` | FK → `atc_territories.id` |
| `faction_id` | `CHAR(26)` | FK → `atc_factions.id` |
| `status` | `ENUM('active','superseded','released')` | |
| `nonce` | `CHAR(26)` | `UNIQUE KEY uq_nonce(nonce)` for idempotency |
| `claimed_at` | `DATETIME(3)` | |
| `updated_at` | `DATETIME(3)` | |

**Allowed transitions (`ALLOWED_CLAIM_TRANSITIONS`):** `active` → `superseded` | `released`.

---

### 106 — `atc_faction_conflicts`

| Column | Type | Notes |
|---|---|---|
| `id` | `CHAR(26)` | UUID v7, PK |
| `territory_id` | `CHAR(26)` | FK → `atc_territories.id` |
| `attacker_faction_id` | `CHAR(26)` | FK → `atc_factions.id` |
| `defender_faction_id` | `CHAR(26)` | FK → `atc_factions.id` |
| `status` | `ENUM('active','resolved','aborted','stalemate')` | |
| `attacker_won` | `TINYINT(1)` | Nullable; set on `resolved` |
| `nonce` | `CHAR(26)` | `UNIQUE KEY uq_nonce(nonce)` for idempotency |
| `started_at` | `DATETIME(3)` | |
| `ended_at` | `DATETIME(3)` | Nullable |
| `created_at` | `DATETIME(3)` | |
| `updated_at` | `DATETIME(3)` | |

**Allowed transitions (`ALLOWED_CONFLICT_TRANSITIONS`):** `active` → `resolved` | `aborted` | `stalemate`.

**Index:** `INDEX idx_territory_active(territory_id, status)` — used by `FOR UPDATE` check in `ConflictRuntimeService.startConflict()`.

---

### 107 — `atc_resource_nodes`

| Column | Type | Notes |
|---|---|---|
| `id` | `CHAR(26)` | UUID v7, PK |
| `territory_id` | `CHAR(26)` | FK → `atc_territories.id` |
| `owner_faction_id` | `CHAR(26)` | Nullable FK → `atc_factions.id` |
| `node_type` | `VARCHAR(64)` | e.g. `oil`, `weapon_cache`, `comm_tower` |
| `label` | `VARCHAR(128)` | |
| `captured_at` | `DATETIME(3)` | Nullable |
| `created_at` | `DATETIME(3)` | |
| `updated_at` | `DATETIME(3)` | |

---

### 108 — `atc_influence_runtime`

| Column | Type | Notes |
|---|---|---|
| `id` | `CHAR(26)` | UUID v7, PK |
| `faction_id` | `CHAR(26)` | FK → `atc_factions.id` |
| `territory_id` | `CHAR(26)` | FK → `atc_territories.id` |
| `influence` | `TINYINT UNSIGNED` | Clamped 0–100 via `GREATEST`/`LEAST` |
| `updated_at` | `DATETIME(3)` | |

**Key constraints:** `UNIQUE KEY uq_faction_territory(faction_id, territory_id)` — enforces one row per pair; upserted via `ON DUPLICATE KEY UPDATE`.

---

## 4. Service Reference

### 4.1 `FactionRuntimeService`

| Method | Description |
|---|---|
| `createFaction(name, tag, leaderPrincipalId)` | Creates faction. Throws `FactionAlreadyExistsError` on duplicate tag or name (`ER_DUP_ENTRY`). Emits `atc:faction:created`. |
| `disbandFaction(factionId)` | Sets status → `disbanded`. Bulk-releases all active claims via `ZoneClaimService`. Emits `atc:faction:disbanded`. |
| `addMember(factionId, principalId, rank, invitedBy?)` | Atomic `member_count` increment via `FOR UPDATE`. Throws `FactionMemberAlreadyActiveError` on duplicate active. Emits `atc:faction:member:joined`. |
| `removeMember(factionId, principalId)` | Sets `left_at = NOW()`. Atomic `member_count` decrement. Emits `atc:faction:member:left`. |

---

### 4.2 `TerritoryControlService`

| Method | Description |
|---|---|
| `claimTerritory(factionId, territoryId, nonce)` | Acquires `FOR UPDATE` on territory row. Supersedes existing active claim. Updates `controller_faction_id` and atomically increments new owner's `territory_count` and decrements prior owner's — all within one connection. Emits `atc:faction:territory:claimed`. |
| `releaseTerritory(claimId)` | Transitions claim status → `released`. Clears `controller_faction_id`, decrements `territory_count`. Emits `atc:faction:territory:released`. |

---

### 4.3 `InfluenceRuntimeService`

| Method | Description |
|---|---|
| `addInfluence(factionId, territoryId, delta)` | Upserts via `ON DUPLICATE KEY UPDATE`; clamps 0–100 using `GREATEST`/`LEAST` in SQL. If resulting influence ≥ 75 triggers `TerritoryControlService.claimTerritory`. |
| `propagateInfluence(factionId, sourceTerritoryId)` | Adds a 5-point bonus to all other territories the faction has influence rows for (excludes source). Calls `addInfluence` per row. |
| `getInfluence(factionId, territoryId)` | Returns current influence value (0 if no row). |

---

### 4.4 `ConflictRuntimeService`

| Method | Transition | Notes |
|---|---|---|
| `startConflict(attackerFactionId, defenderFactionId, territoryId, nonce)` | → `active` | `FOR UPDATE` on territory; throws `ConflictAlreadyActiveError` if another active conflict exists on same territory. Sets `is_contested = 1`. Emits `atc:faction:conflict:started`. |
| `resolveConflict(conflictId, attackerWon)` | `active` → `resolved` | If `attackerWon`, calls `TerritoryControlService.claimTerritory` for attacker. Clears `is_contested`. Emits `atc:faction:conflict:resolved`. |
| `abortConflict(conflictId)` | `active` → `aborted` | Clears `is_contested`. |
| `stalemateConflict(conflictId)` | `active` → `stalemate` | Clears `is_contested`; no ownership change. |

---

### 4.5 `ZoneClaimService`

| Method | Description |
|---|---|
| `createClaim(factionId, territoryId, nonce)` | Creates a new `active` claim record. Called internally by `TerritoryControlService`. |
| `supersedeClaim(claimId)` | Transitions claim → `superseded`. |
| `releaseClaim(claimId)` | Transitions claim → `released`. |
| `bulkReleaseFactionClaims(factionId)` | Sets all `active` claims for a faction → `released`. Called by `disbandFaction`. |

---

### 4.6 `ResourceNodeService`

| Method | Description |
|---|---|
| `captureNode(nodeId, factionId)` | Acquires `FOR UPDATE` on resource node row. Throws `ResourceNodeAlreadyOwnedError` if same faction already owns the node. Sets `owner_faction_id`, `captured_at`. Emits `atc:faction:resource:captured`. |
| `releaseNode(nodeId)` | Clears `owner_faction_id`, `captured_at`. Emits `atc:faction:resource:released`. |
| `getNode(nodeId)` | Fetches node by ID. Throws `ResourceNodeNotFoundError` if absent. |

---

## 5. Error Hierarchy & HTTP Map

All errors extend `FactionError`.

```
FactionError (base)
├── FactionNotFoundError(id)                            → 404
├── FactionValidationError(message)                     → 422
├── FactionAlreadyExistsError(tag|name)                 → 409
├── FactionMemberNotFoundError(factionId, principalId)  → 404
├── FactionMemberAlreadyActiveError(factionId, principalId) → 409
├── TerritoryNotFoundError(id)                          → 404
├── TerritoryClaimNotFoundError(id)                     → 404
├── TerritoryClaimImmutableError(id, from, to)          → 409
├── ConflictNotFoundError(id)                           → 404
├── ConflictAlreadyActiveError(territoryId)             → 409
├── ConflictImmutableError(id, from, to)                → 409
├── ResourceNodeNotFoundError(id)                       → 404
└── ResourceNodeAlreadyOwnedError(nodeId, factionId)    → 409
```

**Error response envelope:**

```json
{
  "error": {
    "code": "ConflictAlreadyActiveError",
    "message": "Territory '<id>' already has an active conflict.",
    "status": 409
  }
}
```

---

## 6. State Machines

### Faction Status

```
  createFaction()
       │
       ▼
  ┌────────┐
  │ active │──── disbandFaction() ──► disbanded (terminal)
  └────────┘
       │
       └──── admin suspend ──────► suspended
                                        │
                                        └── admin reinstate ──► active
```

---

### Territory Claim Status (`ALLOWED_CLAIM_TRANSITIONS`)

```
  claimTerritory()
       │
       ▼
  ┌────────┐
  │ active │──── claimTerritory() by another faction ──► superseded (terminal)
  └────────┘
       │
       └──── releaseTerritory() / disbandFaction() ──► released (terminal)
```

---

### Conflict Status (`ALLOWED_CONFLICT_TRANSITIONS`)

```
  startConflict()
       │
       ▼
  ┌────────┐
  │ active │──── resolveConflict() ──► resolved  (terminal)
  └────────┘──── abortConflict()  ──► aborted   (terminal)
       │
       └──────── stalemateConflict() ──► stalemate (terminal)
```

Any transition from a terminal state throws `ConflictImmutableError (409)`.

---

## 7. API Routes

Base path: `/api/v1/factions`

All routes require a valid session token. Write operations require the listed capability.

### Factions

| Method | Path | Capability | Description |
|---|---|---|---|
| `POST` | `/` | `faction:manage` | Create a faction |
| `GET` | `/:factionId` | `faction:read` | Get faction by ID |
| `POST` | `/:factionId/disband` | `faction:manage` | Disband a faction |
| `POST` | `/:factionId/members` | `faction:manage` | Add member |
| `DELETE` | `/:factionId/members/:principalId` | `faction:manage` | Remove member |

### Territories

| Method | Path | Capability | Description |
|---|---|---|---|
| `POST` | `/territories/:territoryId/claim` | `faction:territory:manage` | Claim a territory |
| `POST` | `/territories/:territoryId/release` | `faction:territory:manage` | Release a territory |

### Influence

| Method | Path | Capability | Description |
|---|---|---|---|
| `POST` | `/influence` | `faction:territory:manage` | Add influence to a territory |
| `GET` | `/influence/:factionId/:territoryId` | `faction:read` | Get current influence |

### Conflicts

| Method | Path | Capability | Description |
|---|---|---|---|
| `POST` | `/conflicts` | `faction:conflict:manage` | Start a conflict |
| `POST` | `/conflicts/:conflictId/resolve` | `faction:conflict:manage` | Resolve a conflict |
| `POST` | `/conflicts/:conflictId/abort` | `faction:conflict:manage` | Abort a conflict |
| `POST` | `/conflicts/:conflictId/stalemate` | `faction:conflict:manage` | Mark stalemate |

### Resource Nodes

| Method | Path | Capability | Description |
|---|---|---|---|
| `POST` | `/resource-nodes/:nodeId/capture` | `faction:resource:manage` | Capture a resource node |
| `POST` | `/resource-nodes/:nodeId/release` | `faction:resource:manage` | Release a resource node |
| `GET` | `/resource-nodes/:nodeId` | `faction:read` | Get node details |

---

## 8. EventBus Integration

All events are emitted on the internal `EventBus`. Never use `TriggerEvent` (server→server) for cross-service communication.

| Event | Payload | Emitter |
|---|---|---|
| `atc:faction:created` | `{ factionId, name, tag }` | `FactionRuntimeService` |
| `atc:faction:disbanded` | `{ factionId }` | `FactionRuntimeService` |
| `atc:faction:member:joined` | `{ factionId, principalId, rank }` | `FactionRuntimeService` |
| `atc:faction:member:left` | `{ factionId, principalId }` | `FactionRuntimeService` |
| `atc:faction:territory:claimed` | `{ factionId, territoryId, claimId }` | `TerritoryControlService` |
| `atc:faction:territory:released` | `{ factionId, territoryId, claimId }` | `TerritoryControlService` |
| `atc:faction:conflict:started` | `{ conflictId, territoryId, attackerFactionId, defenderFactionId }` | `ConflictRuntimeService` |
| `atc:faction:conflict:resolved` | `{ conflictId, territoryId, attackerWon }` | `ConflictRuntimeService` |
| `atc:faction:resource:captured` | `{ nodeId, factionId, territoryId }` | `ResourceNodeService` |
| `atc:faction:resource:released` | `{ nodeId, previousOwnerFactionId }` | `ResourceNodeService` |

**Note:** Downstream consumers (Agent 2) subscribe to these events only. They must not write to any `@atc/faction-runtime` tables directly.

---

## 9. FiveM Bridge

**File:** `game/atc-core/server/factions.lua`
**SDK namespace:** `ATC.Factions`

### Exposed SDK Functions

| Function | Underlying service call |
|---|---|
| `ATC.Factions.CreateFaction(name, tag, leaderSrc)` | `FactionRuntimeService.createFaction` |
| `ATC.Factions.DisbandFaction(factionId)` | `FactionRuntimeService.disbandFaction` |
| `ATC.Factions.AddMember(factionId, principalId, rank)` | `FactionRuntimeService.addMember` |
| `ATC.Factions.RemoveMember(factionId, principalId)` | `FactionRuntimeService.removeMember` |
| `ATC.Factions.ClaimTerritory(factionId, territoryId, nonce)` | `TerritoryControlService.claimTerritory` |
| `ATC.Factions.ReleaseTerritory(claimId)` | `TerritoryControlService.releaseTerritory` |
| `ATC.Factions.AddInfluence(factionId, territoryId, delta)` | `InfluenceRuntimeService.addInfluence` |
| `ATC.Factions.StartConflict(attackerFactionId, defenderFactionId, territoryId, nonce)` | `ConflictRuntimeService.startConflict` |
| `ATC.Factions.ResolveConflict(conflictId, attackerWon)` | `ConflictRuntimeService.resolveConflict` |
| `ATC.Factions.AbortConflict(conflictId)` | `ConflictRuntimeService.abortConflict` |
| `ATC.Factions.CaptureNode(nodeId, factionId)` | `ResourceNodeService.captureNode` |
| `ATC.Factions.ReleaseNode(nodeId)` | `ResourceNodeService.releaseNode` |

### Registered Server Events

| Event | Purpose |
|---|---|
| `atc:faction:territory:claim:request` | Client requests territory claim; server resolves source, validates, calls `TerritoryControlService.claimTerritory` |
| `atc:faction:conflict:start:request` | Client initiates conflict; server validates both factions exist and territory is not already contested |
| `atc:faction:resource:capture:request` | Client captures node; server resolves source to `principalId`, confirms faction membership, calls `ResourceNodeService.captureNode` |

### Principal Resolution

All `source` (player server ID) values are resolved to `principalId` server-side via `ATC.SDK.Player.Get(source).id` before being passed to any service. Client-supplied identity values are rejected unconditionally.

---

## 10. Concurrency Model

| Scenario | Mechanism |
|---|---|
| Concurrent territory claims for the same territory | `FOR UPDATE` on `atc_territories` row; supersedes existing active claim atomically within one connection |
| Concurrent conflict starts on the same territory | `FOR UPDATE` on `atc_territories` row + active conflict check; second caller receives `ConflictAlreadyActiveError (409)` |
| Race on `member_count` increment/decrement | `FOR UPDATE` on `atc_factions` row during `addMember` / `removeMember` |
| Race on `territory_count` update during claim | Atomic SQL increment/decrement inside the same connection as the territory update |
| Duplicate influence rows per (faction, territory) | `ON DUPLICATE KEY UPDATE` in `InfluenceRuntimeService.addInfluence`; clamp via `GREATEST(0, LEAST(100, influence + delta))` |
| Same faction re-capturing an owned resource node | `FOR UPDATE` on `atc_resource_nodes` row; throws `ResourceNodeAlreadyOwnedError` if `owner_faction_id` matches |
| Duplicate claim/conflict nonce (replay) | `UNIQUE KEY uq_nonce(nonce)` on both `atc_territory_claims` and `atc_faction_conflicts`; DB rejects duplicate nonces at insert |

---

## 11. Key Invariants

1. **One active claim per territory.** At most one row in `atc_territory_claims` with `status = 'active'` per `territory_id` at any time. Supersede-then-insert is done under `FOR UPDATE`.
2. **One active conflict per territory.** At most one row in `atc_faction_conflicts` with `status = 'active'` per `territory_id`. Enforced by `FOR UPDATE` + existence check in `startConflict`.
3. **`member_count` and `territory_count` stay non-negative.** Both are `INT UNSIGNED`; decrements are conditional on the counter being > 0.
4. **Influence clamped 0–100.** The DB `TINYINT UNSIGNED` type and the `GREATEST`/`LEAST` SQL expression together ensure the value never escapes the valid range.
5. **Claim nonces are idempotent.** A second `claimTerritory` call with the same nonce returns the existing claim without creating a duplicate row.
6. **Conflict resolution triggers ownership transfer.** When `attackerWon = true`, `resolveConflict` always calls `TerritoryControlService.claimTerritory`; `is_contested` is cleared regardless of outcome.
7. **Disband cascades claim release.** `disbandFaction` calls `ZoneClaimService.bulkReleaseFactionClaims` before setting status → `disbanded`; no orphaned active claims remain for a disbanded faction.

---

## 12. Security Checklist

- [x] No client-trusted values — `source` resolved to `principalId` server-side in all bridge events
- [x] All write endpoints require a named capability (`faction:manage`, `faction:territory:manage`, `faction:conflict:manage`, `faction:resource:manage`)
- [x] Rate limiting applied to all registered FiveM server events
- [x] Input validated with Zod schemas at the API layer before reaching any service
- [x] Influence delta supplied by server game logic only; never accepted raw from client
- [x] Conflict and claim nonces validated as UUID v7 format before insert
- [x] No direct DB access outside the repository layer in `packages/db`
- [x] No hardcoded strings or credentials
- [x] Sensitive operations (disband, conflict resolution with ownership transfer) logged to audit log

---

## 13. Diagnostics

### Key Log Points

| Service | Event | Level |
|---|---|---|
| `FactionRuntimeService` | Faction created / disbanded | `info` |
| `FactionRuntimeService` | Member joined / left | `info` |
| `TerritoryControlService` | Territory claimed / released | `info` |
| `TerritoryControlService` | Superseding prior active claim | `info` |
| `InfluenceRuntimeService` | Influence threshold crossed → transfer triggered | `info` |
| `InfluenceRuntimeService` | Propagate bonus applied | `debug` |
| `ConflictRuntimeService` | Conflict started / resolved / aborted / stalemate | `info` |
| `ConflictRuntimeService` | Duplicate active conflict rejected | `warn` |
| `ResourceNodeService` | Node captured / released | `info` |
| `ResourceNodeService` | Same-faction re-capture rejected | `warn` |

### Metrics to Monitor

| Metric | Alert threshold |
|---|---|
| `ConflictAlreadyActiveError` rate | > 5/min per `territoryId` (possible exploit or event flood) |
| `ResourceNodeAlreadyOwnedError` rate | > 10/min (possible replay attack) |
| `FactionMemberAlreadyActiveError` rate | > 10/min (possible replay on member add event) |
| `FactionAlreadyExistsError` rate | > 5/min (possible tag-enumeration probe) |
| DB lock wait time on `atc_territories` | > 500 ms average |
| Influence threshold triggers per minute | Monitor spike > 20/min (may indicate delta injection) |

---

## 14. Operational Procedures

### 14.1 Applying Migrations

```bash
# Apply all pending migrations in order
pnpm --filter @atc/db migrate:latest

# Verify migration status
pnpm --filter @atc/db migrate:status
```

Migrations 103–108 must be applied before deploying the Phase 37 API or FiveM resources. They are non-destructive and safe to run on a live database.

### 14.2 Manually Disband a Faction (Ops)

```sql
-- 1. Release all active claims
UPDATE atc_territory_claims SET status = 'released', updated_at = NOW()
WHERE faction_id = '<factionId>' AND status = 'active';

-- 2. Clear controller on those territories
UPDATE atc_territories SET controller_faction_id = NULL, updated_at = NOW()
WHERE controller_faction_id = '<factionId>';

-- 3. Disband faction, zero counters
UPDATE atc_factions
SET status = 'disbanded', member_count = 0, territory_count = 0, updated_at = NOW()
WHERE id = '<factionId>';
```

Emit `atc:faction:disbanded` via EventBus after completing the above.

### 14.3 Clear a Stuck Active Conflict

If a conflict is stuck in `active` (e.g. server crash mid-conflict):

```sql
UPDATE atc_faction_conflicts
SET status = 'aborted', ended_at = NOW(), updated_at = NOW()
WHERE id = '<conflictId>' AND status = 'active';

-- Clear contested flag on territory
UPDATE atc_territories SET is_contested = 0, updated_at = NOW()
WHERE id = '<territoryId>' AND is_contested = 1;
```

This unblocks `ConflictAlreadyActiveError` for subsequent conflicts on the same territory.

### 14.4 Reset a Resource Node (Ops)

```sql
UPDATE atc_resource_nodes
SET owner_faction_id = NULL, captured_at = NULL, updated_at = NOW()
WHERE id = '<nodeId>';
```

### 14.5 Audit Territory Ownership History

```sql
SELECT tc.id, tc.faction_id, f.name AS faction_name, tc.status, tc.claimed_at, tc.updated_at
FROM atc_territory_claims tc
JOIN atc_factions f ON f.id = tc.faction_id
WHERE tc.territory_id = '<territoryId>'
ORDER BY tc.claimed_at DESC;
```

### 14.6 Audit Conflict History for a Territory

```sql
SELECT id, attacker_faction_id, defender_faction_id, status, attacker_won, started_at, ended_at
FROM atc_faction_conflicts
WHERE territory_id = '<territoryId>'
ORDER BY started_at DESC;
```

### 14.7 Check Influence Distribution

```sql
SELECT f.name, ir.influence
FROM atc_influence_runtime ir
JOIN atc_factions f ON f.id = ir.faction_id
WHERE ir.territory_id = '<territoryId>'
ORDER BY ir.influence DESC;
```

### 14.8 Rolling Back Migrations

No automatic down migrations exist for 103–108.

1. Stop the API server and FiveM resource `[atc]`.
2. Drop tables in reverse order: `atc_influence_runtime`, `atc_resource_nodes`, `atc_faction_conflicts`, `atc_territory_claims`, `atc_territories`, `atc_factions`.
3. Remove migration records from the migrations tracking table.
4. Redeploy the previous build.

> **Warning:** Rolling back destroys all faction and territory runtime data. Take a full DB backup before any rollback.

---

## 15. Agent Scope Boundary

**Agent 1** owns everything in this runbook:

- `@atc/faction-runtime` package, all six services, all six repositories
- Migrations 103–108
- API routes in `apps/api/src/routes/factions.ts`
- FiveM bridge at `game/atc-core/server/factions.lua`

**Agent 2** may only consume `atc:faction:*` EventBus events. Agent 2 must not write to any table owned by this package and must not call any `@atc/faction-runtime` service directly. The following are explicitly out of scope for Agent 1:

- Territory heat maps and analytics dashboards
- Political simulation / predictive territory spread
- MDT faction intel views
- Cross-faction criminal intelligence correlation (`@atc/criminal-runtime` domain)
