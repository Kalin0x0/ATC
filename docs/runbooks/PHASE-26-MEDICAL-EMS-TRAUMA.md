# Phase 26 — EMS, Medical & Trauma Foundation

## Scope

Backend medical infrastructure for ATC. Provides persistent injury tracking, trauma state machine, EMS treatment records, immutable medical reports, hospital admission management, and revive authorization.

**Not included:** combat gameplay, weapon systems, death screen UI, NUI/HUD, animation systems, ragdoll, voice systems, AI doctors, insurance gameplay.

---

## Architecture

### Package: `packages/medical`

| File | Responsibility |
|---|---|
| `pool.ts` | Duck-typed `MedicalPool` interface — avoids @atc/db circular dependency |
| `id.ts` | ULID generator via `monotonicFactory` |
| `errors.ts` | 11 typed error classes |
| `injury.repository.ts` | Injury CRUD + paginated list |
| `trauma.repository.ts` | Trauma state machine with `FOR UPDATE` locking |
| `treatment.repository.ts` | Append-only treatment records |
| `medical-report.repository.ts` | Immutable-after-close medical reports |
| `hospital.repository.ts` | Hospital admission + status transitions |
| `medical.service.ts` | Orchestration layer: events + vitals bridge |
| `sdk.ts` | `AtcMedicalSDK` — delegate wrapper |
| `index.ts` | Barrel exports |

### Trauma State Machine

```
stable ──────────────────────────────────────────────────────►bleeding
stable ──────────────────────────────────────────────────────►unconscious
stable ──────────────────────────────────────────────────────►cardiac_arrest
stable ──────────────────────────────────────────────────────►fractured
stable ──────────────────────────────────────────────────────►pain_shock
stable ──────────────────────────────────────────────────────►deceased
bleeding ────────────────────────────────────────────────────►unconscious
bleeding ────────────────────────────────────────────────────►cardiac_arrest
bleeding ────────────────────────────────────────────────────►stabilized
bleeding ────────────────────────────────────────────────────►deceased
unconscious ─────────────────────────────────────────────────►cardiac_arrest
unconscious ─────────────────────────────────────────────────►stabilized
unconscious ─────────────────────────────────────────────────►deceased
cardiac_arrest ──────────────────────────────────────────────►stabilized
cardiac_arrest ──────────────────────────────────────────────►deceased
fractured ───────────────────────────────────────────────────►stable
fractured ───────────────────────────────────────────────────►stabilized
fractured ───────────────────────────────────────────────────►pain_shock
pain_shock ──────────────────────────────────────────────────►stable
pain_shock ──────────────────────────────────────────────────►stabilized
pain_shock ──────────────────────────────────────────────────►unconscious
stabilized ──────────────────────────────────────────────────►stable
stabilized ──────────────────────────────────────────────────►deceased
deceased ────────────────────────────────────────────────────►stable   (revive only)
```

---

## Database Migrations

| # | File | Table |
|---|---|---|
| 051 | `051_create_injuries.sql` | `atc_injuries` |
| 052 | `052_create_trauma_states.sql` | `atc_trauma_states` |
| 053 | `053_create_treatment_records.sql` | `atc_treatment_records` |
| 054 | `054_create_medical_reports.sql` | `atc_medical_reports` |
| 055 | `055_create_hospital_states.sql` | `atc_hospital_states` |

Run migrations: `pnpm -F @atc/api db:migrate`

---

## API Routes

Base path: `/api/v1/medical/`

| Method | Path | Capability | Description |
|---|---|---|---|
| POST | `/injuries` | `medical.write` | Record an injury |
| GET | `/injuries` | `medical.read` | List injuries (paginated) |
| GET | `/injuries/:id` | `medical.read` | Get injury by ID |
| GET | `/trauma/:characterId` | `medical.read` | Get current trauma state |
| PATCH | `/trauma/:characterId` | `medical.write` | Transition trauma state |
| POST | `/revive/:characterId` | `ems.revive` | Revive a deceased patient |
| POST | `/treatments` | `medical.write` | Apply a treatment |
| GET | `/treatments/character/:characterId` | `medical.read` | List character's treatments |
| POST | `/reports` | `medical.write` | Create medical report |
| GET | `/reports` | `medical.read` | List reports (paginated) |
| GET | `/reports/:id` | `medical.read` | Get report by ID |
| POST | `/reports/:id/close` | `medical.write` | Close (immute) report |
| POST | `/hospital/admit` | `hospital.manage` | Admit character |
| GET | `/hospital/character/:characterId` | `medical.read` | Get active admission |
| PATCH | `/hospital/:id/status` | `hospital.manage` | Update admission status |

---

## Capabilities

| Capability | Description |
|---|---|
| `medical.read` | View injuries, trauma, treatments, reports |
| `medical.write` | Record injuries, apply treatments, create/close reports, update trauma |
| `medical.manage` | Full medical administration |
| `ems.revive` | Revive a deceased patient (audited) |
| `hospital.manage` | Admit and manage hospital records |

---

## Events Emitted (`ATC_MEDICAL_EVENTS`)

| Event | Trigger |
|---|---|
| `atc:medical:injury:recorded` | New injury recorded |
| `atc:medical:trauma:escalated` | Trauma state changed (non-deceased non-stable) |
| `atc:medical:player:revived` | Patient revived from deceased |
| `atc:medical:treatment:applied` | Treatment record created |
| `atc:medical:report:created` | Medical report created |
| `atc:medical:patient:stabilized` | Trauma → stabilized or stable |
| `atc:medical:patient:deceased` | Trauma → deceased |

All events are fire-and-forget (`.catch(() => undefined)`).

---

## Vitals Integration

`MedicalService` accepts an optional `MedicalVitalsBridge`:

```typescript
interface MedicalVitalsBridge {
  patch(characterId: string, patch: Partial<Record<'health' | 'stamina' | 'stress', number>>): Promise<unknown>
}
```

Automatic vitals patches:
- `deceased` → `{ health: 0, stamina: 0 }`
- `cardiac_arrest` → `{ health: 5, stamina: 0, stress: 100 }`
- `revive` → `{ health: 50, stamina: 30, stress: 20 }`

---

## FiveM Bridge

`game/atc-core/server/medical.lua` exposes:

```lua
ATC.Medical.RecordInjury(source, characterId, region, severity, description, incidentId?)
ATC.Medical.GetTrauma(characterId)
ATC.Medical.UpdateTrauma(source, characterId, newState, notes?)
ATC.Medical.RevivePatient(source, characterId, incidentId?, notes?)
ATC.Medical.ApplyTreatment(source, characterId, treatmentType, opts?)
ATC.Medical.CreateReport(source, characterId, diagnosis, opts?)
ATC.Medical.AdmitToHospital(source, characterId, opts?)
ATC.Medical.GetHospitalRecord(characterId)
ATC.Medical.UpdateHospitalStatus(source, recordId, newStatus, notes?)
```

All `source` parameters resolve to a principal ID via `ATC.Accounts.GetPrincipalId(source)` server-side.

---

## Business Rules

1. **Trauma immutability**: Transitions that are not in `ALLOWED_TRANSITIONS` throw `TraumaImmutableError`.
2. **Revive gating**: The `deceased → stable` path is only reachable via the `/revive/:characterId` endpoint which requires the `ems.revive` capability. All other transitions go through `/trauma/:characterId` with `medical.write`.
3. **Report immutability**: Once `closed_at` is set, the report cannot be modified. `close()` throws `MedicalReportClosedError` if already closed.
4. **Treatment records**: Append-only — no `updated_at` column.
5. **Hospital uniqueness**: A character can only have one non-discharged/deceased hospital record at a time. `admit()` throws `HospitalAlreadyAdmittedError` on conflict.
6. **Concurrent trauma updates**: `transition()` uses `FOR UPDATE` row locking within a transaction to prevent race conditions.
7. **Trauma creation idempotency**: `getOrCreate()` handles `ER_DUP_ENTRY` from the `UNIQUE KEY uq_trauma_character` by re-reading the existing row.

---

## Testing

```bash
pnpm -F @atc/tests test
```

Test file: `packages/tests/src/medical.test.ts`

Coverage: 20 scenarios across all 5 repositories, MedicalService, and Zod schema validation.

---

## Operational Checklist

- [ ] Run migrations 051–055 against staging
- [ ] Verify `ems.revive` capability assigned to EMS supervisor role
- [ ] Verify `hospital.manage` capability assigned to hospital staff role
- [ ] Confirm vitals bridge wired in API server startup if vitals system is active
- [ ] Confirm event bus wired — check `atc:medical:*` events appear in event log
- [ ] Test revive flow end-to-end: set deceased → attempt revive without ems.revive (expect 403) → attempt with ems.revive (expect 200)
