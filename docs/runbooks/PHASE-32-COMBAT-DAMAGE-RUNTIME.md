# Phase 32 Runbook — Combat & Damage Runtime

**Package:** `@atc/combat-runtime`  
**Migrations:** 074–079  
**API routes:** 13  
**FiveM bridge:** `game/atc-core/server/combat.lua`  
**Tests:** `packages/tests/src/combat-runtime.test.ts`

---

## Overview

Phase 32 implements the authoritative server-side combat runtime for ATC. It covers the full damage pipeline — from weapon registration and equip/unequip state through damage event recording with anti-replay deduplication, ballistics data, injury propagation, and combat session lifecycle. All numeric calculations are server-authoritative; no damage values are trusted from the client.

**Agent 1 scope only.** Analytics, kill/death ratio reporting, MDT combat records, damage heatmaps, and CombatAuditService read projections are owned by Agent 2 and are not built here.

---

## Package: `@atc/combat-runtime`

Location: `packages/combat-runtime/`

### Files

| File | Purpose |
|------|---------|
| `src/errors.ts` | 10 domain error classes |
| `src/weapon.repository.ts` | Weapon registry CRUD + status transitions |
| `src/weapon-runtime.repository.ts` | Equip/unequip runtime records (FOR UPDATE) |
| `src/damage.repository.ts` | Damage event insert + anti-replay nonce dedup |
| `src/combat-session.repository.ts` | Session lifecycle CRUD |
| `src/ballistics.repository.ts` | Ballistics sub-record insert |
| `src/injury.repository.ts` | Injury apply/resolve/list (append-only) |
| `src/combat-runtime.service.ts` | Session lifecycle orchestration |
| `src/damage.service.ts` | Damage event recording + net_damage computation |
| `src/weapon-state.service.ts` | Equip/unequip with FOR UPDATE lock |
| `src/ballistics.service.ts` | Ballistics attachment to damage events |
| `src/injury-propagation.service.ts` | Injury apply/resolve/listActive |
| `src/combat-audit.service.ts` | Read-side: listBySession, listByVictim, getSessionSummary |
| `src/index.ts` | Barrel exports |

---

## State Machines

### Weapon Status

```
registered ──────────────────────────────► active
     │                                      │
     ├────────────────────────────────────► lost
     ├────────────────────────────────────► seized
     └────────────────────────────────────► destroyed

active ──────────────────────────────────► lost
  │ ──────────────────────────────────────► seized
  └─────────────────────────────────────► destroyed

lost ────────────────────────────────────► registered
  └─────────────────────────────────────► seized

seized ──────────────────────────────────► destroyed

destroyed ──────────────────────────────► (terminal)
```

Valid transitions:

| From | To allowed |
|------|------------|
| registered | active, lost, seized, destroyed |
| active | lost, seized, destroyed |
| lost | registered, seized |
| seized | destroyed |
| destroyed | (none — terminal) |

Weapon equip is only permitted when status is `active`. Weapons with status `seized` or `locked = 1` are rejected at the service layer before any runtime write.

### Combat Session

```
active ──── end ────► ended      (terminal)
  └────── abandon ──► abandoned  (terminal)
```

| From | To allowed |
|------|------------|
| active | ended, abandoned |
| ended | (none — terminal) |
| abandoned | (none — terminal) |

---

## Database Migrations

| # | File | Table | Key Notes |
|---|------|-------|-----------|
| 074 | `074_create_weapon_registry.sql` | `atc_weapon_registry` | UNIQUE KEY `uq_serial(serial)`; status ENUM; durability INT 0–100 |
| 075 | `075_create_weapon_runtime.sql` | `atc_weapon_runtime` | FK → weapon; UNIQUE KEY `uq_weapon_holder(weapon_id, holder_principal_id)`; attachment_state JSON |
| 076 | `076_create_damage_events.sql` | `atc_damage_events` | UNIQUE KEY `uq_replay_nonce(attacker_principal_id, victim_principal_id, replay_nonce)`; hit_bone ENUM; net_damage computed server-side |
| 077 | `077_create_combat_sessions.sql` | `atc_combat_sessions` | status ENUM(active, ended, abandoned); participant_count INT UNSIGNED |
| 078 | `078_create_ballistics.sql` | `atc_ballistics` | FK → damage_event; UNIQUE KEY `uq_damage_event(damage_event_id)`; penetration_data JSON |
| 079 | `079_create_injury_runtime.sql` | `atc_injury_runtime` | Append-only; resolved_at NULL = active; INDEX `idx_principal_active(principal_id, resolved_at)` |

### Schema Notes

**`atc_weapon_registry`**  
`id CHAR(26)`, `owner_principal_id`, `organization_id`, `model VARCHAR(128)`, `category ENUM('pistol','rifle','shotgun','smg','sniper','melee','explosive','thrown','unarmed')`, `serial VARCHAR(64)`, `durability INT` (0–100), `is_locked TINYINT`, `status ENUM('registered','active','lost','seized','destroyed')`, `registered_by_principal_id`, `seized_by_principal_id`, `seized_at`, `created_at`, `updated_at`

**`atc_damage_events`**  
`hit_bone ENUM('head','chest','abdomen','left_arm','right_arm','left_leg','right_leg','back','unknown')`, `damage_amount SMALLINT UNSIGNED`, `mitigated_amount SMALLINT UNSIGNED`, `net_damage SMALLINT UNSIGNED`, `hit_x/y/z DECIMAL(10,4)` nullable, `session_id` FK nullable, `weapon_id` FK nullable

**`atc_injury_runtime`**  
`body_region ENUM` (same values as `hit_bone`), `severity ENUM('minor','moderate','severe','critical','fatal')`, `source_damage_event_id` FK nullable; never DELETE — `resolved_at` set on resolution.

Run migrations:
```bash
pnpm --filter "@atc/db" db:migrate
```

---

## Services Architecture

```
CombatRuntimeService
  └── CombatSessionRepository (start / end / abandon, state machine)

DamageService
  └── DamageRepository (INSERT with anti-replay nonce; UNIQUE constraint dedup)

WeaponStateService
  ├── WeaponRepository (status check + FOR UPDATE lock)
  └── WeaponRuntimeRepository (equip/unequip INSERT/UPDATE)

BallisticsService
  └── BallisticsRepository (INSERT optional sub-record per damage event)

InjuryPropagationService
  └── InjuryRepository (apply, resolveAll on revive, listActive by principalId)

CombatAuditService  ← read-side only
  └── DamageRepository (listBySession, listByVictim, getSessionSummary)
```

---

## Service Responsibilities

### `CombatRuntimeService`
Manages combat session lifecycle. Starts a session (sets status `active`), ends it with an outcome string (sets `ended_at`), or marks it `abandoned`. Emits `atc:combat:session:started` and `atc:combat:session:ended` on each transition.

### `DamageService`
Records damage events. Computes `net_damage = damage_amount - mitigated_amount` server-side — never trusts the incoming value. Inserts with the anti-replay UNIQUE KEY; a duplicate `(attacker, victim, nonce)` raises `DuplicateDamageError` (409) before any row is written. Emits `atc:combat:damage:applied`.

### `WeaponStateService`
Handles equip and unequip. Issues `SELECT ... FOR UPDATE` on the weapon registry row before any runtime write to prevent double-equip races. Validates status is `active` and `is_locked = 0`; raises `WeaponSeizedError` or `WeaponLockedError` on failure. The UNIQUE KEY on `atc_weapon_runtime(weapon_id, holder_principal_id)` provides a second layer of protection. Emits `atc:combat:weapon:equipped` / `atc:combat:weapon:unequipped`.

### `BallisticsService`
Attaches an optional ballistics record (velocity, distance, impact_angle, penetration_data) to an existing damage event. The UNIQUE KEY on `atc_ballistics(damage_event_id)` prevents duplicate ballistics records for the same hit. Emits `atc:combat:ballistics:recorded`.

### `InjuryPropagationService`
Applies per-body-region injuries with a severity level. Records are append-only — resolution sets `resolved_at`; rows are never deleted. `resolveAll(principalId)` sets `resolved_at = NOW()` on all active injuries for a principal (called on revive). `listActive(principalId)` queries `WHERE resolved_at IS NULL`. Emits `atc:combat:injury:applied` and `atc:combat:injury:resolved`.

### `CombatAuditService` (read-side only)
Provides `listBySession(sessionId)`, `listByVictim(principalId)`, and `getSessionSummary(sessionId)`. No writes. Agent 2 extends this for analytics and reporting.

---

## API Routes

**File:** `apps/api/src/routes/combat.ts`

| Method | Path | Capability | Service |
|--------|------|------------|---------|
| POST | `/api/v1/combat/weapons` | `combat:weapon:register` | WeaponStateService.register |
| GET | `/api/v1/combat/weapons/:weaponId` | `combat:weapon:read` | WeaponStateService.findById |
| POST | `/api/v1/combat/weapons/:weaponId/equip` | `combat:weapon:equip` | WeaponStateService.equip |
| POST | `/api/v1/combat/weapons/:weaponId/unequip` | `combat:weapon:equip` | WeaponStateService.unequip |
| POST | `/api/v1/combat/weapons/:weaponId/ammo` | `combat:weapon:sync` | WeaponStateService.syncAmmo |
| POST | `/api/v1/combat/weapons/:weaponId/seize` | `combat:weapon:seize` | WeaponStateService.seize |
| POST | `/api/v1/combat/damage` | `combat:damage:apply` | DamageService.apply |
| POST | `/api/v1/combat/sessions` | `combat:session:manage` | CombatRuntimeService.start |
| POST | `/api/v1/combat/sessions/:sessionId/end` | `combat:session:manage` | CombatRuntimeService.end |
| POST | `/api/v1/combat/injuries` | `combat:injury:apply` | InjuryPropagationService.apply |
| POST | `/api/v1/combat/injuries/:injuryId/resolve` | `combat:injury:apply` | InjuryPropagationService.resolve |
| GET | `/api/v1/combat/injuries/:principalId` | `combat:injury:read` | InjuryPropagationService.listActive |
| GET | `/api/v1/combat/sessions/:sessionId/audit` | `combat:audit:read` | CombatAuditService.getSessionSummary |

---

## EventBus Events

All events emitted via `EventBus.emit()`. Fire-and-forget with `.catch(() => undefined)` to avoid blocking database transactions.

| Event | Emitter | Payload |
|-------|---------|---------|
| `atc:combat:session:started` | CombatRuntimeService.start | `{ sessionId, initiatorPrincipalId }` |
| `atc:combat:session:ended` | CombatRuntimeService.end / abandon | `{ sessionId, outcome }` |
| `atc:combat:damage:applied` | DamageService.apply | `{ eventId, attackerPrincipalId, victimPrincipalId, netDamage }` |
| `atc:combat:weapon:equipped` | WeaponStateService.equip | `{ weaponId, holderPrincipalId }` |
| `atc:combat:weapon:unequipped` | WeaponStateService.unequip | `{ weaponId, holderPrincipalId }` |
| `atc:combat:injury:applied` | InjuryPropagationService.apply | `{ injuryId, principalId, severity }` |
| `atc:combat:injury:resolved` | InjuryPropagationService.resolve / resolveAll | `{ injuryId, principalId }` |
| `atc:combat:weapon:registered` | WeaponStateService.register | `{ weaponId }` |
| `atc:combat:weapon:seized` | WeaponStateService.seize | `{ weaponId, seizedByPrincipalId }` |

---

## Error Hierarchy

```
CombatError (base)
├── WeaponNotFoundError(id)
├── WeaponValidationError(message)
├── WeaponSeizedError(id)
├── WeaponLockedError(id)
├── WeaponAlreadyEquippedError(id)
├── DuplicateDamageError(nonce)          ← duplicate replay nonce
├── CombatSessionNotFoundError(id)
├── CombatSessionEndedError(id)
├── InjuryNotFoundError(id)
└── InsufficientAmmoError(weaponId, current, needed)
```

---

## Error Response Map

| Error Class | HTTP | Notes |
|-------------|------|-------|
| `WeaponNotFoundError` | 404 | |
| `CombatSessionNotFoundError` | 404 | |
| `InjuryNotFoundError` | 404 | |
| `WeaponSeizedError` | 409 | Weapon status is `seized` |
| `WeaponLockedError` | 409 | `is_locked = 1` |
| `WeaponAlreadyEquippedError` | 409 | UNIQUE constraint or FOR UPDATE race |
| `DuplicateDamageError` | 409 | Replay nonce already recorded |
| `CombatSessionEndedError` | 409 | Session is in terminal state |
| `InsufficientAmmoError` | 422 | |
| `WeaponValidationError` | 422 | Schema / input validation failure |

---

## Concurrency Design

### Double-Equip Prevention
`WeaponStateService.equip()` issues `SELECT ... FOR UPDATE` on the `atc_weapon_registry` row before touching `atc_weapon_runtime`. The UNIQUE KEY `uq_weapon_holder(weapon_id, holder_principal_id)` on `atc_weapon_runtime` provides a second layer: any race that survives the FOR UPDATE lock raises `ER_DUP_ENTRY`, caught and re-thrown as `WeaponAlreadyEquippedError`.

### Damage Anti-Replay
The UNIQUE KEY `uq_replay_nonce(attacker_principal_id, victim_principal_id, replay_nonce)` on `atc_damage_events` prevents duplicate damage events from replayed or retried client requests. Any `ER_DUP_ENTRY` on INSERT is caught and re-thrown as `DuplicateDamageError` (409) — no separate SELECT guard needed.

### Ballistics Dedup
UNIQUE KEY `uq_damage_event(damage_event_id)` on `atc_ballistics` ensures only one ballistics record per damage event. Duplicate inserts raise a constraint error caught at the service layer.

### Append-Only Injuries
Injury records are never deleted. Active injuries are identified by `resolved_at IS NULL`. `resolveAll()` issues a bulk `UPDATE ... SET resolved_at = NOW() WHERE principal_id = ? AND resolved_at IS NULL`. The index `idx_principal_active(principal_id, resolved_at)` keeps `listActive()` fast.

### Server-Side net_damage
`net_damage` is never accepted from the client. `DamageService.apply()` always computes `net_damage = damage_amount - mitigated_amount` from validated inputs before INSERT.

---

## FiveM Bridge

**File:** `game/atc-core/server/combat.lua`  
**SDK namespace:** `ATC.Combat`

### SDK Functions

| Function | Description |
|----------|-------------|
| `ATC.Combat.RegisterWeapon(source, params, cb)` | Register weapon into registry |
| `ATC.Combat.EquipWeapon(source, weaponId, cb)` | Equip weapon for player |
| `ATC.Combat.UnequipWeapon(source, weaponId, cb)` | Unequip weapon for player |
| `ATC.Combat.SyncAmmo(source, weaponId, ammo, cb)` | Sync current ammo state |
| `ATC.Combat.ApplyDamage(source, params, cb)` | Record damage event with server-computed net_damage |
| `ATC.Combat.StartSession(source, params, cb)` | Start a combat session |
| `ATC.Combat.EndSession(source, sessionId, outcome, cb)` | End or abandon session |
| `ATC.Combat.ApplyInjury(source, params, cb)` | Apply injury to a principal |
| `ATC.Combat.ResolveInjury(source, injuryId, cb)` | Resolve a single injury |
| `ATC.Combat.GetActiveInjuries(principalId, cb)` | List active injuries |

### Server Events (client → server)

```lua
-- Client fires:
TriggerServerEvent('atc:combat:damage:request',          payload)
TriggerServerEvent('atc:combat:weapon:equip:request',    weaponId)
TriggerServerEvent('atc:combat:weapon:unequip:request',  weaponId)
```

All principal IDs are resolved server-side via `ATC.Accounts.GetPrincipalId(source)`. Numeric values from the client are sanitized with `tonumber()` and clamped with `math.min()` before forwarding to the API. The client provides a nonce; the server deduplicates via the DB UNIQUE constraint on `atc_damage_events`.

---

## Security Checklist

- [x] All damage calculations server-authoritative — `net_damage` computed from server-validated inputs only
- [x] Principal IDs resolved server-side via `ATC.Accounts.GetPrincipalId(source)` in FiveM bridge
- [x] All numeric values from client sanitized with `tonumber()` and clamped with `math.min()`
- [x] Anti-replay UNIQUE KEY on `(attacker_principal_id, victim_principal_id, replay_nonce)` prevents duplicate damage events
- [x] FOR UPDATE on weapon registry row during equip/unequip prevents double-equip race
- [x] UNIQUE KEY on `atc_weapon_runtime(weapon_id, holder_principal_id)` as second equip-race guard
- [x] Capability checks on all write routes (`combat:weapon:register`, `combat:damage:apply`, `combat:session:manage`, `combat:injury:apply`, `combat:weapon:seize`, etc.)
- [x] Weapon seizure audited: `seized_by_principal_id` + `seized_at` stored permanently on registry row
- [x] All damage events permanently stored: attacker + victim + timestamp + hit bone — never deleted
- [x] Injury records append-only — `resolved_at` set on resolution, never DELETE
- [x] Weapon status validated before equip (`active` only; `seized` or `locked` rejected)
- [x] Input validated with Zod schema at API boundary before any repository call
- [x] No direct DB access outside repository layer
- [x] No hardcoded strings or credentials

---

## Agent Scope Boundary

This is an **Agent 1** deliverable. The following are explicitly **out of scope** and belong to Agent 2:

- `CombatAuditService` read projections beyond `getSessionSummary`
- Damage analytics and aggregate reporting
- Kill/death ratio reporting and leaderboards
- Damage heatmaps and spatial analytics
- MDT combat records and investigation tools
- Historical damage timeline reconstructions

---

## Operational SQL

### List all equipped weapons (currently active in runtime)

```sql
SELECT wr.weapon_id, wr.holder_principal_id, w.model, w.category,
       wr.current_ammo, wr.max_ammo, wr.equipped_at
FROM atc_weapon_runtime wr
JOIN atc_weapon_registry w ON w.id = wr.weapon_id
WHERE wr.is_equipped = 1
ORDER BY wr.equipped_at DESC;
```

### List all seized weapons

```sql
SELECT id, model, serial, owner_principal_id,
       seized_by_principal_id, seized_at
FROM atc_weapon_registry
WHERE status = 'seized'
ORDER BY seized_at DESC;
```

### Find damage events for a session

```sql
SELECT de.id, de.attacker_principal_id, de.victim_principal_id,
       de.weapon_model, de.hit_bone,
       de.damage_amount, de.mitigated_amount, de.net_damage,
       de.created_at
FROM atc_damage_events de
WHERE de.session_id = ?
ORDER BY de.created_at ASC;
```

### Find all active injuries for a principal

```sql
SELECT id, body_region, severity, source_damage_event_id, applied_at
FROM atc_injury_runtime
WHERE principal_id = ? AND resolved_at IS NULL
ORDER BY applied_at DESC;
```

### Resolve all injuries for a principal (manual revive recovery)

```sql
UPDATE atc_injury_runtime
SET resolved_at = NOW()
WHERE principal_id = ? AND resolved_at IS NULL;
```

### Check for duplicate replay nonces (anti-replay audit)

```sql
SELECT attacker_principal_id, victim_principal_id, replay_nonce, COUNT(*) AS hits
FROM atc_damage_events
GROUP BY attacker_principal_id, victim_principal_id, replay_nonce
HAVING hits > 1;
-- Should always return 0 rows due to UNIQUE KEY. Any results indicate constraint violation.
```

### Check weapons with low durability

```sql
SELECT id, model, serial, owner_principal_id, durability, status
FROM atc_weapon_registry
WHERE durability < 20 AND status = 'active'
ORDER BY durability ASC;
```

### List all active combat sessions

```sql
SELECT id, initiator_principal_id, participant_count, started_at,
       TIMESTAMPDIFF(MINUTE, started_at, NOW()) AS duration_minutes
FROM atc_combat_sessions
WHERE status = 'active'
ORDER BY started_at ASC;
```

### Force-end a stale combat session (after server crash)

```sql
-- Verify first:
SELECT id, status, started_at FROM atc_combat_sessions WHERE id = ?;

-- Then force-end:
UPDATE atc_combat_sessions
SET status = 'abandoned', ended_at = NOW()
WHERE id = ? AND status = 'active';
```
