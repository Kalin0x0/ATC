# Phase 5 — Inventory Foundation Runbook

## Overview

Phase 5 establishes the item definition registry and character inventory system for Atlantic Core. It is a pure data-layer foundation: DB tables, a transaction ledger, an API, an SDK, and FiveM Lua bindings. No shops, crafting, weapons, clothing, or UI are included.

---

## What Was Built

### Database Migrations

| File | Purpose |
|---|---|
| `packages/db/migrations/011_create_item_definitions.sql` | Global item catalogue — one row per item type |
| `packages/db/migrations/012_create_character_inventory.sql` | Occupied inventory slots — one row per occupied slot per character |
| `packages/db/migrations/013_create_inventory_transactions.sql` | Append-only audit ledger — one row per inventory mutation |

**Key constraints:**
- `atc_item_definitions.id` — VARCHAR(64) human-readable key (e.g. `water_bottle`), not a ULID
- `atc_character_inventory.slot` — CHECK BETWEEN 1 AND 120; UNIQUE(character_id, slot) prevents double-occupancy
- `atc_character_inventory.quantity` — CHECK >= 1; empty slots are deleted, not zero'd
- `atc_inventory_transactions.idempotency_key` — UNIQUE; DB safety net for double-write prevention

### Shared Types (`packages/shared-types/src/inventory.ts`)

```typescript
AtcItemDefinition, AtcInventorySlot, AtcInventoryTransaction,
AtcInventoryWeightSummary, AtcInventoryResponse, AtcInventoryMutationResponse,
AtcInventoryAddRequest, AtcInventoryRemoveRequest, AtcInventoryMoveRequest,
AtcUpsertItemDefinitionRequest,
AtcItemDefinitionStatus, AtcInventoryTransactionType, AtcInventoryTransactionSource
```

### Zod Schemas (`packages/schemas/src/inventory.schema.ts`)

```typescript
itemIdSchema           // /^[a-z0-9_-]+$/, 2-64 chars
inventorySlotSchema    // int, 1-120
inventoryQuantitySchema // int, 1-100000
inventoryMetadataSchema // record, max 20 keys, optional
inventoryAddSchema, inventoryRemoveSchema, inventoryMoveSchema
itemDefinitionUpsertSchema  // with defaults: stackable=true, maxStack=100, etc.
inventoryCharacterParamSchema, inventoryTransactionQuerySchema
```

### Repositories (`packages/db/src/repositories/`)

**`ItemDefinitionRepository`**
- `upsert(params)` — INSERT ... ON DUPLICATE KEY UPDATE; returns full record after upsert
- `findById(id)` — returns `AtcItemDefinition | null`
- `listActive()` — WHERE status = 'active', ordered by category + id
- `disable(id)` — sets status = 'disabled'

**`InventoryRepository`**
- `getByCharacter(characterId)` — slots + weight summary
- `getSlot(characterId, slot)` — single slot lookup
- `addItem(params)` — transactional; idempotent; merges stackable items; finds free slot if none specified
- `removeItem(params)` — transactional; idempotent; deletes slot row when quantity reaches 0
- `moveItem(params)` — transactional; idempotent; swap uses DELETE+UPDATE+INSERT to avoid UNIQUE violation
- `calculateWeight(characterId)` — `SUM(quantity * weight_grams)` via JOIN; maxWeight = 30,000g
- `listTransactions(characterId, limit, offset)` — DESC order, paginated

### Custom Errors

```typescript
InventoryItemNotFoundError        → 422 (item not found or not active)
InventorySlotOccupiedError        → 422 (requested slot already taken)
InventoryInsufficientQuantityError → 422 (not enough items or empty source slot)
InventoryFullError                → 422 (all 120 slots occupied)
InventoryStackLimitError          → 422 (quantity would exceed maxStack)
InventoryIdempotencyPayloadMismatchError → 409 (key reused with different payload)
```

### API Endpoints (`apps/api/src/routes/`)

All endpoints require `Authorization: Bearer <token>`. All character-scoped endpoints run `requireActiveCharacter` guard (404/403 if not found/inactive).

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/items` | List all active item definitions |
| POST | `/api/v1/items` | Upsert an item definition |
| GET | `/api/v1/inventory/character/:characterId` | Get character inventory (slots + weight) |
| POST | `/api/v1/inventory/character/:characterId/add` | Add item to inventory |
| POST | `/api/v1/inventory/character/:characterId/remove` | Remove item from inventory |
| POST | `/api/v1/inventory/character/:characterId/move` | Move item between slots |
| GET | `/api/v1/inventory/character/:characterId/transactions` | List inventory transactions |

**Add response codes:**
- `201` — item added (new transaction)
- `200` — idempotent replay
- `409` — idempotency key reused with different payload
- `422` — business rule violation

### SDK (`packages/sdk/src/`)

```typescript
// AtcItemsSDK (client.items)
await ATC.items.list()                           // → AtcItemDefinition[]
await ATC.items.upsert(params)                   // → AtcItemDefinition | null

// AtcInventorySDK (client.inventory)
await ATC.inventory.get(characterId)             // → AtcInventoryResponse | null
await ATC.inventory.addItem(characterId, params) // → AtcInventoryMutationResponse | null
await ATC.inventory.removeItem(characterId, params)
await ATC.inventory.moveItem(characterId, params)
await ATC.inventory.listTransactions(characterId, limit, offset) // → AtcInventoryTransaction[]
```

### FiveM Lua (`game/atc-core/server/inventory.lua`)

Server-side only. Clients **cannot** add, remove, or move items directly.

```lua
-- Server-side only (plugin calls):
ATC.Inventory.Get(source, callback)                              -- read
ATC.Inventory.HasItem(source, itemId, quantity, callback)        -- check
ATC.Inventory.Add(source, itemId, quantity, reason, callback)    -- mutate
ATC.Inventory.Remove(source, itemId, quantity, reason, callback) -- mutate
ATC.Inventory.Move(source, fromSlot, toSlot, callback)          -- mutate

-- Events:
ATC.Events.INVENTORY.REQUEST       -- client → server (rate-limited: 5/30s, read-only)
ATC.Events.INVENTORY.UPDATE        -- server → client (response to REQUEST)
ATC.Events.INVENTORY.ITEM_CHANGED  -- server → all plugins (fired after mutations)
```

### Localization Keys (`packages/locales/locales/`)

Added to `en.json`, `de.json`, `fa.json`:
```
inventory.fetching, inventory.item_added, inventory.item_removed,
inventory.item_moved, inventory.item_not_found, inventory.insufficient_quantity,
inventory.slot_occupied, inventory.inventory_full, inventory.stack_limit,
inventory.invalid_item, inventory.overweight
```

---

## Security Properties

- **Client cannot add/remove/move items** — only `atc:inventory:request` (read-only) is registered as a client event
- **Character ownership** — all mutations verify the `source`-to-character mapping server-side; character ID is never trusted from the client
- **Idempotency** — every mutation requires an `idempotencyKey`; the DB UNIQUE constraint is the final safety net
- **Payload hash** — SHA-256 of canonical mutation params stored in ledger; mismatch returns 409
- **Item validation** — only `status = 'active'` items can be added to any inventory
- **Slot constraints** — DB CHECK enforces slots 1-120 and quantity ≥ 1

---

## Stack Merge Logic

When `addItem` is called for a stackable item without a specific slot:
1. Query all existing slots for that `itemId` with a `FOR UPDATE` lock
2. Find a candidate where: `canonical_metadata_matches AND existing.quantity + newQty <= maxStack`
3. If found: `UPDATE quantity = quantity + newQty`
4. If not found: insert into first free slot (or specified slot)

Metadata canonical comparison uses `JSON.stringify` with sorted keys.

---

## Move Swap Logic

When moving to an occupied slot:
1. `DELETE` the target slot row
2. `UPDATE fromSlot.slot = toSlot`
3. `INSERT` the deleted row back at `fromSlot`

This order avoids a UNIQUE constraint violation on `(character_id, slot)` that would occur if both slots were occupied.

---

## Weight System

- Weight is calculated on every inventory read via a `JOIN` query: `SUM(quantity * weight_grams)`
- `maxWeightGrams` = 30,000g (30 kg) — Phase 5 constant
- `isOverweight = totalWeightGrams > maxWeightGrams`
- The system does **not** block adds when overweight in Phase 5 — weight is informational only

---

## Validation Commands

```bash
# Typecheck all packages
pnpm turbo typecheck

# Build all packages
pnpm turbo build

# Run all tests (355 tests should pass after hardening)
pnpm turbo test
```

---

## What Is NOT Included (Forbidden Scope)

- Shops, crafting, item purchasing
- Weapon systems, clothing, housing storage, vehicle storage
- UI inventory, drag/drop NUI
- QB/ESX/Qbox/ND bridges
- Admin dashboard for inventory management
- Gameplay reward systems or economy loops

---

## Hardening (2026-05-15) — 10 Bugs Fixed

Applied after initial Phase 5 completion:

| Bug | Severity | Fix |
|---|---|---|
| BUG-1 | HIGH | `addItem`: enforce `quantity <= item.max_stack` before any slot work; throws `InventoryStackLimitError` |
| BUG-2 | MEDIUM | Free-slot scan: `SELECT ... FOR UPDATE`; INSERT wrapped in `ER_DUP_ENTRY` catch → `InventorySlotOccupiedError` |
| BUG-3 | MEDIUM | `sortedStringify`: replaced shallow key sort with `deepSortKeys()` (recursive) for correct nested object comparison |
| BUG-4 | MEDIUM | Removed manual `rollback()` before every throw — a single `catch` block handles all rollbacks, preventing double-rollback |
| BUG-5 | LOW | Post-commit SELECT eliminated; response built from known data after commit |
| BUG-6 | LOW | `sortedStringify({})` now returns `'null'` (empty object treated as no metadata) |
| BUG-7 | LOW | `itemDefinitionUpsertSchema` `.transform()` auto-sets `maxStack=1` when `stackable=false` |
| BUG-8 | LOW | Partial move to occupied slot throws `InventoryInsufficientQuantityError` instead of doing a silent full swap |
| BUG-9 | LOW | `calculateWeight`: throws if `total_weight_grams` exceeds `Number.MAX_SAFE_INTEGER` |
| BUG-10 | LOW | HTTP status codes corrected: `InventoryItemNotFoundError` → 404; `InventorySlotOccupiedError`/`InventoryFullError` → 409 |

**Bonus**: `moveItem` locks slots in consistent order (lower slot number first) to prevent InnoDB deadlocks.

---

## Phase 6 Prerequisites

Before building any inventory gameplay:
1. All 3 migrations must be applied to production DB
2. At least one item definition must exist (`POST /api/v1/items`)
3. Characters must be `status = 'active'` to receive items
