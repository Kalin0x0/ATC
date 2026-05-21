# Phase 4 Runbook — Economy & Wallet Backbone

## Overview

Phase 4 adds persistent wallet management to Atlantic Core. Each character can hold one wallet per currency. All money is stored in minor units (e.g. cents for USD, or indivisible units for ATC). All mutations are server-authoritative — the FiveM client can never directly add money.

---

## What Was Built

### Database
| Migration | Table/Change | Purpose |
|---|---|---|
| `008_create_wallets.sql` | `atc_wallets` | One wallet per character per currency; BIGINT UNSIGNED balances |
| `009_create_wallet_transactions.sql` | `atc_wallet_transactions` | Immutable audit log; UNIQUE idempotency key |

### API Endpoints
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/wallets/character/:characterId` | Get (or create) wallet balance. Query: `currency` (default `ATC`) |
| `POST` | `/api/v1/wallets/character/:characterId/credit` | Credit cash or bank account |
| `POST` | `/api/v1/wallets/character/:characterId/debit` | Debit cash or bank account |
| `POST` | `/api/v1/wallets/character/:characterId/transfer` | Transfer between cash and bank (same character) |
| `GET` | `/api/v1/wallets/character/:characterId/transactions` | Paginated transaction history. Query: `currency`, `limit` (max 100), `offset` |

### Packages Changed
| Package | Change |
|---|---|
| `@atc/shared-types` | New: `AtcCurrencyCode`, `AtcWalletStatus`, `AtcMoneyAccount`, `AtcTransactionType`, `AtcTransactionSource`, `AtcWallet`, `AtcWalletTransaction`, `AtcWalletBalanceResponse`, `AtcWalletCreditRequest`, `AtcWalletDebitRequest`, `AtcWalletTransferRequest`, `AtcWalletMutationResponse`, `AtcWalletTransactionListResponse` |
| `@atc/schemas` | New: `walletCreditSchema`, `walletDebitSchema`, `walletTransferSchema`, `walletCharacterParamSchema`, `walletTransactionQuerySchema`, `idempotencyKeySchema`, `currencySchema`, `amountMinorSchema` |
| `@atc/db` | New: `WalletRepository` (getOrCreate, getBalance, credit, debit, transfer, listTransactions). Custom errors: `WalletFrozenError`, `WalletClosedError`, `InsufficientFundsError`, `DuplicateIdempotencyError` |
| `@atc/api` | New route file `wallets.ts`. `AppContext` extended with `wallets`. `server.ts` registers wallet routes. `index.ts` instantiates `WalletRepository`. |
| `@atc/sdk` | New: `AtcWalletsSDK` (getBalance, credit, debit, transfer, listTransactions). `AtcClient.wallets` added. |
| `game/atc-core` | New `server/economy.lua`. `shared/events.lua` extended with `ATC.Events.ECONOMY`. `fxmanifest.lua` includes `economy.lua`. |
| `@atc/locales` | Added `economy.*` section to en/de/fa (9 keys each). |

---

## Security Model

- **No client trust for mutations**: `ATC.Economy.Credit`, `ATC.Economy.Debit`, and `ATC.Economy.Transfer` are Lua server functions — they have no registered client event. Only server-side plugins and scripts can call them.
- **Balance request is read-only**: The `atc:economy:balance:request` FiveM event (client → server) is rate-limited to 10 per 60 seconds and only returns the current balance. It cannot modify money.
- **Idempotency**: Every mutation endpoint requires an `idempotencyKey`. If the same key is submitted twice, the second call returns the original result without writing to the DB (`idempotent: true`). The `UNIQUE(idempotency_key)` DB constraint is a hard safety net.
- **Transactional mutations**: Every credit/debit/transfer uses `BEGIN TRANSACTION` + `SELECT ... FOR UPDATE` to prevent race conditions. Balance checks are always inside the lock.
- **Integer-only amounts**: `amountMinorSchema` validates `z.number().int().positive()` ≤ `Number.MAX_SAFE_INTEGER`. No floats or decimals ever reach the DB.
- **Wallet status enforcement**: Mutations on `frozen` wallets return 422. Mutations on `closed` wallets return 422.
- **Best-effort Redis**: The economy layer does not cache wallet state in Redis. MariaDB is the sole source of truth.

---

## Running Migrations

Migrations run automatically on API startup. After Phase 4:

```sql
SELECT * FROM atc_migrations ORDER BY applied_at;
```

Expected:
```
001_create_accounts
002_create_player_sessions
003_create_bans
004_add_identifier_index
005_create_characters
006_alter_sessions_add_character
007_alter_characters_slot_nullable
008_create_wallets
009_create_wallet_transactions
```

---

## Environment Variables

No new environment variables are required. All Phase 2 variables apply.

---

## FiveM Integration

### Server-side Lua API (plugins only)

```lua
-- Get balance for the player's selected character
ATC.Economy.GetBalance(source, 'ATC', function(ok, data)
    if ok then
        print('Cash: ' .. data.cashBalance)
        print('Bank: ' .. data.bankBalance)
    end
end)

-- Credit money (gameplay reward, server-side only)
ATC.Economy.Credit(source, 'cash', 500, 'ATC', 'mission reward', function(ok, data)
    if ok then
        print('New cash balance: ' .. data.cashBalance)
    end
end)

-- Debit money (shop purchase, server-side only)
ATC.Economy.Debit(source, 'cash', 200, 'ATC', 'item purchase', function(ok, data)
    if not ok then
        -- Insufficient funds or wallet frozen
    end
end)

-- Transfer between cash and bank
ATC.Economy.Transfer(source, 'cash', 'bank', 1000, 'ATC', 'ATM deposit', function(ok, data)
    if ok then
        print('Cash: ' .. data.cashBalance .. ', Bank: ' .. data.bankBalance)
    end
end)
```

### Client → Server Events

| Event | Direction | Rate | Purpose |
|---|---|---|---|
| `atc:economy:balance:request` | client → server | 10 / 60s | Request current balance |
| `atc:economy:balance:update` | server → client | — | Balance response payload |
| `atc:economy:money:changed` | server → plugins | — | Emitted after every mutation |

### Client-side usage (NUI / client scripts)

```lua
-- Client: request balance
TriggerServerEvent(ATC.Events.ECONOMY.BALANCE_REQUEST, { currency = 'ATC' })

-- Client: listen for balance update
AddEventHandler(ATC.Events.ECONOMY.BALANCE_UPDATE, function(data)
    if data.ok then
        -- data.cashBalance, data.bankBalance, data.currency, data.status
    end
end)
```

### Idempotency key generation (server-side)

The Lua economy module generates idempotency keys automatically:

```
atc:{op}:{source}:{characterId}:{os.time()}:{math.random(1, 999999)}
```

This means each Lua call is idempotent only if you store and reuse the key yourself. The auto-generated key ensures uniqueness across calls.

---

## Error Codes

| HTTP | Meaning |
|---|---|
| `400` | Validation failed (integer check, account enum, currency format, etc.) |
| `401` | Missing or invalid Bearer token |
| `422` | Insufficient funds OR wallet is frozen/closed |
| `500` | Internal server error (always safe — no stack trace in response) |

---

## Test Coverage

| Suite | Tests | Location |
|---|---|---|
| Wallet schema validation | 28 | `packages/tests/src/wallet-api.test.ts` |
| SDK wallet methods | 18 | `packages/tests/src/sdk-wallets.test.ts` |
| API wallet routes | 18 | `apps/api/src/server.test.ts` |

Phase 4 adds **64 new tests**. Overall total: **249 tests, all pass**.

---

## Design Decisions

| Decision | Rationale |
|---|---|
| BIGINT UNSIGNED for balances | Prevents negative values at the DB level; no precision loss vs float |
| Amounts as `number` in API (not BigInt) | Game economies won't exceed `Number.MAX_SAFE_INTEGER` (≈9 quadrillion minor units); avoids JSON serialization complexity |
| Single transaction record per transfer | Transfers are internal to one wallet (cash ↔ bank); two-record approach would require custom idempotency splitting |
| `getOrCreate` on balance GET | Ensures a wallet always exists after first balance check; avoids 404 on first call |
| Best-effort Redis (none for wallets) | Wallet state changes frequently; cache invalidation complexity outweighs read latency gains at this phase |
| Idempotency enforced at two levels | Application check (SELECT FOR UPDATE on key) + DB UNIQUE constraint — double-layer prevents both races and retried writes |
