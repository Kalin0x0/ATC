# Phase 24 — Government, Law & Enforcement Foundation

## Overview

Adds the persistent backend foundation for the government, law enforcement, and legal system domains.
No gameplay mechanics, UI, or AI — only durable, server-authoritative data structures.

---

## What Was Built

### Database Migrations (040–046)

| File | Table | Notes |
|---|---|---|
| 040 | `atc_agencies` | Agency registry, slug UNIQUE |
| 041 | `atc_warrants` | Warrant lifecycle, FK → agencies |
| 042 | `atc_citations` | Citations/fines, idempotency_key UNIQUE |
| 043 | `atc_arrest_records` | Append-only, no updated_at |
| 044 | `atc_jail_records` | Active jail state, FOR UPDATE prevents duplicates |
| 045 | `atc_evidence_records` | SHA-256 content hash, chain_of_custody_json |
| 046 | `atc_legal_cases` | Case lifecycle, FK → agencies |

### `@atc/shared-types` additions (`src/law.ts`)

New types: `AtcAgency`, `AtcWarrant`, `AtcCitation`, `AtcArrestRecord`, `AtcJailRecord`,
`AtcEvidenceRecord`, `AtcCustodyEntry`, `AtcLegalCase`, and `ATC_LAW_EVENTS`.

### `@atc/law` package (`packages/law/`)

| File | Responsibility |
|---|---|
| `pool.ts` | `LawPool` interface (duck-typed, no circular dep on `@atc/db`) |
| `id.ts` | Monotonic ULID generator via `ulidx` |
| `errors.ts` | 14 error classes extending `LawError` |
| `agency.repository.ts` | CRUD + list + deactivate |
| `warrant.repository.ts` | Create + executeWarrant + expireWarrant + revokeWarrant + list |
| `citation.repository.ts` | Create (idempotent) + markPaid + list |
| `arrest.repository.ts` | Append-only create + list |
| `jail.repository.ts` | Enter (FOR UPDATE lock) + release + findActive |
| `evidence.repository.ts` | Collect (SHA-256 hash) + transferCustody (chain append) + list |
| `legal-case.repository.ts` | Create + close + archive + list |
| `law-enforcement.service.ts` | Orchestrates all repos + ledger payments + event emission |
| `sdk.ts` | `AtcLawSDK` thin wrapper |
| `index.ts` | Exports everything |

### `@atc/operations` additions

17 new Zod schemas for all law API input validation (Phase 24 section at end of `schemas.ts`).

### API Routes (`apps/api/src/routes/law.ts`)

All routes under `/api/v1/law/`:

| Method | Path | Capability |
|---|---|---|
| GET | `/agencies` | `law.read` |
| POST | `/agencies` | `law.write` |
| DELETE | `/agencies/:agencyId` | `law.write` |
| GET | `/warrants` | `law.read` |
| GET | `/warrants/:warrantId` | `law.read` |
| POST | `/warrants` | `warrant.issue` |
| POST | `/warrants/:warrantId/execute` | `warrant.issue` |
| POST | `/warrants/:warrantId/expire` | `warrant.issue` |
| POST | `/warrants/:warrantId/revoke` | `warrant.issue` |
| GET | `/citations` | `law.read` |
| GET | `/citations/:citationId` | `law.read` |
| POST | `/citations` | `citation.issue` |
| POST | `/citations/:citationId/pay` | `citation.issue` |
| GET | `/arrests` | `law.read` |
| GET | `/arrests/:arrestId` | `law.read` |
| POST | `/arrests` | `arrest.execute` |
| GET | `/jail/character/:characterId` | `law.read` |
| POST | `/jail` | `jail.manage` |
| POST | `/jail/:jailRecordId/release` | `jail.manage` |
| GET | `/evidence` | `evidence.manage` |
| GET | `/evidence/:evidenceId` | `evidence.manage` |
| POST | `/evidence` | `evidence.manage` |
| POST | `/evidence/:evidenceId/transfer-custody` | `evidence.manage` |
| GET | `/cases` | `law.read` |
| GET | `/cases/:caseId` | `law.read` |
| POST | `/cases` | `law.write` |
| POST | `/cases/:caseId/close` | `law.write` |
| POST | `/cases/:caseId/archive` | `law.write` |

### FiveM Bridge (`game/atc-core/server/law.lua`)

Server-side only. Exposes: `ATC.Law.GetWarrants`, `ATC.Law.IssueWarrant`,
`ATC.Law.IssueCitation`, `ATC.Law.RecordArrest`, `ATC.Law.GetJailState`,
`ATC.Law.EnterJail`, `ATC.Law.ReleaseFromJail`.

All officer principal IDs are resolved server-side — clients cannot inject them.

---

## Required Capabilities

| Capability | What it gates |
|---|---|
| `law.read` | Reading agencies, warrants, citations, arrests, cases |
| `law.write` | Creating/modifying agencies and cases |
| `warrant.issue` | Issuing, executing, expiring, revoking warrants |
| `citation.issue` | Issuing citations and processing citation payments |
| `arrest.execute` | Recording arrests |
| `jail.manage` | Entering and releasing from jail |
| `evidence.manage` | Collecting evidence and transferring custody |

---

## Security Properties

- **Server-authoritative jail state** — `FOR UPDATE` row lock prevents double-entry during concurrent arrest flows
- **Ledger-backed citation payments** — payment goes through `LedgerService.transfer`, creating a balanced journal before the citation is marked paid
- **Append-only arrest records** — no `updated_at`, no UPDATE path; records are immutable once written
- **Immutable evidence hash** — `content_hash` is a SHA-256 hex digest computed at collection time; never updated
- **Chain of custody append-only** — custody entries are pushed onto a JSON array; old entries are never removed
- **Idempotent citation creation** — `idempotency_key` UNIQUE constraint with ER_DUP_ENTRY replay
- **Officer identity server-resolved** — the FiveM bridge calls `ATC.Accounts.GetPrincipalId(source)` server-side; clients cannot inject a principal ID

---

## Data Integrity Notes

- Warrant transitions: `active → executed | expired | revoked` only. Throws `WarrantImmutableError` if already terminal.
- Citation payment is a saga: ledger journal committed first (idempotent by `citation:pay:{id}` key), then citation marked paid. Safe to retry on transient failures.
- Jail entry uses `BEGIN → SELECT FOR UPDATE → INSERT → COMMIT`. A concurrent enter for the same character will either wait (if the first transaction holds the lock) or find the active row and throw `JailAlreadyActiveError`.

---

## How to Initialize

```typescript
import { createPool } from '@atc/db'
import { LedgerService } from '@atc/ledger'
import {
  AgencyRepository, WarrantRepository, CitationRepository,
  ArrestRepository, JailRepository, EvidenceRepository,
  LegalCaseRepository, LawEnforcementService, AtcLawSDK,
} from '@atc/law'

const pool = createPool(config.db)
const ledger = new LedgerService(pool)

const agencies  = new AgencyRepository(pool)
const warrants  = new WarrantRepository(pool)
const citations = new CitationRepository(pool)
const arrests   = new ArrestRepository(pool)
const jail      = new JailRepository(pool)
const evidence  = new EvidenceRepository(pool)
const cases     = new LegalCaseRepository(pool)

const lawService = new LawEnforcementService({
  agencies, warrants, citations, arrests, jail, evidence, cases,
  ledger, eventBus, telemetry,
})

// Wire into AppContext
ctx.lawService      = lawService
ctx.lawAgencyRepo   = agencies
ctx.lawWarrantRepo  = warrants
ctx.lawCitationRepo = citations
ctx.lawArrestRepo   = arrests
ctx.lawJailRepo     = jail
ctx.lawEvidenceRepo = evidence
ctx.lawCaseRepo     = cases
```

---

## What Is NOT Included (By Design)

- No MDT / dispatch UI
- No combat, weapons, or pursuits
- No AI police or automated enforcement
- No prison gameplay
- No evidence analysis / mini-games
- No vehicle chase mechanics

These are Phase 25+ concerns.

---

## Tests

`packages/tests/src/law.test.ts` — 20 test scenarios covering:

- Agency CRUD and slug conflict idempotency
- Warrant lifecycle (create, execute, revoke, immutability guard)
- Citation idempotency replay and payment
- Jail concurrent entry prevention and release
- Evidence SHA-256 hash correctness and chain-of-custody appending
- Legal case creation and status transitions
- `LawEnforcementService` event emission and ledger integration
