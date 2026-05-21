# Phase 22 — Commerce Hardening Report

**Date:** 2026-05-17  
**Status:** Complete  
**Scope:** Audit and hardening of CommerceService transaction pipeline, API routes, schema validation

---

## 1. Audit Summary

Eight bugs were identified across the commerce system. All are fixed. No new features were added.

| # | Severity | Area | Bug | Status |
|---|---|---|---|---|
| 1 | CRITICAL | Events | ORDER_FAILED emitted on idempotency replay fetch failure | Fixed |
| 2 | HIGH | API Routes | ORDER_CREATED event wrongly emitted on shop creation | Fixed |
| 3 | HIGH | Service | `calculateTotals()` silently returns 0 for sell with null `sell_price` | Fixed |
| 4 | HIGH | Service | No `idempotencyKey` empty/length validation at service level | Fixed |
| 5 | MEDIUM | Locking | Inner slot SELECT in `_addInventoryItemInTx` missing `FOR UPDATE` | Fixed |
| 6 | MEDIUM | Safety | Non-null `!` assertions on tax rule lookups | Fixed |
| 7 | LOW | Schema | `listShopsQuerySchema` missing `limit`/`offset` pagination params | Fixed |
| 8 | LOW | Validation | `calculateTotals()` public method accepts `quantity < 1` | Fixed |

---

## 2. Bug Details and Fixes

### Bug 1 — CRITICAL: ORDER_FAILED on replay fetch failure

**File:** `packages/commerce/src/commerce.service.ts`

**Problem:** When an idempotency key was detected inside the TX (`existingRows[0]` present), the code rolled back and called `_fetchExistingTransaction`. If that fetch failed (transient DB error), control fell into the `catch` block which always emitted `ORDER_FAILED`. The original purchase had succeeded — emitting `ORDER_FAILED` was wrong.

**Fix:** Added `let isReplay = false` before the try block. Set `isReplay = true` immediately before rollback when replay is detected. In the catch block, gated `ORDER_FAILED` on `if (!isReplay)`. Applied to both `purchase()` and `sell()`.

---

### Bug 2 — HIGH: Wrong event on shop creation

**File:** `apps/api/src/routes/commerce.ts`

**Problem:** The POST `/api/v1/commerce/shops` handler emitted `ATC_COMMERCE_EVENTS.ORDER_CREATED` on shop creation. `ORDER_CREATED` is an order lifecycle event, not a shop lifecycle event. No shop-creation event exists in the domain model; this was noise at best and misleading at worst.

**Fix:** Removed the event emission entirely. Removed the now-unused `ATC_COMMERCE_EVENTS` import.

---

### Bug 3 — HIGH: Silent zero totals for sell with null sell_price

**File:** `packages/commerce/src/commerce.service.ts` (`calculateTotals` public method)

**Problem:** When `orderType === 'sell'` and `si_sell_price` was `null`, the expression `shopRow.si_sell_price !== null ? parseFloat(...) : 0` returned 0 silently. Preview calls would show a ¤0 sell price instead of a clear error that the shop does not buy this item.

**Fix:** Added an explicit null check before the ternary. When `orderType === 'sell'` and `si_sell_price === null`, throw `CommerceShopCannotBuyError`.

---

### Bug 4 — HIGH: No service-level idempotencyKey validation

**File:** `packages/commerce/src/commerce.service.ts`

**Problem:** Both `purchase()` and `sell()` validated `quantity` but never validated `idempotencyKey`. An empty string or an oversized key would reach the DB and either fail silently or violate the UNIQUE constraint with an unhelpful error.

**Fix:** Added guard at top of both methods: `if (!params.idempotencyKey || params.idempotencyKey.length > 256) throw new CommerceValidationError(...)`.

---

### Bug 5 — MEDIUM: Missing FOR UPDATE on free-slot SELECT

**File:** `packages/commerce/src/commerce.service.ts` (`_addInventoryItemInTx`)

**Problem:** When `_addInventoryItemInTx` needed to allocate a new inventory slot (UPDATE affected 0 rows), it ran `SELECT slot FROM atc_character_inventory WHERE character_id = ? ORDER BY slot ASC` without `FOR UPDATE`. Two concurrent purchases could both read the same free-slot list and both attempt to INSERT into the same slot, causing a constraint violation or a silent slot collision.

**Fix:** Added `FOR UPDATE` to the free-slot SELECT. This extends the same row-level lock that protects the inventory count check to also protect slot allocation.

---

### Bug 6 — MEDIUM: Non-null assertions on tax rule lookups

**File:** `packages/commerce/src/commerce.service.ts` (`purchase()` and `sell()`)

**Problem:** Four locations used `taxRuleRows.find((r) => r.id === tx.ruleId)!`. The `!` assertion is logically sound (the breakdown is built from the same rows), but if a race or bug caused divergence, it would throw a null-pointer at runtime instead of a meaningful error.

**Fix:** Replaced `!` assertions with explicit `if (!rule) throw new CommerceValidationError(...)`. Provides a diagnostic message and makes the invariant explicit.

---

### Bug 7 — LOW: Missing pagination params in listShopsQuerySchema

**File:** `packages/operations/src/schemas.ts`

**Problem:** `listShopsQuerySchema` had no `limit` or `offset` fields. The underlying `ShopRepository.list()` accepted and honored them (defaulting to limit=20, max=100), but callers had no way to pass them through the validated schema. The GET `/api/v1/commerce/shops` route also did not pass them to `list()`.

**Fix:** Added `limit: z.coerce.number().int().positive().max(100).optional()` and `offset: z.coerce.number().int().min(0).optional()` to the schema. Updated the route handler to destructure and forward them.

---

### Bug 8 — LOW: calculateTotals accepts quantity < 1

**File:** `packages/commerce/src/commerce.service.ts` (public `calculateTotals` method)

**Problem:** The public `calculateTotals()` method (used by the price-preview endpoint) accepted `quantity = 0` or negative values without error, returning mathematically nonsensical totals.

**Fix:** Added `if (!Number.isInteger(quantity) || quantity < 1) throw new CommerceValidationError(...)` at the start of the method.

---

## 3. Hardening Tests Added (8 new tests)

**File:** `packages/tests/src/commerce.test.ts`

| Suite | Test | Covers |
|---|---|---|
| `hardening: idempotencyKey validation` | empty key (purchase) | Bug 4 |
| `hardening: idempotencyKey validation` | empty key (sell) | Bug 4 |
| `hardening: idempotencyKey validation` | key > 256 chars | Bug 4 |
| `hardening: ledger failure rolls back` | rollback + ORDER_FAILED on ledger throw | Bug 1 (normal error path) |
| `hardening: ORDER_FAILED suppressed on replay fetch failure` | no ORDER_FAILED when isReplay=true | Bug 1 (replay path) |
| `hardening: calculateTotals guards` | null sell_price throws CommerceShopCannotBuyError | Bug 3 |
| `hardening: calculateTotals guards` | quantity < 1 throws CommerceValidationError | Bug 8 |
| `hardening: multi-rule balance and org revenue routing` | 2 tax + 1 fee: balanced entries, per-account credits | Bug 6 (runtime invariant) |

---

## 4. Hardening Checklist Update

Additions to the Phase 22 hardening checklist:

- [x] **ORDER_FAILED gated on `!isReplay`** — prevents false failure events on idempotency replay fetch errors
- [x] **No spurious shop-lifecycle events** — shop creation emits no order events
- [x] **calculateTotals null sell_price throws** — preview endpoint returns error, not ¤0
- [x] **idempotencyKey validated at service boundary** — empty or oversized keys rejected before DB
- [x] **FOR UPDATE on free-slot SELECT** — concurrent new-slot allocation is serialized
- [x] **No silent null-pointer on tax rule lookup** — defensive check with diagnostic error
- [x] **listShopsQuerySchema has pagination** — limit/offset wired end-to-end
- [x] **calculateTotals quantity guard** — preview endpoint rejects nonsensical quantities

---

## 5. Final State

| Metric | Before | After |
|---|---|---|
| Commerce tests | 41 | 49 |
| Total tests | 1337 | 1345 |
| Test files | 72 | 72 |
| Typechecks | 48/48 | 48/48 |
| Builds | 25/25 | 25/25 |
| Critical bugs | 1 | 0 |
| High bugs | 3 | 0 |
| Medium bugs | 2 | 0 |
| Low bugs | 2 | 0 |

All tests pass. No regressions.
