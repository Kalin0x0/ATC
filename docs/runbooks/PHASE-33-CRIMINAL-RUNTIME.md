# Phase 33 — Criminal Runtime & Illegal Operations

**Runbook version:** 1.0.0
**Phase:** 33
**Package:** `@atc/criminal-runtime`
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
8. [EventBus Events](#8-eventbus-events)
9. [FiveM Bridge](#9-fivem-bridge)
10. [Concurrency & Data Integrity](#10-concurrency--data-integrity)
11. [Security Checklist](#11-security-checklist)
12. [Observability](#12-observability)
13. [Operational Procedures](#13-operational-procedures)
14. [Agent Scope Boundary](#14-agent-scope-boundary)
15. [Testing](#15-testing)

---

## 1. Overview

Phase 33 introduces the **Criminal Runtime** system, a first-party ATC plugin that models all persistent criminal-world state: gang management, illegal operations (heists, drug runs, smuggling, etc.), contraband registration and seizure, black market trades, and police raid lifecycle. All criminal state is fully server-authoritative and audit-persisted.

This runbook covers the operational details for `@atc/criminal-runtime`. It is the definitive reference for deployments, incident response, and day-to-day maintenance.

### Scope

| In scope (Agent 1) | Out of scope (Agent 2) |
|---|---|
| Gang CRUD & lifecycle | Criminal intelligence correlation |
| Operation state machine | Gang network graph |
| Contraband register / seize | Operation analytics |
| Black market trade recording | Territory control dashboards |
| Raid lifecycle | MDT criminal records |

---

## 2. Package & File Inventory

```
packages/criminal-runtime/          # @atc/criminal-runtime
├── src/
│   ├── services/
│   │   ├── CriminalRuntimeService.ts
│   │   ├── GangOperationService.ts
│   │   ├── ContrabandService.ts
│   │   ├── BlackMarketService.ts
│   │   ├── IllegalTradeService.ts
│   │   └── RaidRuntimeService.ts
│   └── errors/
│       └── index.ts
├── package.json
└── tsconfig.json

apps/api/src/routes/criminal.ts     # 16 REST endpoints

packages/db/migrations/
├── 080_create_gangs.sql
├── 081_create_gang_members.sql
├── 082_create_criminal_operations.sql
├── 083_create_contraband.sql
├── 084_create_black_market_transactions.sql
└── 085_create_raids.sql

game/atc-core/server/criminal.lua   # FiveM SDK bridge

packages/tests/src/criminal-runtime.test.ts
```

---

## 3. Database Migrations

All migrations must be applied in order. They are idempotent with `IF NOT EXISTS` guards.

### 080 — `atc_gangs`

| Column | Type | Notes |
|---|---|---|
| `id` | `CHAR(26)` | UUID v7, PK |
| `name` | `VARCHAR(64)` | Gang display name |
| `tag` | `VARCHAR(8)` | Short identifier; `UNIQUE KEY uq_tag(tag)` |
| `leader_principal_id` | `CHAR(26)` | FK → principals |
| `territory_id` | `CHAR(26)` | Nullable FK → territories |
| `status` | `ENUM('active','disbanded','suspended')` | |
| `member_count` | `INT UNSIGNED` | Maintained by service layer |
| `created_at` | `DATETIME(3)` | |
| `updated_at` | `DATETIME(3)` | |

**Key constraints:** `UNIQUE KEY uq_tag(tag)` — enforces no duplicate gang tags at DB level, backing `GangAlreadyExistsError`.

---

### 081 — `atc_gang_members`

| Column | Type | Notes |
|---|---|---|
| `id` | `CHAR(26)` | UUID v7, PK |
| `gang_id` | `CHAR(26)` | FK → `atc_gangs.id` |
| `principal_id` | `CHAR(26)` | FK → principals |
| `rank` | `ENUM('leader','officer','member','associate')` | |
| `invited_by_principal_id` | `CHAR(26)` | Nullable |
| `joined_at` | `DATETIME(3)` | |
| `left_at` | `DATETIME(3)` | Nullable; NULL = currently active |

**Key constraints:** `UNIQUE KEY uq_active_member(gang_id, principal_id, left_at)` — prevents a principal being an active member of the same gang twice. `left_at` is included in the key so historical memberships are preserved (append-only).

---

### 082 — `atc_criminal_operations`

| Column | Type | Notes |
|---|---|---|
| `id` | `CHAR(26)` | UUID v7, PK |
| `label` | `VARCHAR(128)` | Human-readable operation label |
| `operation_type` | `ENUM('heist','drug_run','smuggling','extortion','assassination','theft','other')` | |
| `owner_principal_id` | `CHAR(26)` | Operation owner |
| `gang_id` | `CHAR(26)` | Nullable FK → `atc_gangs.id` |
| `status` | `ENUM('planning','active','completed','failed','aborted')` | |
| `started_at` | `DATETIME(3)` | Nullable |
| `ended_at` | `DATETIME(3)` | Nullable |
| `outcome` | `VARCHAR(256)` | Nullable free-text outcome |
| `metadata` | `JSON` | Arbitrary operation data |
| `created_at` | `DATETIME(3)` | |
| `updated_at` | `DATETIME(3)` | |

---

### 083 — `atc_contraband`

| Column | Type | Notes |
|---|---|---|
| `id` | `CHAR(26)` | UUID v7, PK |
| `property_id` | `CHAR(26)` | Nullable |
| `stash_id` | `CHAR(26)` | Nullable |
| `item_name` | `VARCHAR(128)` | |
| `quantity` | `INT UNSIGNED` | |
| `status` | `ENUM('registered','seized','destroyed')` | |
| `registered_by_principal_id` | `CHAR(26)` | |
| `seized_by_principal_id` | `CHAR(26)` | Nullable |
| `seized_at` | `DATETIME(3)` | Nullable |
| `registered_at` | `DATETIME(3)` | |

---

### 084 — `atc_black_market_transactions`

| Column | Type | Notes |
|---|---|---|
| `id` | `CHAR(26)` | UUID v7, PK |
| `seller_principal_id` | `CHAR(26)` | |
| `buyer_principal_id` | `CHAR(26)` | |
| `item_name` | `VARCHAR(128)` | |
| `quantity` | `INT UNSIGNED` | |
| `price` | `INT UNSIGNED` | |
| `location_label` | `VARCHAR(128)` | Nullable |
| `completed_at` | `DATETIME(3)` | |
| `created_at` | `DATETIME(3)` | |

**Design note:** Append-only. No UPDATE or DELETE ever issued against this table.

---

### 085 — `atc_raids`

| Column | Type | Notes |
|---|---|---|
| `id` | `CHAR(26)` | UUID v7, PK |
| `property_id` | `CHAR(26)` | |
| `initiating_agency_id` | `CHAR(26)` | Nullable |
| `lead_principal_id` | `CHAR(26)` | |
| `status` | `ENUM('staging','active','completed','aborted')` | |
| `outcome` | `ENUM('success','failure','partial','aborted')` | Nullable |
| `participants` | `JSON` | Array of principal IDs; never client-supplied |
| `started_at` | `DATETIME(3)` | Nullable |
| `ended_at` | `DATETIME(3)` | Nullable |
| `notes` | `TEXT` | Nullable |
| `created_at` | `DATETIME(3)` | |
| `updated_at` | `DATETIME(3)` | |

**Key constraints:** `INDEX idx_property_active(property_id, status)` — used by the `FOR UPDATE` check in `RaidRuntimeService.start()` to detect an already-active raid on the same property, backing `RaidAlreadyActiveError`.

---

## 4. Service Reference

### 4.1 `CriminalRuntimeService`

Manages gang CRUD and membership lifecycle.

| Method | Description |
|---|---|
| `createGang(name, tag, leaderPrincipalId)` | Creates a new gang. Throws `GangAlreadyExistsError` if tag collides. Emits `gang:created`. |
| `addMember(gangId, principalId, rank, invitedBy?)` | Adds a member. `FOR UPDATE` on gang row for `member_count`. Throws `GangMemberAlreadyActiveError` on duplicate active. Emits `gang:member:joined`. |
| `removeMember(gangId, principalId)` | Sets `left_at = NOW()`. Decrements `member_count`. Emits `gang:member:left`. |
| `listByTag(tag)` | Returns gangs matching the given tag. |

**Emitted events:** `atc:criminal:gang:created`, `atc:criminal:gang:disbanded`, `atc:criminal:gang:member:joined`, `atc:criminal:gang:member:left`

---

### 4.2 `GangOperationService`

Manages the operation state machine. All transitions use `FOR UPDATE` on the operation row.

| Method | Transition | Error on illegal transition |
|---|---|---|
| `create(...)` | → `planning` | — |
| `start(operationId)` | `planning` → `active` | `GangOperationImmutableError` |
| `complete(operationId, outcome)` | `active` → `completed` | `GangOperationImmutableError` |
| `fail(operationId, outcome)` | `active` → `failed` | `GangOperationImmutableError` |
| `abort(operationId)` | `planning\|active` → `aborted` | `GangOperationImmutableError` |

**Emitted events:** `atc:criminal:operation:started`, `atc:criminal:operation:completed`, `atc:criminal:operation:aborted`

---

### 4.3 `ContrabandService`

| Method | Description |
|---|---|
| `register(...)` | Creates a contraband record with status `registered`. Emits `contraband:registered`. |
| `seize(contrabandId, seizedByPrincipalId)` | Sets status → `seized`, records `seized_by_principal_id` and `seized_at`. Throws `ContrabandAlreadySeizedError` if already seized. Emits `contraband:seized`. |
| `destroyAll(propertyId)` | Sets all `registered` contraband on a property to `destroyed`. |

**Emitted events:** `atc:criminal:contraband:registered`, `atc:criminal:contraband:seized`

---

### 4.4 `BlackMarketService`

Append-only trade recorder.

| Method | Description |
|---|---|
| `recordTrade(seller, buyer, item, quantity, price, locationLabel?)` | Inserts a new transaction record. Emits `black_market:trade`. |
| `getTransaction(id)` | Fetches a transaction by ID. Throws `BlackMarketTransactionNotFoundError` if not found. |

**Emitted events:** `atc:criminal:black_market:trade`

---

### 4.5 `IllegalTradeService`

Thin validation wrapper over `BlackMarketService`.

| Validation | Error |
|---|---|
| `seller !== buyer` | `GangValidationError` |
| `quantity > 0` | `GangValidationError` |

Delegates to `BlackMarketService.recordTrade()` after passing validation.

---

### 4.6 `RaidRuntimeService`

Manages the raid state machine. `FOR UPDATE` on `property_id` check prevents concurrent raid starts.

| Method | Transition | Notes |
|---|---|---|
| `stage(propertyId, leadPrincipalId, ...)` | → `staging` | Creates raid record |
| `start(raidId)` | `staging` → `active` | Checks no other `active` raid on same property; throws `RaidAlreadyActiveError` on conflict |
| `complete(raidId, outcome, notes?)` | `active` → `completed` | Persists outcome |
| `abort(raidId)` | `staging\|active` → `aborted` | Sets outcome to `aborted` |

**Participants:** Stored as a JSON array of server-resolved principal IDs. On read, the JSON column is deserialized automatically. Client-supplied principal IDs are never trusted — the bridge resolves `source` to `principalId` server-side.

**Emitted events:** `atc:criminal:raid:started`, `atc:criminal:raid:completed`

---

## 5. Error Hierarchy & HTTP Map

All errors extend `CriminalError`.

```
CriminalError (base)
├── GangNotFoundError(id)                       → 404
├── GangValidationError(message)                → 422
├── GangAlreadyExistsError(tag)                 → 409
├── GangMemberNotFoundError(gangId, principalId)    → 404
├── GangMemberAlreadyActiveError(gangId, principalId) → 409
├── GangOperationNotFoundError(id)              → 404
├── GangOperationImmutableError(id, from, to)   → 409
├── ContrabandNotFoundError(id)                 → 404
├── ContrabandAlreadySeizedError(id)            → 409
├── RaidNotFoundError(id)                       → 404
├── RaidImmutableError(id, from, to)            → 409
├── RaidAlreadyActiveError(propertyId)          → 409
└── BlackMarketTransactionNotFoundError(id)     → 404
```

**Response envelope for errors:**

```json
{
  "error": {
    "code": "GangAlreadyExistsError",
    "message": "Gang with tag 'VAG' already exists.",
    "status": 409
  }
}
```

---

## 6. State Machines

### Operation State Machine

```
              create
                │
                ▼
           ┌─────────┐
           │planning │──────────────────────────┐
           └────┬────┘                          │
                │ start()                       │ abort()
                ▼                               │
           ┌────────┐                           │
           │ active │──────────┐                │
           └───┬────┘          │                │
               │               │ fail()         │ abort()
               │ complete()    │                │
               ▼               ▼                ▼
          ┌─────────┐    ┌────────┐       ┌─────────┐
          │completed│    │ failed │       │ aborted │
          └─────────┘    └────────┘       └─────────┘
           (terminal)    (terminal)        (terminal)
```

Any attempt to transition from a terminal state, or to make an invalid hop (e.g. `planning` → `completed`), throws `GangOperationImmutableError`.

---

### Raid State Machine

```
              stage()
                │
                ▼
           ┌─────────┐
           │ staging │──────────────────┐
           └────┬────┘                  │
                │ start()               │ abort()
                ▼                       │
           ┌────────┐                   │
           │ active │──────────┐        │
           └───┬────┘          │        │
               │ complete()    │        │ abort()
               ▼               ▼        ▼
          ┌─────────┐       ┌──────────────┐
          │completed│       │   aborted    │
          └─────────┘       └──────────────┘
           (terminal)          (terminal)
```

Concurrent `start()` calls for raids on the same `property_id` are serialized by `FOR UPDATE` on the property check. The second caller receives `RaidAlreadyActiveError (409)`.

---

## 7. API Routes

Base path: `/api/v1/criminal`

All routes require a valid session token. Write operations require the capability listed.

### Gangs

| Method | Path | Capability | Description |
|---|---|---|---|
| `POST` | `/gangs` | `criminal:gang:manage` | Create a gang |
| `GET` | `/gangs/:gangId` | `criminal:gang:read` | Get gang by ID |
| `GET` | `/gangs?tag=<tag>` | `criminal:gang:read` | List gangs by tag |
| `POST` | `/gangs/:gangId/members` | `criminal:gang:manage` | Add member to gang |
| `DELETE` | `/gangs/:gangId/members/:principalId` | `criminal:gang:manage` | Remove member from gang |

### Operations

| Method | Path | Capability | Description |
|---|---|---|---|
| `POST` | `/operations` | `criminal:operation:manage` | Create operation |
| `POST` | `/operations/:operationId/start` | `criminal:operation:manage` | Start operation |
| `POST` | `/operations/:operationId/complete` | `criminal:operation:manage` | Complete operation |
| `POST` | `/operations/:operationId/abort` | `criminal:operation:manage` | Abort operation |

### Contraband

| Method | Path | Capability | Description |
|---|---|---|---|
| `POST` | `/contraband` | `criminal:contraband:manage` | Register contraband |
| `POST` | `/contraband/:contrabandId/seize` | `criminal:contraband:seize` | Seize contraband |

### Black Market

| Method | Path | Capability | Description |
|---|---|---|---|
| `POST` | `/trade` | `criminal:trade:record` | Record a black market trade |

### Raids

| Method | Path | Capability | Description |
|---|---|---|---|
| `POST` | `/raids` | `criminal:raid:manage` | Stage a raid |
| `POST` | `/raids/:raidId/start` | `criminal:raid:manage` | Start a raid |
| `POST` | `/raids/:raidId/complete` | `criminal:raid:manage` | Complete a raid |
| `POST` | `/raids/:raidId/abort` | `criminal:raid:manage` | Abort a raid |

**Total routes:** 16

---

## 8. EventBus Events

All events are emitted on the internal `EventBus` and follow the `atc:{domain}:{noun}:{verb}` pattern.

| Event | Payload | Emitter |
|---|---|---|
| `atc:criminal:gang:created` | `{ gangId, name, tag }` | `CriminalRuntimeService` |
| `atc:criminal:gang:disbanded` | `{ gangId }` | `CriminalRuntimeService` |
| `atc:criminal:gang:member:joined` | `{ gangId, principalId, rank }` | `CriminalRuntimeService` |
| `atc:criminal:gang:member:left` | `{ gangId, principalId }` | `CriminalRuntimeService` |
| `atc:criminal:operation:started` | `{ operationId, gangId }` | `GangOperationService` |
| `atc:criminal:operation:completed` | `{ operationId, outcome }` | `GangOperationService` |
| `atc:criminal:operation:aborted` | `{ operationId }` | `GangOperationService` |
| `atc:criminal:contraband:registered` | `{ contrabandId, itemName }` | `ContrabandService` |
| `atc:criminal:contraband:seized` | `{ contrabandId, seizedByPrincipalId }` | `ContrabandService` |
| `atc:criminal:raid:started` | `{ raidId, propertyId, leadPrincipalId }` | `RaidRuntimeService` |
| `atc:criminal:raid:completed` | `{ raidId, outcome }` | `RaidRuntimeService` |
| `atc:criminal:black_market:trade` | `{ transactionId, itemName, quantity }` | `BlackMarketService` |

**Note:** Use `EventBus.emit()` for all internal TS-side events. Never use `TriggerEvent` (server→server) for cross-service communication.

---

## 9. FiveM Bridge

**File:** `game/atc-core/server/criminal.lua`
**SDK namespace:** `ATC.Criminal`

### Exposed SDK Functions

| Function | Underlying service call |
|---|---|
| `ATC.Criminal.CreateGang(name, tag, leaderSrc)` | `CriminalRuntimeService.createGang` |
| `ATC.Criminal.AddMember(gangId, principalId, rank)` | `CriminalRuntimeService.addMember` |
| `ATC.Criminal.RemoveMember(gangId, principalId)` | `CriminalRuntimeService.removeMember` |
| `ATC.Criminal.StartOperation(operationId)` | `GangOperationService.start` |
| `ATC.Criminal.CompleteOperation(operationId, outcome)` | `GangOperationService.complete` |
| `ATC.Criminal.AbortOperation(operationId)` | `GangOperationService.abort` |
| `ATC.Criminal.RegisterContraband(data)` | `ContrabandService.register` |
| `ATC.Criminal.SeizeContraband(contrabandId, seizedBySrc)` | `ContrabandService.seize` |
| `ATC.Criminal.RecordTrade(seller, buyer, item, qty, price)` | `IllegalTradeService` → `BlackMarketService` |
| `ATC.Criminal.StageRaid(propertyId, leadSrc, ...)` | `RaidRuntimeService.stage` |
| `ATC.Criminal.StartRaid(raidId)` | `RaidRuntimeService.start` |
| `ATC.Criminal.CompleteRaid(raidId, outcome)` | `RaidRuntimeService.complete` |
| `ATC.Criminal.AbortRaid(raidId)` | `RaidRuntimeService.abort` |

### Registered Server Events

| Event | Purpose |
|---|---|
| `atc:criminal:operation:start:request` | Client requests an operation start; server validates and calls `GangOperationService.start` |
| `atc:criminal:contraband:register:request` | Client reports found contraband; server validates and calls `ContrabandService.register` |
| `atc:criminal:contraband:seize:request` | Client seizes contraband; server resolves source to principalId and calls `ContrabandService.seize` |

### Participant Resolution

When building or updating the `participants` array for raids, the bridge iterates over each participant `source` (player server ID) and resolves it to `principalId` **server-side** using `ATC.SDK.Player.Get(source).id`. Client-supplied `principalId` values are never accepted directly.

---

## 10. Concurrency & Data Integrity

| Scenario | Protection mechanism |
|---|---|
| Two adds of the same member to a gang | `UNIQUE KEY uq_active_member(gang_id, principal_id, left_at)` at DB + `FOR UPDATE` on gang row |
| Race on `member_count` increment/decrement | `FOR UPDATE` on `atc_gangs` row during `addMember` / `removeMember` |
| Two concurrent operation state transitions | `FOR UPDATE` on `atc_criminal_operations` row |
| Two raids started on same property concurrently | `FOR UPDATE` on `property_id` check in `RaidRuntimeService.start()` |
| Duplicate gang tag | `UNIQUE KEY uq_tag(tag)` in `atc_gangs`; service catches and throws `GangAlreadyExistsError` |
| Double seizure of contraband | Service reads status before update; throws `ContrabandAlreadySeizedError` if already `seized` |

### Append-Only Guarantees

- `atc_gang_members`: members are never deleted; departure is recorded as `left_at = NOW()`
- `atc_criminal_operations`: operations are never deleted; terminal states are irreversible
- `atc_black_market_transactions`: no UPDATE or DELETE is ever issued; full audit trail of all trades
- `atc_raids`: raid rows are never deleted; outcomes are permanent

---

## 11. Security Checklist

- [x] No client-trusted values in server logic — participant principal IDs resolved server-side in the FiveM bridge
- [x] All write endpoints require a named capability (`criminal:*:manage`, `criminal:*:seize`, etc.)
- [x] Rate limiting applied to all registered server events
- [x] Input validated with Zod schemas at the API layer
- [x] Contraband seizure audit trail: `seized_by_principal_id` + `seized_at` persisted permanently
- [x] Raids audit trail: `lead_principal_id` + `participants` (server-resolved) + `outcome` persisted permanently
- [x] Black market trades: both `seller_principal_id` and `buyer_principal_id` required; self-trade rejected by `IllegalTradeService`
- [x] No direct DB access outside the repository layer in `packages/db`
- [x] No hardcoded strings or credentials
- [x] Sensitive operations (seizure, raid completion) logged to audit log

---

## 12. Observability

### Key Log Points

| Service | Event | Level |
|---|---|---|
| `CriminalRuntimeService` | Gang created / disbanded | `info` |
| `CriminalRuntimeService` | Member joined / left | `info` |
| `GangOperationService` | Operation state transition | `info` |
| `GangOperationService` | Illegal state transition attempted | `warn` |
| `ContrabandService` | Contraband seized | `info` |
| `ContrabandService` | Double seizure attempt | `warn` |
| `RaidRuntimeService` | Raid started / completed | `info` |
| `RaidRuntimeService` | Concurrent raid conflict on property | `warn` |
| `BlackMarketService` | Trade recorded | `info` |

### Metrics to Monitor

| Metric | Alert threshold |
|---|---|
| `RaidAlreadyActiveError` rate | > 5/min on the same `propertyId` (possible exploit attempt) |
| `GangMemberAlreadyActiveError` rate | > 10/min (possible replay attack on member add event) |
| `ContrabandAlreadySeizedError` rate | > 5/min (possible exploit attempt on seizure) |
| `GangOperationImmutableError` rate | > 10/min (possible replay or client tampering) |
| DB lock wait time on `atc_raids` | > 500ms average |

---

## 13. Operational Procedures

### 13.1 Applying Migrations

```bash
# Apply all pending migrations in order
pnpm --filter @atc/db migrate:latest

# Verify migrations ran
pnpm --filter @atc/db migrate:status
```

Migrations 080–085 must be applied before deploying Phase 33 API or FiveM resources. They are non-destructive and safe to apply on a live database.

### 13.2 Rolling Back a Migration

Migrations 080–085 do not have automatic down migrations. To roll back manually:

1. Stop the API server and FiveM resource `[atc]`.
2. Rename or drop tables in reverse order: `atc_raids`, `atc_black_market_transactions`, `atc_contraband`, `atc_criminal_operations`, `atc_gang_members`, `atc_gangs`.
3. Remove the migration records from the migrations table.
4. Redeploy previous build.

> **Warning:** Rolling back destroys all criminal runtime data. Take a full DB backup before any rollback.

### 13.3 Manually Disband a Gang (Ops)

If a gang must be force-disbanded outside normal gameplay:

```sql
-- Verify gang exists
SELECT id, name, tag, status FROM atc_gangs WHERE id = '<gangId>';

-- Set all active members left_at
UPDATE atc_gang_members SET left_at = NOW() WHERE gang_id = '<gangId>' AND left_at IS NULL;

-- Disband the gang
UPDATE atc_gangs SET status = 'disbanded', member_count = 0, updated_at = NOW() WHERE id = '<gangId>';
```

Then emit `atc:criminal:gang:disbanded` via the EventBus if downstream consumers need to react.

### 13.4 Manually Abort a Stuck Operation

If an operation is stuck in `active` and cannot be advanced via normal gameplay:

```sql
UPDATE atc_criminal_operations
SET status = 'aborted', ended_at = NOW(), outcome = 'admin_abort', updated_at = NOW()
WHERE id = '<operationId>' AND status IN ('planning', 'active');
```

### 13.5 Manually Abort a Stuck Raid

If a raid is stuck in `active` state (e.g. server crash mid-raid):

```sql
UPDATE atc_raids
SET status = 'aborted', outcome = 'aborted', ended_at = NOW(), updated_at = NOW()
WHERE id = '<raidId>' AND status = 'active';
```

This unblocks the `RaidAlreadyActiveError` check for subsequent raids on the same property.

### 13.6 Auditing a Property's Raid History

```sql
SELECT id, lead_principal_id, status, outcome, started_at, ended_at
FROM atc_raids
WHERE property_id = '<propertyId>'
ORDER BY created_at DESC;
```

### 13.7 Auditing Black Market Trades

```sql
SELECT id, seller_principal_id, buyer_principal_id, item_name, quantity, price, completed_at
FROM atc_black_market_transactions
WHERE seller_principal_id = '<principalId>'
   OR buyer_principal_id  = '<principalId>'
ORDER BY created_at DESC
LIMIT 100;
```

---

## 14. Agent Scope Boundary

**Agent 1** owns everything in this runbook:

- `@atc/criminal-runtime` package and all six services
- Migrations 080–085
- API routes in `apps/api/src/routes/criminal.ts`
- FiveM bridge at `game/atc-core/server/criminal.lua`

**Agent 2** owns downstream analysis and intelligence layers that consume EventBus events from this package:

- Criminal intelligence correlation
- Gang network graph
- Operation analytics dashboards
- Territory control dashboards
- MDT criminal records

Agent 2 must not write to any `atc_gangs`, `atc_gang_members`, `atc_criminal_operations`, `atc_contraband`, `atc_black_market_transactions`, or `atc_raids` tables directly. It must consume `atc:criminal:*` events from the EventBus only.

---

## 15. Testing

**Test file:** `packages/tests/src/criminal-runtime.test.ts`

### Coverage Requirements

| Area | Minimum coverage |
|---|---|
| `CriminalRuntimeService` | All CRUD paths, `GangAlreadyExistsError`, `GangMemberAlreadyActiveError` |
| `GangOperationService` | All valid transitions, all invalid transitions → `GangOperationImmutableError` |
| `ContrabandService` | Register, seize, double-seize → `ContrabandAlreadySeizedError` |
| `BlackMarketService` | Record trade, get transaction, not-found |
| `IllegalTradeService` | Self-trade rejection, zero quantity rejection |
| `RaidRuntimeService` | Full lifecycle, concurrent raid conflict → `RaidAlreadyActiveError` |
| API routes | Happy path + each 4xx error response |

### Running Tests

```bash
pnpm --filter @atc/tests test -- --testPathPattern=criminal-runtime
```

### Integration Test Prerequisites

- MariaDB 11.x running with migrations 080–085 applied
- Redis 7.x available
- `.env.test` populated with `DATABASE_URL` and `REDIS_URL`
