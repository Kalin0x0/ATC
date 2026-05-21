# PHASE-36: Banking & Market Runtime — Operations Runbook

> **Package:** `@atc/market-runtime`
> **Scope:** Agent 1 (runtime writes only — see boundary section)
> **Tables:** 097–102
> **Status:** Production

---

## Overview

`@atc/market-runtime` owns all player-facing financial write paths: bank transfers,
marketplace purchases, auction settlement, tax collection, and fraud flagging. It is
distinct from `@atc/ledger` (accounting read-model) and `@atc/commerce` (shop/vendor
flows). All monetary values are stored and processed as `BIGINT` (bigint in TypeScript).

---

## Architecture

### Services

| Service | Responsibility |
|---|---|
| `BankingRuntimeService` | Account management, transfers, freezes |
| `MarketplaceService` | Listing creation, purchase, expiry |
| `AuctionRuntimeService` | Auction lifecycle, bidding, settlement |
| `TaxationRuntimeService` | Tax record creation and collection |
| `FinancialFraudService` | Real-time flag emission on threshold breach |

### Repositories

| Repository | Table | Migration |
|---|---|---|
| `BankAccountRepository` | `atc_bank_accounts` | 097 |
| `BankTransactionRepository` | `atc_bank_transactions` | 098 |
| `MarketListingRepository` | `atc_market_listings` | 099 |
| `MarketAuctionRepository` | `atc_market_auctions` | 100 |
| `TaxRecordRepository` | `atc_tax_records` | 101 |
| `FinancialFlagRepository` | `atc_financial_flags` | 102 |

### Dependency Chain

```
FiveM Client
    └─ ATC.Market (Lua bridge: game/atc-core/server/market.lua)
           └─ ATC SDK (server Lua)
                  └─ @atc/market-runtime API  (/api/v1/market/*)
                         ├─ BankingRuntimeService
                         ├─ MarketplaceService
                         ├─ AuctionRuntimeService
                         ├─ TaxationRuntimeService
                         └─ FinancialFraudService
                                └─ MariaDB 11.x + Redis 7.x
```

---

## State Machines

### Bank Transaction

```
pending ──► completed
        ──► failed
        ──► reversed
```

Transitions are final. A `completed` transaction may produce a new `reversed`
transaction — the original record is never mutated.

### Market Listing

```
active ──► sold
       ──► cancelled
       ──► expired
```

Expiry is evaluated at purchase-time (not via background sweep). Expired listings
reject purchase attempts with `ListingExpiredError`.

### Auction

```
active ──► completed   (reserve met, highest bidder wins)
       ──► no_sale     (reserve not met at settlement)
       ──► cancelled   (seller cancels before first bid)
```

### Tax Record

```
pending ──► collected
        ──► waived
        ──► disputed
```

`disputed` status is set externally by admin action — not by this runtime.

---

## Key Invariants

1. **Non-negative balances** — `NegativeBalanceError` is raised before any UPDATE if
   debit would take balance below zero. The guard runs inside the same transaction as
   the lock, not before it.

2. **Idempotent transfers** — Each `BankTransfer` carries a caller-supplied
   `idempotencyKey`. `ER_DUP_ENTRY` on `atc_bank_transactions.idempotency_key`
   surfaces as `DuplicateTransactionError`; callers treat this as success-already-applied.

3. **Idempotent listings** — `createListing` accepts a `listing_nonce`. Duplicate
   nonce returns the existing listing row without error.

4. **5% market tax** — Applied automatically on both `purchaseListing` and
   `settleAuction`. Tax record written in the same DB transaction as the transfer.
   Rate is a named constant `MARKET_TAX_RATE = 0.05` — never inline.

5. **Freeze guard** — `BankingRuntimeService` rejects all debits on a frozen account
   before acquiring any lock. Check is non-transactional (Redis flag) for speed;
   the authoritative freeze flag is on `atc_bank_accounts.is_frozen`.

6. **Fraud auto-flag thresholds:**
   - `suspicious_transfer`: single transfer amount `> 500_000n`
   - `large_withdrawal`: single transfer amount `> 1_000_000n`
   Both flags are raised by `FinancialFraudService.autoCheckTransfer()` after a
   completed transfer. Flag creation is fire-and-forget (non-blocking to caller).

---

## Concurrency Model

### Deadlock Prevention

Bank transfers always acquire `FOR UPDATE` row locks in ascending `account_id` order
(lower ID first, higher ID second), regardless of which is debited or credited.
Violating this order risks deadlock under concurrent transfers involving the same
account pair.

```
-- Correct acquisition order (pseudocode)
LOCK MIN(fromId, toId) FOR UPDATE
LOCK MAX(fromId, toId) FOR UPDATE
```

### Listing Purchase

1. `SELECT … FOR UPDATE` on the listing row.
2. Assert `status = 'active'` and `expires_at > NOW()`.
3. Execute bank transfer (acquires account locks in canonical order).
4. Write tax record.
5. Update listing `status = 'sold'`.
6. Commit.

### Auction Bid

1. `SELECT … FOR UPDATE` on the auction row.
2. Assert `status = 'active'`.
3. Assert `bidAmount > currentBid + minimumBidIncrement`.
4. Update `current_bid`, `current_bidder_id`.
5. Commit.

### Auction Settlement

1. `SELECT … FOR UPDATE` on the auction row via `complete()`.
2. If `currentBid >= reservePrice`: transfer proceeds minus 5% tax to seller → `completed`.
3. Else: `no_sale`, no transfer.

---

## EventBus Integration

All events follow `atc:{domain}:{noun}:{verb}` pattern. Events are emitted **after**
the DB transaction commits.

| Event | Trigger |
|---|---|
| `atc:market:bank:transfer:completed` | Successful bank transfer |
| `atc:market:bank:account:frozen` | Account freeze applied |
| `atc:market:bank:account:unfrozen` | Account unfreeze applied |
| `atc:market:listing:created` | New listing persisted |
| `atc:market:listing:sold` | Listing purchased |
| `atc:market:auction:created` | New auction persisted |
| `atc:market:auction:completed` | Auction settled (reserve met) |
| `atc:market:tax:collected` | Tax record marked collected |
| `atc:market:fraud:flag:raised` | Fraud flag written to `atc_financial_flags` |

Events are published via the internal Event Bus (`@atc/events`). Do not use
`TriggerEvent` for cross-service notification.

---

## API Surface

Base path: `/api/v1/market`

| Method | Path | Handler |
|---|---|---|
| `POST` | `/bank/transfer` | `BankingRuntimeService.transfer()` |
| `POST` | `/bank/accounts/:id/freeze` | `BankingRuntimeService.freeze()` |
| `POST` | `/bank/accounts/:id/unfreeze` | `BankingRuntimeService.unfreeze()` |
| `POST` | `/listings` | `MarketplaceService.createListing()` |
| `POST` | `/listings/:id/purchase` | `MarketplaceService.purchaseListing()` |
| `DELETE` | `/listings/:id` | `MarketplaceService.cancelListing()` |
| `POST` | `/auctions` | `AuctionRuntimeService.createAuction()` |
| `POST` | `/auctions/:id/bid` | `AuctionRuntimeService.placeBid()` |
| `POST` | `/auctions/:id/settle` | `AuctionRuntimeService.settleAuction()` |
| `POST` | `/tax/collect/:recordId` | `TaxationRuntimeService.collect()` |

All routes require server-side identity (no client-sourced amounts are trusted).
Input validated with Zod schemas before reaching service layer.

---

## FiveM Bridge

**File:** `game/atc-core/server/market.lua`
**Namespace:** `ATC.Market`

```lua
-- Available bridge calls (server-side Lua only)
ATC.Market.Transfer(fromAccountId, toAccountId, amount, idempotencyKey)
ATC.Market.FreezeAccount(accountId)
ATC.Market.UnfreezeAccount(accountId)
ATC.Market.CreateListing(listingPayload)
ATC.Market.PurchaseListing(listingId, buyerAccountId)
ATC.Market.CreateAuction(auctionPayload)
ATC.Market.PlaceBid(auctionId, bidderAccountId, bidAmount)
ATC.Market.SettleAuction(auctionId)
```

Bridge translates Lua calls to HTTP requests against `/api/v1/market/*`. Never call
the API directly from client-side Lua. All values entering the bridge are re-validated
server-side.

---

## Diagnostics

### Common Errors

| Error Class | Cause | Resolution |
|---|---|---|
| `NegativeBalanceError` | Insufficient funds before debit | Client UI should pre-check balance; server is authoritative |
| `DuplicateTransactionError` | Repeated idempotency key | Treat as success; return original transaction record |
| `ListingExpiredError` | Purchase attempted on expired listing | Refresh listing state in UI |
| `AccountFrozenError` | Debit on frozen account | Admin must unfreeze via `/bank/accounts/:id/unfreeze` |
| `AuctionBidTooLowError` | Bid does not exceed current + increment | Client should re-fetch current bid before retry |

### Key Queries

```sql
-- Check account balance and freeze status
SELECT id, player_id, balance, is_frozen FROM atc_bank_accounts WHERE id = ?;

-- Recent transactions for an account
SELECT * FROM atc_bank_transactions
WHERE from_account_id = ? OR to_account_id = ?
ORDER BY created_at DESC LIMIT 50;

-- Active listings approaching expiry
SELECT id, seller_id, price, expires_at FROM atc_market_listings
WHERE status = 'active' AND expires_at < DATE_ADD(NOW(), INTERVAL 1 HOUR);

-- Open fraud flags
SELECT * FROM atc_financial_flags
WHERE resolved_at IS NULL ORDER BY created_at DESC;

-- Pending tax records
SELECT * FROM atc_tax_records WHERE status = 'pending' ORDER BY created_at ASC;
```

### Redis Keys

| Key Pattern | Purpose |
|---|---|
| `atc:bank:account:{id}:frozen` | Fast freeze check (TTL-less; cleared on unfreeze) |
| `atc:market:listing:{id}:lock` | Optimistic concurrency guard (short TTL) |

### Health Checks

- DB connection pool: monitor `atc_bank_transactions` write latency p99 < 50ms.
- Fraud flag queue depth: alert if `atc_financial_flags` unresolved count > 500.
- Auction settlement: confirm cron or trigger fires within 60s of `expires_at`.

---

## Agent Scope Boundary

**This runbook covers Agent 1 scope only:**

- All write paths (transfers, listings, bids, settlement, tax collection, flag creation)
- State machine transitions
- Idempotency and concurrency guarantees

**Out of scope for this package (Agent 2 territory):**

- Fraud analytics dashboards
- Pattern detection engines (velocity checks, network graph analysis)
- Financial reporting and audit exports
- MDT integration
- Read-side projections and CQRS query models
- Admin review UI for financial flags
