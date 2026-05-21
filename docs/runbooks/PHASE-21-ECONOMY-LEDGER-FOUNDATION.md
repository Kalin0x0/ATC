# Phase 21 — Economy Core & Financial Ledger Foundation

## Overview

Phase 21 adds the double-entry financial ledger, organization platform, and invoice engine to ATC. This is **infrastructure only** — no shops, jobs, missions, crafting, or gameplay economy systems.

## Packages Added

| Package | Path | Purpose |
|---|---|---|
| `@atc/ledger` | `packages/ledger/` | Double-entry journal engine, account management |
| `@atc/organization` | `packages/organization/` | Organizations, members, invoices |

## DB Migrations (022–028)

Run via `pnpm db:migrate` in `apps/api`:

| Migration | Table | Description |
|---|---|---|
| 022 | `atc_financial_accounts` | Ledger accounts (cash, bank, treasury, escrow, system) |
| 023 | `atc_financial_journals` | Journal headers with idempotency_key UNIQUE |
| 024 | `atc_financial_entries` | Double-entry lines (FK → journals, FK → accounts) |
| 025 | `atc_organizations` | Organizations with UNIQUE name slug |
| 026 | `atc_organization_members` | Member assignments with role + optional expiry |
| 027 | `atc_invoices` | Invoices between parties (characters, orgs) |
| 028 | `atc_invoice_payments` | Payment records linked to journals |

## Architecture

### Double-Entry Invariant

Every `commit()` call MUST satisfy:

```
sum(debit amounts) == sum(credit amounts)
```

Validated using **integer arithmetic** to avoid floating-point errors:

```typescript
const units = Math.round(amount * 10000)  // 4 decimal places
```

### Deadlock Prevention

Accounts are locked in **sorted ID order** before any balance mutation:

```sql
SELECT id, balance FROM atc_financial_accounts
WHERE id IN (sorted_ids...) FOR UPDATE
```

Always sorting prevents circular lock dependencies between concurrent transactions.

### Idempotency

The `idempotency_key` column on `atc_financial_journals` has a UNIQUE constraint. Before inserting, `LedgerService.commit()` checks if the key already exists and returns the existing journal if so. This makes all money operations safe to retry.

### System Accounts

Accounts with `account_type = 'system'` are exempt from the non-negative balance check. This allows "minting" currency from a system source account.

## New Capabilities (AtcPluginCapability)

Phase 21 adds 5 new capabilities (total: 25):

- `economy.read` — read financial account balances and journal history
- `economy.write` — execute transfers and commits
- `organization.manage` — create/manage organizations and members
- `invoice.issue` — issue invoices
- `invoice.pay` — pay invoices

## New Economy Events (ATC_ECONOMY_EVENTS)

```typescript
TRANSFER_COMPLETED: 'atc:economy:transfer:completed'
INVOICE_ISSUED:     'atc:economy:invoice:issued'
INVOICE_PAID:       'atc:economy:invoice:paid'
ACCOUNT_FROZEN:     'atc:economy:account:frozen'
ORGANIZATION_CREATED: 'atc:economy:organization:created'
```

## API Endpoints (12 new)

All under `/api/v1/economy/`. All require `Authorization: Bearer <token>`.

### Financial Accounts

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/economy/accounts` | Create a financial account |
| `GET` | `/api/v1/economy/accounts` | List accounts (paginated) |
| `GET` | `/api/v1/economy/accounts/:id` | Get account by ID |
| `PATCH` | `/api/v1/economy/accounts/:id` | Update account status (freeze/unfreeze/close) |

### Journals & Transfers

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/economy/transfer` | Convenience: debit A, credit B |
| `POST` | `/api/v1/economy/journals` | Commit a raw multi-leg journal |
| `GET` | `/api/v1/economy/journals` | List journals (paginated) |
| `GET` | `/api/v1/economy/journals/:id` | Get journal with entries |
| `POST` | `/api/v1/economy/journals/:id/reverse` | Reverse a committed journal |

### Organizations

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/economy/organizations` | Create organization |
| `GET` | `/api/v1/economy/organizations/:id` | Get organization |
| `POST` | `/api/v1/economy/organizations/:id/members` | Add/update member |
| `DELETE` | `/api/v1/economy/organizations/:id/members/:characterId` | Remove member |

### Invoices

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/economy/invoices` | Issue an invoice |
| `GET` | `/api/v1/economy/invoices` | List invoices (paginated) |
| `POST` | `/api/v1/economy/invoices/:id/pay` | Pay an invoice (atomic: transfer + mark paid) |

## Wiring in AppContext

```typescript
import { LedgerPool } from '@atc/ledger'
import { LedgerService, AccountRepository } from '@atc/ledger'
import { OrganizationRepository, MemberRepository, InvoiceRepository } from '@atc/organization'

// The pool must satisfy LedgerPool / OrganizationPool (duck-typed — mysql2 Pool works)
const pool = ctx.pool  // from @atc/db

const ledger = new LedgerService(pool, ctx.telemetry)
const financialAccounts = new AccountRepository(pool, ctx.telemetry)
const organizations = new OrganizationRepository(pool, ctx.telemetry)
const members = new MemberRepository(pool, ctx.telemetry)
const invoices = new InvoiceRepository(pool, ctx.telemetry)

// Add to AppContext:
const appCtx: AppContext = {
  ...existingCtx,
  ledger,
  financialAccounts,
  organizations,
  members,
  invoices,
}
```

## Error Handling

`LedgerError` subclasses and HTTP status codes:

| Error | Status | Meaning |
|---|---|---|
| `LedgerImbalanceError` | 400 | `sum(debits) ≠ sum(credits)` |
| `LedgerAccountNotFoundError` | 404 | Account ID does not exist |
| `LedgerJournalNotFoundError` | 404 | Journal ID does not exist |
| `LedgerInsufficientFundsError` | 422 | Balance would go negative |
| `LedgerAccountFrozenError` | 422 | Account is frozen or closed |
| `LedgerReversalError` | 422 | Journal not in `committed` state |
| `LedgerIdempotencyConflictError` | — | Never thrown (idempotency returns existing) |

## Telemetry Metrics (New)

| Metric | Incremented When |
|---|---|
| `economy.accounts_created_total` | Financial account created |
| `economy.journals_committed_total` | Journal committed successfully |
| `economy.journals_reversed_total` | Journal reversed |
| `economy.organizations_created_total` | Organization created |
| `economy.members_added_total` | Member added/updated |
| `economy.invoices_issued_total` | Invoice issued |
| `economy.invoices_paid_total` | Invoice marked paid |

## FiveM Bridge

`game/atc-core/server/economy.lua` gains two new sub-namespaces:

```lua
-- Ledger (double-entry)
ATC.Economy.Ledger.Transfer(fromId, toId, amount, currency, description, idempKey, cb)
ATC.Economy.Ledger.GetAccount(accountId, cb)

-- Organizations
ATC.Economy.Org.Get(orgId, cb)
ATC.Economy.Org.GetMembers(orgId, cb)
```

The existing wallet API (`ATC.Economy.Credit`, `ATC.Economy.Debit`, `ATC.Economy.Transfer`) is **unchanged** — full backwards compatibility.

## Security Invariants

- No client can trigger balance mutations. All money paths are server-side Lua or API-gated.
- All ledger operations go through `LedgerService` — no direct `UPDATE atc_financial_accounts SET balance = ?` outside the ledger engine.
- Every balance change is recorded in a journal with entries. Audit trail is permanent.
- System account balances can go negative (minting); all other accounts are enforced non-negative at application level.
- Idempotency keys prevent double-spend on network retries.
- Row-level locking in sorted ID order prevents deadlocks.

## Phase 21 Hardening (applied post-initial implementation)

### Bugs Fixed

| # | Severity | Location | Description |
|---|---|---|---|
| 1 | CRITICAL | `ledger.service.ts:commit()` | Double-release of pool connection when idempotency key exists — removed manual `conn.release()` in idempotency branch, `finally` block now exclusively owns cleanup |
| 2 | CRITICAL | `ledger.service.ts:reverse()` | Same double-release bug on idempotency replay path |
| 3 | CRITICAL | `routes/economy.ts` | All 15 economy routes were accessible to any authenticated bearer token — added `requireCapability` preHandler to every route |
| 4 | CRITICAL | `routes/economy.ts:POST /invoices/:id/pay` | Caller-controlled `idempotencyKey` allowed two concurrent requests with different keys to both transfer money for the same invoice — replaced with canonical server-side key `invoice-payment:{invoiceId}` |
| 5 | HIGH | `ledger.service.ts:_validateBalance()` | Zero, negative, and non-finite amounts were not validated at the service layer — now throws `LedgerValidationError` |
| 6 | HIGH | `ledger.service.ts:_validateBalance()` | Per-currency balance not enforced — 100 USD debit + 100 EUR credit passed. Now validates `sum(debits[currency]) == sum(credits[currency])` independently per currency |
| 7 | HIGH | `ledger.service.ts:_commitInTx()` | `AccountRow` missing `currency` field; no validation that entry currency matched account currency — added `LedgerCurrencyMismatchError` |
| 8 | HIGH | `ledger.service.ts:reverse()` | `_validateBalance()` not called before `_commitInTx()` — reversal of corrupt stored entries would bypass all validation |
| 9 | HIGH | `ledger.service.ts:transfer()` | Same-account transfers (fromId == toId) produced a no-op journal that passed validation — now throws `LedgerValidationError` |
| 10 | HIGH | `ledger.service.ts` | Amounts exceeding 1 billion could cause `Math.round(amount * 10000)` to silently overflow past `Number.MAX_SAFE_INTEGER` — enforced `MAX_AMOUNT = 1_000_000_000` |
| 11 | MEDIUM | `routes/economy.ts:POST /invoices/:id/pay` | Invoice already-paid returned 422 instead of 409 Conflict |
| 12 | MEDIUM | `routes/economy.ts:POST /invoices/:id/pay` | `markPaid()` returning null (concurrent double-pay race winner) returned untyped error — now explicitly returns 409 |
| 13 | MEDIUM | `routes/economy.ts` | `ATC_ECONOMY_EVENTS` defined but never emitted — all write operations now fire-and-forget `ctx.eventBus.emit(...)` |
| 14 | LOW | `schemas.ts:transferSchema` | API-level: no `.refine()` blocking `fromAccountId == toAccountId` — added |
| 15 | LOW | `schemas.ts:payInvoiceSchema` | `idempotencyKey` was a caller-supplied field on pay invoice — removed (server now derives canonical key) |

### New Error Classes

| Class | HTTP Status | When Thrown |
|---|---|---|
| `LedgerValidationError` | 400 | Empty entries, zero/negative/infinite amount, amount > 1 billion, same-account transfer |
| `LedgerCurrencyMismatchError` | 400 | Entry currency does not match the account's declared currency |

### Capability Authorization Map

| Route | Required Capability |
|---|---|
| `POST /economy/accounts` | `economy.write` |
| `GET /economy/accounts` | `economy.read` |
| `GET /economy/accounts/:id` | `economy.read` |
| `PATCH /economy/accounts/:id` | `economy.write` |
| `POST /economy/transfer` | `economy.write` |
| `POST /economy/journals` | `economy.write` |
| `GET /economy/journals` | `economy.read` |
| `GET /economy/journals/:id` | `economy.read` |
| `POST /economy/journals/:id/reverse` | `economy.write` |
| `POST /economy/organizations` | `organization.manage` |
| `GET /economy/organizations/:id` | `economy.read` |
| `POST /economy/organizations/:id/members` | `organization.manage` |
| `DELETE /economy/organizations/:id/members/:characterId` | `organization.manage` |
| `POST /economy/invoices` | `invoice.issue` |
| `GET /economy/invoices` | `economy.read` |
| `POST /economy/invoices/:id/pay` | `invoice.pay` |

## Tests

- `packages/tests/src/ledger.test.ts` — 37 unit tests (28 original + 9 hardening) covering LedgerService and AccountRepository
- `packages/tests/src/organization.test.ts` — 18 unit tests covering OrganizationRepository, MemberRepository, InvoiceRepository

All 1,296 tests pass (typecheck clean, build clean).

## Known Limitations (Deferred to Future Phases)

- No currency conversion or exchange rates
- No recurring invoices or subscription billing
- No player-facing wallet integration (existing wallet system remains separate)
- No organization treasury auto-deduction
- No overdraft protection per account (only global non-negative enforcement)
- No automated invoice overdue detection (cron job deferred)
