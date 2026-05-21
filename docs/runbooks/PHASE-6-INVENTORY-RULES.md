# Phase 6 — Inventory Rules & Enforcement Layer
## Runbook

**Status:** COMPLETE  
**Tests:** 388 total (296 packages/tests + 92 api/server.test.ts) — all passing  
**Typecheck:** clean  

---

## What Was Built

Phase 6 adds a hardened enforcement layer on top of the Phase 5 inventory foundation. No shops, crafting, UI, vehicles, housing, marketplace, or trading were added.

---

## DB Changes

### Migration 014 — `packages/db/migrations/014_inventory_performance_and_capacity.sql`

```sql
-- Composite index for stack-merge lookup
ALTER TABLE atc_character_inventory
  ADD INDEX idx_inventory_character_item (character_id, item_id);

-- Per-character capacity settings table
CREATE TABLE IF NOT EXISTS atc_character_inventory_settings (
  character_id     CHAR(26)     NOT NULL,
  max_slots        INT UNSIGNED NOT NULL DEFAULT 60,
  max_weight_grams INT UNSIGNED NOT NULL DEFAULT 30000,
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (character_id),
  CONSTRAINT fk_inv_settings_character
    FOREIGN KEY (character_id) REFERENCES atc_characters (id) ON DELETE CASCADE,
  CONSTRAINT chk_inv_settings_max_slots   CHECK (max_slots BETWEEN 1 AND 120),
  CONSTRAINT chk_inv_settings_max_weight  CHECK (max_weight_grams >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

**Defaults:** 60 slots, 30 kg (30 000 g) per character.
**Special value:** `max_weight_grams = 0` means **unlimited** — weight enforcement is skipped entirely.

---

## New API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/v1/inventory/character/:characterId/settings` | Get per-character settings (auto-created on first call) |
| PATCH  | `/api/v1/inventory/character/:characterId/settings` | Update maxSlots and/or maxWeightGrams |

### PATCH settings request body
```json
{ "maxSlots": 80 }
{ "maxWeightGrams": 50000 }
{ "maxSlots": 80, "maxWeightGrams": 50000 }
```
At least one field required. `maxSlots` must be 1–120. `maxWeightGrams` must be ≥ 0.

### Error responses
- `409 Conflict` — `InventorySettingsConflictError`: reducing `maxSlots` below highest used slot, or reducing `maxWeightGrams` below current weight
- `422 Unprocessable` — `InventoryOverweightError`, `InventoryCapacityError`, `InventoryMetadataValidationError`

---

## New Repository Errors

| Class | Trigger |
|-------|---------|
| `InventoryOverweightError` | `addItem` would push total weight over `maxWeightGrams` |
| `InventoryCapacityError` | Requested slot or `toSlot` > `maxSlots` |
| `InventoryMetadataValidationError` | Item metadata violates the item's `metadataSchema` |
| `InventorySettingsConflictError` | `updateSettings` conflicts with current inventory state |

---

## Enforcement Rules

### Weight
- `addItem` reads settings, then (inside transaction) checks `currentWeight + (quantity × itemDef.weight_grams) > settings.maxWeightGrams`.
- Throws `InventoryOverweightError` if limit would be exceeded.
- **`maxWeightGrams = 0`** → weight check skipped entirely (unlimited mode). `calculateWeight` / `getByCharacter` report `isOverweight = false` and `remainingWeightGrams = Number.MAX_SAFE_INTEGER`.
- Safe-integer guards: throws if `addedWeightGrams` or the sum `currentWeight + addedWeight` exceeds `Number.MAX_SAFE_INTEGER`.

### Capacity
- `addItem`: if a specific slot is requested and `slot > settings.maxSlots` → `InventoryCapacityError` (before the transaction opens).
- `addItem`: free-slot scan iterates `1..settings.maxSlots` (not the absolute DB max of 120).
- `moveItem`: `toSlot > settings.maxSlots` → `InventoryCapacityError` (after idempotency check, before slot locks).

### Metadata Validation
- Item definitions may carry a `metadata_schema_json` column with a JSON schema:
  ```json
  { "required": ["color"], "strict": true, "properties": { "color": { "type": "string", "maxLength": 32 } } }
  ```
- `addItem` validates the caller's `metadata` against this schema. Failure → `InventoryMetadataValidationError`.
- Supported types: `string`, `number`, `boolean`. Constraints: `maxLength`, `min`, `max`.

### Settings Conflict Guard
- `updateSettings` with `maxSlots: N` checks that no item occupies a slot > N.
- `updateSettings` with `maxWeightGrams: W` checks that current total weight ≤ W.
- `updateSettings` with `maxWeightGrams: 0` skips the weight conflict check (setting to unlimited can never conflict).

---

## Partial Move & Stack Merge

| Scenario | Result |
|----------|--------|
| `quantity < fromRow.quantity`, `toSlot` empty | SPLIT: decrease fromRow, INSERT at toSlot |
| Full move, `toSlot` empty | UPDATE slot on fromRow |
| Same item + same metadata, `toRow.quantity + qty ≤ maxStack` | MERGE |
| Same item + same metadata, merge would overflow | `InventoryStackLimitError` |
| Different item in `toSlot`, full move | SWAP (3 DML operations) |
| Different item in `toSlot`, partial move | `InventoryInsufficientQuantityError` |

---

## FiveM Lua New Helpers

```lua
-- Weight summary for a player's character
ATC.Inventory.GetWeight(source, function(ok, weightSummary) end)

-- Capacity summary for a player's character
ATC.Inventory.GetCapacity(source, function(ok, capacitySummary) end)

-- Check if character has space for N units of an item weighing W grams
ATC.Inventory.HasSpaceFor(source, weightGrams, quantity, function(ok, hasSpace) end)

-- Per-character settings (maxSlots, maxWeightGrams)
ATC.Inventory.GetSettings(source, function(ok, settings) end)
```

Client update event shape (via `atc:inventory:update`) now includes `settings`, `weightSummary` (replaces `weight`), and `capacitySummary`.

---

## Settings Auto-Creation

Settings rows are created on-demand via `INSERT ... ON DUPLICATE KEY UPDATE` before any operation that needs them. No explicit setup required for new characters.

---

## Running Migration

```bash
# Via API startup (auto-applied on boot if migration runner is enabled)
pnpm --filter @atc/api dev

# Or manually
pnpm --filter @atc/db migrate
```

---

## Tests Added/Updated

| File | Change |
|------|--------|
| `packages/tests/src/inventory-repo.test.ts` | Rewrote to fix mock sequences (settings now pre-fetched); added 9 new Phase 6 tests |
| `packages/tests/src/inventory-schemas.test.ts` | Added 12 tests for `inventoryUpdateSettingsSchema` + `inventoryMetadataSchemaSchema` |
| `packages/tests/src/inventory-sdk.test.ts` | Updated `get` mock shape; added `getSettings` + `updateSettings` tests |
| `apps/api/src/server.test.ts` | Updated `mockInventory`; added 7 tests for Phase 6 errors + settings endpoints |

---

## Risks & Notes

- `getOrCreateSettings` is non-transactional (uses `pool.execute` directly). This is intentional — it avoids deadlock from nested transactions and is safe due to `ON DUPLICATE KEY UPDATE` atomicity.
- `calculateWeight` and the settings-based checks are eventually consistent under extreme concurrency but are bounded by the inner-transaction weight/slot checks.
- The absolute `MAX_SLOTS = 120` constant remains enforced by the DB `CHECK` constraint and the Zod `inventorySlotSchema`. Per-character `maxSlots` is a softer limit within that.
- `maxWeightGrams = 0` is valid (no weight limit enforced).
