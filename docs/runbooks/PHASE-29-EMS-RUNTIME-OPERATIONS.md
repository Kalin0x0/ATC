# Phase 29 — EMS Runtime Operations & Emergency Coordination

## Overview

Phase 29 delivers the operational EMS runtime: emergency lifecycle management, triage, ambulance dispatch, hospital capacity, and revive workflows. All state is authoritative server-side; no client value is trusted.

---

## Package: `@atc/ems-runtime`

Location: `packages/ems-runtime/`

### Key Files

| File | Purpose |
|---|---|
| `src/pool.ts` | Duck-typed `EmsPool` interface for DB connections |
| `src/id.ts` | `generateId()` — monotonic ULID factory |
| `src/errors.ts` | 11 typed error classes extending `EmsError` |
| `src/emergency.repository.ts` | Emergency CRUD + state machine |
| `src/ambulance.repository.ts` | Ambulance unit management |
| `src/hospital-capacity.repository.ts` | Bed inventory |
| `src/revive-audit.repository.ts` | Append-only revive history |
| `src/triage.service.ts` | Triage scoring and category assignment |
| `src/ambulance-dispatch.service.ts` | Ambulance dispatch + event emission |
| `src/hospital-capacity.service.ts` | Bed availability + facility suggestion |
| `src/medical-escalation.service.ts` | Auto-escalation for critical patients |
| `src/revive-workflow.service.ts` | Cooldown-enforced revive with audit |
| `src/emergency-runtime.service.ts` | Main orchestrator — all EMS operations |
| `src/index.ts` | Barrel exports |

---

## Emergency State Machine

```
reported → triaged → responders_assigned → en_route → on_scene → stabilized → transported → admitted → closed
    ↘                       ↘                 ↘                    ↘              ↘             ↘
   closed                  closed            stabilized           closed         closed        closed
```

All transitions are enforced by `ALLOWED_TRANSITIONS` in `EmergencyRepository`. Attempts to make invalid transitions throw `EmergencyImmutableError` (HTTP 422). Closed emergencies throw `EmergencyClosedError` (HTTP 422).

---

## Triage Categories

| Category | Description | HTTP Priority |
|---|---|---|
| `red` | Immediate — life-threatening | Highest |
| `yellow` | Delayed — serious but stable | High |
| `green` | Minor — walking wounded | Medium |
| `black` | Expectant — deceased or unsurvivable | Lowest |

`TriageService.assign()` auto-assigns based on severity and vital indicators (cardiac arrest always → red, fatal severity → black).

---

## Concurrency Design

### Emergency state transitions
All writes use `BEGIN` + `SELECT ... FOR UPDATE` + `UPDATE` + `COMMIT`. Rollbacks on any error. Two concurrent callers racing on the same emergency ID will serialize via row-level locking.

### Ambulance dispatch
Uses an atomic conditional UPDATE:
```sql
UPDATE atc_ems_ambulances
SET status = 'dispatched', emergency_id = ?
WHERE unit_id = ? AND status = 'available'
```
`affectedRows === 0` → throws `AmbulanceUnavailableError` (HTTP 409). No explicit transaction needed.

### Hospital bed admission
Uses an atomic conditional decrement:
```sql
UPDATE atc_ems_hospital_capacity
SET available_beds = available_beds - 1
WHERE facility_id = ? AND available_beds > 0
```
`affectedRows === 0` → throws `HospitalAtCapacityError` (HTTP 409). Safe against concurrent admissions.

---

## Revive Workflow

1. Check cooldown: `SELECT ... WHERE revived_at > DATE_SUB(NOW(3), INTERVAL 300 SECOND)` — throws `ReviveCooldownError` (HTTP 429) if found.
2. Delegate to `MedicalService.revive()` (duck-typed `RevivableService` interface).
3. Record to `atc_ems_revive_audit` (append-only).
4. Emit `REVIVE_COMPLETED` event (fire-and-forget).

Default cooldown: `DEFAULT_REVIVE_COOLDOWN_SECONDS = 300` (5 minutes).

---

## API Routes

All routes under `/api/v1/ems/`. Bearer token auth on all routes (except `/health`).

| Method | Path | Capability | Description |
|---|---|---|---|
| `POST` | `/ems/emergencies` | `ems.write` | Create emergency |
| `GET` | `/ems/emergencies/active` | `ems.read` | List active emergencies |
| `GET` | `/ems/emergencies/:id` | `ems.read` | Get single emergency |
| `POST` | `/ems/emergencies/:id/triage` | `ems.triage` | Triage patient |
| `POST` | `/ems/emergencies/:id/assign` | `ems.dispatch` | Assign ambulance unit |
| `POST` | `/ems/emergencies/:id/stabilize` | `ems.write` | Mark patient stabilized |
| `POST` | `/ems/emergencies/:id/transport` | `ems.write` | Transport to hospital |
| `POST` | `/ems/emergencies/:id/close` | `ems.write` | Close emergency |
| `GET` | `/ems/hospitals/capacity` | `ems.read` | Hospital bed inventory |
| `GET` | `/ems/responders/active` | `ems.read` | Active responders |

### Error HTTP Codes

| Condition | Code |
|---|---|
| Validation failure | 400 |
| Not found | 404 |
| Ambulance/hospital conflict | 409 |
| Invalid state transition | 422 |
| Revive cooldown active | 429 |
| EMS runtime not configured | 503 |

---

## Database Migrations

| Migration | Table | Purpose |
|---|---|---|
| `059_create_ems_emergencies.sql` | `atc_ems_emergencies` | Core emergency records |
| `060_create_ems_emergency_audit.sql` | `atc_ems_emergency_audit` | Append-only state transition log |
| `061_create_ems_ambulances.sql` | `atc_ems_ambulances` | Ambulance unit registry |
| `062_create_ems_hospital_capacity.sql` | `atc_ems_hospital_capacity` | Per-facility bed counts |
| `063_create_ems_revive_audit.sql` | `atc_ems_revive_audit` | Revive history for cooldown enforcement |

---

## EventBus Events

| Event Constant | Key | Emitted When |
|---|---|---|
| `ATC_EMS_EVENTS.EMS_DISPATCHED` | `atc:ems:dispatched` | Ambulance unit dispatched |
| `ATC_EMS_EVENTS.PATIENT_STABILIZED` | `atc:ems:patient:stabilized` | Emergency marked stabilized |
| `ATC_EMS_EVENTS.PATIENT_TRANSPORTED` | `atc:ems:patient:transported` | Patient transported to hospital |
| `ATC_EMS_EVENTS.REVIVE_COMPLETED` | `atc:ems:revive:completed` | Revive workflow succeeded |
| `ATC_EMS_EVENTS.HOSPITAL_ADMITTED` | `atc:ems:hospital:admitted` | Patient admitted to hospital |
| `ATC_EMS_EVENTS.EMERGENCY_ESCALATED` | `atc:ems:escalated` | Patient escalated (red triage) |

All events are fire-and-forget (`.catch(() => undefined)`). Event bus absence is not an error.

---

## FiveM Bridge

File: `game/atc-core/server/ems_runtime.lua`

```lua
-- Create an emergency (server-authoritative)
ATC.EMS.CreateEmergency(source, characterId, opts, cb)

-- Triage a patient
ATC.EMS.TriageEmergency(source, emergencyId, category, opts, cb)

-- Assign ambulance unit to emergency
ATC.EMS.AssignResponder(source, emergencyId, responderId, opts, cb)

-- Mark patient stabilized
ATC.EMS.StabilizeEmergency(source, emergencyId, opts, cb)

-- Transport patient to hospital
ATC.EMS.TransportPatient(source, emergencyId, facilityId, opts, cb)

-- Close a resolved emergency
ATC.EMS.CloseEmergency(source, emergencyId, resolution, opts, cb)

-- Revive a deceased character (enforces cooldown)
ATC.EMS.Revive(source, characterId, opts, cb)

-- Hospital capacity (all facilities)
ATC.EMS.GetHospitalCapacity(cb)

-- Active emergencies
ATC.EMS.ListActiveEmergencies(cb)

-- Active responders
ATC.EMS.ListActiveResponders(cb)
```

Server events registered:
- `atc:ems:emergency:request` — client requests dispatch
- `atc:ems:stabilize:request` — medic marks patient stabilized
- `atc:ems:revive:request` — medic performs revive

All principal IDs resolved via `ATC.Accounts.GetPrincipalId(source)` server-side. Client-supplied identity is never used.

---

## AppContext Wiring

New optional fields added to `AppContext`:

```typescript
emsRuntimeService?: EmergencyRuntimeService
emsEmergencyRepo?: EmergencyRepository
emsAmbulanceRepo?: AmbulanceRepository
emsHospitalCapacityRepo?: HospitalCapacityRepository
emsReviveWorkflow?: ReviveWorkflowService
```

To enable EMS at startup, populate these fields in the app's bootstrap file.

---

## Operational Runbook

### Clearing a stuck ambulance unit

If an ambulance is stuck in `dispatched` state after a server restart:

```sql
UPDATE atc_ems_ambulances
SET status = 'available', emergency_id = NULL, updated_at = NOW(3)
WHERE unit_id = 'AMB-01' AND status = 'dispatched';
```

### Manual emergency close (admin only)

```sql
UPDATE atc_ems_emergencies
SET status = 'closed', closed_at = NOW(3), updated_at = NOW(3)
WHERE id = '<emergency-id>';

INSERT INTO atc_ems_emergency_audit
  (id, emergency_id, action, from_status, to_status, principal_id, notes, metadata, created_at)
VALUES (UUID(), '<emergency-id>', 'manual_close', '<prev-status>', 'closed', 'system', 'admin manual close', '{}', NOW(3));
```

### Reset hospital capacity after data error

```sql
UPDATE atc_ems_hospital_capacity
SET available_beds = total_beds, is_overflow = 0, updated_at = NOW(3)
WHERE facility_id = 'hospital-main';
```

### Check revive cooldown for a character

```sql
SELECT * FROM atc_ems_revive_audit
WHERE character_id = '<char-id>'
  AND revived_at > DATE_SUB(NOW(3), INTERVAL 300 SECOND)
ORDER BY revived_at DESC
LIMIT 1;
```

---

## Security Checklist

- [x] No client-trusted values — all principal IDs resolved server-side via `ATC.Accounts.GetPrincipalId(source)`
- [x] All write routes gated by IAM capability checks (`ems.write`, `ems.triage`, `ems.dispatch`)
- [x] Input validated with Zod schemas before any service call
- [x] Concurrent write races prevented via `FOR UPDATE` and atomic SQL conditionals
- [x] Revive cooldown prevents abuse — 5-minute window per character
- [x] Append-only audit tables — no update or delete on emergency_audit or revive_audit
- [x] Immutable closed emergencies — `EmergencyClosedError` on all mutation attempts
- [x] Stack traces never returned to clients — all 5xx use generic message

---

## Agent Scope Boundary

Phase 29 (Agent 1) owns:
- EMS operational runtime, lifecycle, triage, dispatch, capacity, revive
- `packages/ems-runtime/`
- API routes `/api/v1/ems/*`
- FiveM bridge `game/atc-core/server/ems_runtime.lua`
- DB migrations 059–063

Phase 29 (Agent 2) owns:
- EMS analytics, reporting, intelligence projections
- MDT enrichment with EMS data
- Read-model correlation and aggregation

Do NOT add analytics engines, reporting dashboards, or investigative systems to `@atc/ems-runtime`.
