# Phase 23 — Jobs, Professions & Work Contracts

**Status:** Complete  
**Date:** 2026-05-17  
**Scope:** Foundation layer for employment, work sessions, and payroll

---

## Overview

Phase 23 introduces the jobs domain to ATC. It provides:

- A **job registry** (job definitions + grade tiers)
- **Employment contracts** (character ↔ job/organization binding)
- **Work sessions** (clock-in / clock-out with duration tracking)
- **Payroll** (preview + commit with full ledger backing)
- **FiveM bridge** (server-authoritative Lua API)
- **REST API** (16 endpoints with capability-gated access)

This phase deliberately excludes gameplay systems (missions, crafting, vehicles, housing, gangs, NPC AI, UI/NUI). It is a pure data + authorization foundation.

---

## Architecture

```
ATC.Jobs.* (Lua bridge)  →  POST /api/v1/work-sessions/*
                          →  GET  /api/v1/jobs/*
                          →  GET  /api/v1/employment/*
                                        ↓
                              JobRepository / WorkSessionRepository
                              EmploymentContractRepository
                              PayrollService → LedgerService
                                        ↓
                              MariaDB (atc_jobs, atc_employment_contracts,
                                       atc_work_sessions, atc_payroll_runs)
```

---

## Database Migrations

| Migration | Table | Key Constraints |
|-----------|-------|-----------------|
| 034 | `atc_jobs` | `slug UNIQUE`, `type IN (...)`, `status IN (...)` |
| 035 | `atc_job_grades` | `UNIQUE(job_id, slug)`, `salary_amount >= 0` |
| 036 | `atc_professions` | `UNIQUE(character_id, job_id)`, xp/level >= 0/1 |
| 037 | `atc_employment_contracts` | `status IN (...)`, `salary_amount >= 0`, compound index on (character_id, organization_id) |
| 038 | `atc_work_sessions` | `status IN (...)`, `duration_seconds >= 0` |
| 039 | `atc_payroll_runs` + `atc_payroll_run_entries` | `UNIQUE(idempotency_key)`, `period_end > period_start`, ON DELETE CASCADE |

Run migrations in order: `034 → 035 → 036 → 037 → 038 → 039`

---

## API Endpoints

### Jobs

| Method | Path | Capability | Description |
|--------|------|------------|-------------|
| GET | `/api/v1/jobs` | `jobs.read` | List jobs (paginated) |
| POST | `/api/v1/jobs` | `jobs.write` | Create job |
| PATCH | `/api/v1/jobs/:jobId` | `jobs.write` | Update job |
| GET | `/api/v1/jobs/:jobId/grades` | `jobs.read` | List grades for job |
| POST | `/api/v1/jobs/:jobId/grades` | `jobs.write` | Create grade |

### Employment

| Method | Path | Capability | Description |
|--------|------|------------|-------------|
| GET | `/api/v1/employment/character/:characterId` | `jobs.read` | List contracts for character |
| POST | `/api/v1/employment/contracts` | `jobs.assign` | Create employment contract |
| PATCH | `/api/v1/employment/contracts/:contractId/terminate` | `jobs.manage` | Terminate contract |

### Work Sessions

| Method | Path | Capability | Description |
|--------|------|------------|-------------|
| POST | `/api/v1/work-sessions/clock-in` | `jobs.write` | Clock in to active contract |
| POST | `/api/v1/work-sessions/clock-out` | `jobs.write` | Clock out from active session |
| GET | `/api/v1/work-sessions/character/:characterId` | `jobs.read` | List sessions for character |

### Payroll

| Method | Path | Capability | Description |
|--------|------|------------|-------------|
| POST | `/api/v1/payroll/preview` | `payroll.run` | Create payroll preview (no money moves) |
| POST | `/api/v1/payroll/commit` | `payroll.run` | Commit payroll (ledger journal created) |
| GET | `/api/v1/payroll/runs/:runId` | `payroll.run` | Fetch payroll run by ID |

---

## Capabilities Added

Five new capabilities registered in `ATC_CAPABILITIES` and `AtcPluginCapability`:

| Capability | Purpose |
|------------|---------|
| `jobs.read` | Read job definitions, grades, contracts, sessions |
| `jobs.write` | Create/update jobs, grades; clock in/out |
| `jobs.assign` | Create employment contracts |
| `jobs.manage` | Terminate contracts |
| `payroll.run` | Preview and commit payroll runs |

IAM trust level limits updated: `internal` gets all 5, `trusted` gets `jobs.read` only.

---

## Security Design

### Server Authority
- Character IDs are **always resolved server-side** in the FiveM bridge via `ATC.Characters.GetSelectedId(source)`
- Clients cannot self-assign jobs — the bridge validates `contractId` server-side before forwarding
- All clock-in requests carry server-resolved `characterId`

### Race Condition Protection
- **Contract creation** uses `FOR UPDATE` to lock any existing active contract row before inserting
- **Clock-in** uses `FOR UPDATE` to lock any existing active session row before inserting
- Both use `BEGIN / COMMIT / ROLLBACK` atomic transactions

### Payroll Ledger Backing
- Payroll commit calls `LedgerService.commit()` (standalone, system-sourced)
- `source: 'system'` is used — `'payroll'` is not a valid JournalSource
- No direct wallet mutation — all salary movement is ledger-backed
- Organization permissions are not bypassed — org account IDs must be supplied by authorized caller

### Idempotency
- Payroll preview: idempotent on `idempotency_key` (returns existing run if found)
- Payroll commit: idempotent on `status = 'completed'` (returns existing result, does not re-commit)

---

## FiveM Bridge (`game/atc-core/server/jobs.lua`)

```lua
-- Safe usage examples (server-side only):

-- List available jobs
ATC.Jobs.GetJobs(function(ok, page, err)
    if ok then print(#page.items .. ' jobs found') end
end)

-- Get character employment
ATC.Jobs.GetEmployment(source, function(ok, page, err)
    if ok then print(page.total .. ' contracts') end
end)

-- Clock in (contractId must come from server-side lookup)
ATC.Jobs.ClockIn(source, contractId, jobId, function(ok, session, err)
    if not ok then
        TriggerClientEvent('atc:jobs:clock_in_failed', source, err)
    end
end)

-- Clock out
ATC.Jobs.ClockOut(source, function(ok, session, err)
    if ok then
        TriggerClientEvent('atc:jobs:clocked_out', source, session)
    end
end)
```

**NEVER** pass `characterId` from a client event into these functions. Always use `ATC.Characters.GetSelectedId(source)`.

---

## Events Emitted

| Event | When |
|-------|------|
| `atc:job:created` | New job definition persisted |
| `atc:employment:contract_created` | New contract created |
| `atc:employment:contract_terminated` | Contract terminated |
| `atc:work:clocked_in` | Work session opened |
| `atc:work:clocked_out` | Work session completed |
| `atc:payroll:completed` | Payroll journal committed |
| `atc:payroll:failed` | Payroll commit failed (ledger error) |

---

## Telemetry Counters

| Counter | Incremented when |
|---------|-----------------|
| `payroll.runs_total` | Payroll committed successfully |
| `payroll.failed_total` | Payroll commit failed |

---

## Error Reference

| Error Class | HTTP Status | Trigger |
|-------------|-------------|---------|
| `JobsValidationError` | 400 | Input validation failure |
| `JobSlugConflictError` | 409 | Duplicate job slug |
| `JobGradeSlugConflictError` | 409 | Duplicate grade slug on job |
| `ContractAlreadyActiveError` | 409 | Character already has active contract |
| `AlreadyClockedInError` | 409 | Character already has active session |
| `JobNotFoundError` | 404 | Job ID not found |
| `JobGradeNotFoundError` | 404 | Grade ID not found |
| `ContractNotFoundError` | 404 | Contract ID not found |
| `WorkSessionNotFoundError` | 404 | Session ID not found |
| `PayrollRunNotFoundError` | 404 | Payroll run ID not found |
| `NotClockedInError` | 422 | Clock-out with no active session |
| `ContractNotActiveError` | 422 | Operation on non-active contract |
| `ContractImmutableError` | 422 | Modifying terminated contract |
| `PayrollAlreadyCommittedError` | 422 | Committing failed payroll run |

---

## Operational Runbook

### Deploy Checklist
1. Run migrations 034–039 in order
2. Verify `@atc/jobs` package is built (`pnpm turbo build --filter=@atc/jobs`)
3. Verify API server includes jobs routes (registered in `server.ts`)
4. Confirm capability grants: assign `jobs.write` to game server service principal, `payroll.run` to admin/operator principal
5. Confirm `orgAccountId` and `payrollAccountId` are provisioned in the ledger before running payroll

### Payroll Workflow
```
1. POST /api/v1/payroll/preview  { organizationId, periodStart, periodEnd, currency, idempotencyKey }
   → Returns run in 'preview' status with entry breakdown

2. Verify entries (employee count, amounts, currency)

3. POST /api/v1/payroll/commit   { runId, orgAccountId, payrollAccountId }
   → Debits org account, credits payroll clearing account
   → Run transitions to 'completed'

4. Distribute individual salary payments from payroll clearing account (Phase 24+)
```

### Troubleshooting

**Payroll run stuck in 'preview'**: Call `/api/v1/payroll/commit` with valid org/payroll account IDs.

**Payroll run in 'failed' status**: The ledger call failed. Investigate ledger health. Create a new preview run with a new idempotency key and retry commit.

**ContractAlreadyActiveError**: Character already employed in this job at this organization. Terminate existing contract first.

**AlreadyClockedInError**: Character has an open work session. Clock them out first (admin: use clock-out API directly with server-side characterId).

---

## Explicitly Out of Scope

This phase does NOT include:
- Police / EMS / emergency services gameplay
- Delivery missions or harvesting jobs
- Crafting or skill-based progression
- NPC job AI or job center UI
- Vehicles, housing, or gang systems
- Marketplace or item-linked jobs
- Per-character salary distribution (Phase 24+)
- Work session hour computation for payroll (Phase 24+)
