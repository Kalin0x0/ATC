# Phase 8 — Usable Item Runtime

## Overview

Phase 8 transforms passive inventory items into usable runtime entities. Items can now be used by players: cooldowns are enforced in Redis, consumable quantity is deducted atomically in MariaDB, durability is checked and decremented, and server-side effect handlers fire for gameplay outcomes (healing, buffs, etc.).

**Critical constraints:**
- All use validation and state mutation happens server-side. Clients cannot bypass cooldowns, durability checks, or quantity enforcement.
- Item use is idempotent — resubmitting the same `idempotencyKey` returns the original result without double-consuming.
- Durability `null` means the item does not track durability (unlimited). Durability `0` means broken and cannot be used when `durabilityCost > 0`.
- The `destroyOnEmpty` flag controls whether the inventory slot is deleted when quantity reaches 0.

---

## Database Changes (Migration 016)

Migration: `packages/db/migrations/016_item_runtime_fields.sql`

### `atc_character_inventory` — new columns

| Column | Type | Default | Purpose |
|---|---|---|---|
| `durability` | `INT UNSIGNED NULL` | NULL | Current durability. NULL = not tracked. 0 = broken. |
| `equipped` | `BOOLEAN NOT NULL` | FALSE | Whether the slot is currently equipped |
| `last_used_at` | `TIMESTAMP NULL` | NULL | Timestamp of last successful use |

Constraint: `chk_inv_durability CHECK (durability >= 0)`

New index: `idx_inv_equipped ON (character_id, equipped)` — equipped item lookups

### `atc_item_definitions` — new column

| Column | Type | Default | Purpose |
|---|---|---|---|
| `action_config_json` | `JSON NULL` | NULL | Serialized `AtcItemActionConfig` for usable items |

---

## New Package: `@atc/runtime-items`

Located at `packages/runtime-items/`. Orchestrates item use between the API, DB, and Redis layers.

### Exports

| Export | Purpose |
|---|---|
| `ItemRuntimeExecutor` | Main orchestrator — `useItem(characterId, request)` |
| `ItemCooldownCache` | Redis TTL-based cooldown read/write/clear |
| `RuntimeEffectRegistry` | Map of named effect handlers keyed by `serverEvent` |
| `validateItemForUse()` | Validates `status`, `usable`, and `actionConfig` |
| `ItemNotUsableError` | Thrown when `usable=false`, `status` is not `active`, or `actionConfig` is null |
| `ItemCooldownActiveError` | Thrown when Redis cooldown entry exists. Has `.expiresAt: Date` |
| `ItemInsufficientDurabilityError` | Thrown when `durability === 0` and `durabilityCost > 0` |
| `EffectHandler` | Type for effect handler functions |

### Item Use Pipeline (`ItemRuntimeExecutor.useItem`)

```
1. getSlot(characterId, slot)           → InventoryItemNotFoundError if null
2. findById(slot.itemId)                → returns item definition
3. validateItemForUse(def, actionConfig) → ItemNotUsableError if invalid
4. cooldown.get(characterId, slot)      → ItemCooldownActiveError if active
5. durability pre-check                 → ItemInsufficientDurabilityError if slot.durability === 0 and cost > 0
6. inventory.executeUse(params)         → atomic DB transaction (idempotent)
7. if idempotent → return early (no cooldown, no effects re-applied)
8. if cooldownMs > 0 → cooldown.set(characterId, slot, cooldownMs)
9. if serverEvent → effects.execute(serverEvent, characterId, itemId)
10. return AtcItemUseResponse
```

### Redis Cooldown Key Pattern

```
atc:item:cooldown:{characterId}:{slot}
```

TTL is set to `cooldownMs` milliseconds. Value stored as JSON: `{ characterId, slot, expiresAt }`.

---

## Item Action Config

Stored as `action_config_json` on `atc_item_definitions`. Defines how a usable item behaves when activated.

```typescript
interface AtcItemActionConfig {
  type: 'consume' | 'cooldown_only' | 'custom_event'
  cooldownMs?: number        // 0–86,400,000 ms (max 24h). Default 0 = no cooldown.
  consumeQuantity?: number   // >= 1. Default 1.
  durabilityCost?: number    // >= 0. Default 0.
  destroyOnEmpty?: boolean   // Delete slot when quantity reaches 0. Default false.
  serverEvent?: string       // 3–128 chars. Effect handler key.
}
```

**Action types:**
- `consume` — Deducts quantity. Most common type for food, medkits, ammo.
- `cooldown_only` — No quantity consumed, only cooldown enforced.
- `custom_event` — Fires the `serverEvent` handler without consuming.

---

## API Endpoint

### POST /api/v1/inventory/character/:characterId/use

Uses an item from a character's inventory slot.

**Authorization:** `Bearer <server_token>`

**Path param:** `characterId` — ULID

**Body:**
```json
{
  "slot": 5,
  "idempotencyKey": "atc:use:1:char-001:5:1716748800:999"
}
```

**Responses:**

| Status | Condition |
|---|---|
| `200` | Successful use (or idempotent replay) |
| `400` | Validation failure (invalid slot, missing idempotencyKey, invalid characterId) |
| `403` | Item not usable (`ItemNotUsableError`) — body includes `details: string[]` |
| `404` | Slot empty or character not found (`InventoryItemNotFoundError`) |
| `409` | Cooldown active (`ItemCooldownActiveError`) — body includes `cooldownExpiresAt: ISO8601` |
| `422` | Insufficient quantity or durability |

**Success response:**
```json
{
  "success": true,
  "itemId": "medkit",
  "slot": 5,
  "consumed": 1,
  "remainingQuantity": 2,
  "durability": null,
  "cooldownExpiresAt": "2026-05-15T12:00:05.000Z",
  "effects": [{ "type": "medkit.use", "success": true, "data": { "healed": 50 } }],
  "idempotent": false
}
```

---

## SDK

```typescript
import { AtcInventorySDK } from '@atc/sdk'

const result = await sdk.inventory.useItem(characterId, {
  slot: 5,
  idempotencyKey: 'atc:use:1:char:5:12345:999',
})

if (!result) {
  // 403 / 404 / 409 / 422 — inspect the HTTP response for details
}
```

`useItem` returns `AtcItemUseResponse | null`. `null` means the use was rejected — the caller must inspect the error response to determine why.

---

## FiveM / Lua Integration

### Server-side usage

```lua
-- Trigger item use from player input (via whitelisted client event)
ATC.Items.Use(source, slot, function(result, err)
  if not result then
    -- err contains the failure reason
    return
  end
  -- result.itemId, result.consumed, result.remainingQuantity
end)
```

### Events fired by `ATC.Items.Use`

| Event | When |
|---|---|
| `ATC.Events.ITEM.USED` | Successful use |
| `ATC.Events.ITEM.COOLDOWN` | Use rejected because cooldown is active |
| `ATC.Events.ITEM.BROKEN` | Use succeeded but durability reached 0 |

### Registering use from client

```lua
-- Client triggers this event; server validates and calls ATC.Items.Use
RegisterNetEvent(ATC.Events.ITEM.USE)
AddEventHandler(ATC.Events.ITEM.USE, function(slot)
  -- Firewall handles rate limit (10/30s), session check, and whitelisting
end)
```

The server firewall whitelist entry in `items_runtime.lua` handles:
- Rate limit: 10 uses per 30 seconds per player
- Session guard: must have an active character
- Client-originated events are whitelisted and forwarded to `ATC.Items.Use`

---

## Registering Effect Handlers

Effect handlers are registered against the `serverEvent` string from `actionConfig`. They execute after a successful DB use transaction.

```typescript
import { RuntimeEffectRegistry } from '@atc/runtime-items'

const effects = new RuntimeEffectRegistry()

effects.register('medkit.use', async (characterId, itemId, data) => {
  // Apply healing, update character health, etc.
  const healed = await healCharacter(characterId, 50)
  return { success: true, data: { healed } }
})
```

Effect handler failures are **non-fatal** — the use is already committed. The `AtcItemUseResponse.effects` array will contain `{ type, success: false }` entries for failed handlers.

---

## Idempotency

The `idempotencyKey` must be unique per use attempt. Recommended format:

```
atc:use:{version}:{characterId}:{slot}:{unixTimestamp}:{random}
```

If the same key is submitted twice, the second call returns the original result without re-consuming quantity, re-setting cooldown, or re-firing effects. The response will include `"idempotent": true`.

The idempotency record is stored in `atc_inventory_transactions` with `type = 'use'` and the result serialized in `metadata_json`.

---

## Cooldown Management

Cooldowns are stored in Redis with a TTL equal to `cooldownMs`. They expire automatically — no cleanup job required.

To manually clear a cooldown (e.g., admin action):

```typescript
await cooldownCache.clear(characterId, slot)
```

Or in Lua:
```lua
-- Call via SDK after verifying admin permission
ATC.SDK.Items.ClearCooldown(characterId, slot)
```

---

## Localization Keys

New keys added to `en`, `de`, and `fa` locales under the `item` namespace:

| Key | Purpose |
|---|---|
| `item.use` | In-progress message |
| `item.used` | Success message |
| `item.cooldown_active` | Cooldown rejection |
| `item.not_usable` | Item cannot be used |
| `item.no_quantity` | Insufficient quantity |
| `item.broken` | Durability = 0, cannot use |
| `item.durability_low` | Warning when durability is critically low |
| `item.invalid_slot` | Slot out of range |
| `item.effect_failed` | Effect handler returned failure |

---

## Operational Notes

### Monitoring

Watch for elevated `409` responses on the use endpoint — sustained cooldown rejections can indicate abuse or a broken client loop. The firewall rate limit (10/30s) provides a first line of defense.

### Effect handler failures

Effect handlers should never throw — they catch internally and return `{ success: false }`. If an effect handler throws uncaught, the executor catches it and records `{ success: false }` in the response. The use transaction is already committed at this point.

### Durability tracking opt-out

Items that don't track durability set `actionConfig.durabilityCost: 0` (or omit it). The `slot.durability` column will be `null` for items that have never had durability set. Setting `durabilityCost > 0` only has effect when `slot.durability` is not `null`.

### Adding a new usable item

1. Create or update the item definition with `actionConfig`:
   ```json
   {
     "type": "consume",
     "cooldownMs": 5000,
     "consumeQuantity": 1,
     "serverEvent": "medkit.use"
   }
   ```
2. Register an effect handler for `medkit.use` in the API bootstrap or plugin.
3. Ensure `usable: true` and `status: "active"` on the definition.
4. Test with `POST /api/v1/inventory/character/:characterId/use`.

---

## Tests

| File | Coverage |
|---|---|
| `packages/tests/src/item-runtime-schemas.test.ts` | `itemActionConfigSchema`, `itemUseSchema`, `itemEffectResultSchema`, `cooldownSchema` |
| `packages/tests/src/item-runtime-executor.test.ts` | `ItemRuntimeExecutor` happy path, cooldown, durability, idempotency, effects, error propagation, effect exception safety (BUG-8-2), partial durability pre-check (BUG-8-4), slot-based cooldown behavior |
| `apps/api/src/server.test.ts` | `POST /use` endpoint — 200, 400, 403, 404, 409, 422, InventoryItemBrokenError→422 (BUG-8-5), effect failure with success:true (BUG-8-2) |
| `packages/tests/src/inventory-sdk.test.ts` | `AtcInventorySDK.useItem` — success and all failure codes |

---

## Phase 8 Hardening (2026-05-15)

Six bugs found and fixed during the post-completion audit. No Phase 9 scope added.

### BUG-8-1 — Migration 016 not idempotent (MEDIUM)

**File:** `packages/db/migrations/016_item_runtime_fields.sql`

`ADD COLUMN` and `CREATE INDEX` statements lacked `IF NOT EXISTS` guards. Re-running the migration (e.g., on a fresh deploy targeting an already-migrated DB) would fail with `ER_DUP_FIELDNAME` / `ER_DUP_KEYNAME`.

**Fix:** Added `IF NOT EXISTS` to all `ADD COLUMN`, `ADD CONSTRAINT`, and `CREATE INDEX` statements. Separated `ADD COLUMN` and `ADD CONSTRAINT IF NOT EXISTS` into separate `ALTER TABLE` statements because MariaDB does not support both clauses in a single statement.

---

### BUG-8-2 — Effect handler exception propagates as 500 (HIGH)

**File:** `packages/runtime-items/src/effect-registry.ts`

`RuntimeEffectRegistry.execute()` called `return handler(...)` without a try/catch. An effect handler that throws propagates through the executor, through the API route unhandled catch chain, and surfaces as HTTP 500 — even though the DB use transaction is already committed.

**Fix:** Wrapped the handler call in try/catch. On exception, returns `{ success: false }` silently. Effect failures are non-fatal by design; the use transaction must never be rolled back for an effect failure.

```typescript
try {
  return await handler(characterId, itemId, data)
} catch {
  return { success: false }
}
```

---

### BUG-8-3 — executeUse idempotency check has a race window (HIGH)

**File:** `packages/db/src/repositories/inventory.repository.ts`

The idempotency pre-check occurred outside the DB transaction as an optimization. Two concurrent requests carrying the same `idempotencyKey` could both pass the pre-check, both enter the transaction, and the second would hit `ER_DUP_ENTRY` on the UNIQUE `idempotency_key` constraint — surfacing as a generic 500 instead of a replay response.

**Fix:** Added a second, definitive idempotency check INSIDE the transaction, after acquiring the `FOR UPDATE` slot row lock. If the key already exists in `atc_inventory_transactions`, the transaction rolls back and returns the stored result with `idempotent: true`. The outer pre-check is kept as an optimization to skip connection checkout on confirmed replays.

---

### BUG-8-4 — Executor durability pre-check too narrow (HIGH)

**File:** `packages/runtime-items/src/executor.ts`

The pre-check used `slotData.durability === 0`, which only blocked fully broken items. The actual `executeUse()` method correctly checked `durability < durabilityCost`, which also blocks partial cases (e.g., `durability = 3`, `durabilityCost = 5`). The mismatch meant partial cases passed the pre-check, entered `executeUse()`, and threw `InventoryItemBrokenError` from the DB layer — which was not caught in the API route (see BUG-8-5).

**Fix:** Pre-check now uses `slotData.durability !== null && slotData.durability < durabilityCost`, exactly mirroring `executeUse()` logic.

```typescript
// Before (wrong):
if (durabilityCost > 0 && slotData.durability === 0) {
// After (correct):
if (durabilityCost > 0 && slotData.durability !== null && slotData.durability < durabilityCost) {
```

---

### BUG-8-5 — InventoryItemBrokenError not caught in API route (HIGH)

**File:** `apps/api/src/routes/inventory.ts`

The use endpoint catch block handled `ItemInsufficientDurabilityError` (from `@atc/runtime-items`) → 422, but did not handle `InventoryItemBrokenError` (from `@atc/db`). If BUG-8-4 was not fixed, `InventoryItemBrokenError` would escape the executor and surface as HTTP 500.

**Fix:** Added `InventoryItemBrokenError` to the catch clause alongside `ItemInsufficientDurabilityError`:

```typescript
if (err instanceof ItemInsufficientDurabilityError || err instanceof InventoryItemBrokenError) {
  return reply.code(422).send({ error: err.message })
}
```

---

### BUG-8-6 — Lua BROKEN event fires on idempotent replays (MEDIUM)

**File:** `game/atc-core/server/items_runtime.lua`

The Lua `items_runtime.lua` checked `data.durability == 0` to fire `ATC.Events.ITEM.BROKEN`. It did not check `data.idempotent`. On an idempotent replay where the item was already broken, `durability` reflects the post-use state (0), causing the BROKEN event to fire a second time — triggering duplicate plugin callbacks.

**Fix:** Added `and not data.idempotent` guard:

```lua
if data and data.durability ~= nil and data.durability == 0 and not data.idempotent then
    TriggerEvent(ATC.Events.ITEM.BROKEN, source, { ... })
end
```

---

### Slot-Based Cooldown — Documented Behavior

Cooldown keys are keyed to `{characterId}:{slot}`, not to `{characterId}:{itemId}`. This means:

- Moving an item from slot 5 to slot 6 **bypasses the slot 5 cooldown** — by design.
- Swapping two items between slots **transfers their respective cooldowns** — each slot retains its own TTL.
- This behavior is intentional: the slot is the unit of use authority on the server. Exploiting this via inventory moves is rate-limited by the firewall (move events) and is accepted as a design trade-off.

If per-item cooldowns are required in the future, the Redis key must be migrated to `atc:item:cooldown:{characterId}:{itemId}`, and cooldown set/get calls must be updated accordingly. This is a Phase 9+ concern.

---

### Hardening Test Summary

| Test file | Tests added | Covers |
|---|---|---|
| `packages/tests/src/item-runtime-executor.test.ts` | 5 | Effect exception safety (BUG-8-2 ×2), partial durability pre-check (BUG-8-4 ×2), slot cooldown behavior documentation ×1 |
| `apps/api/src/server.test.ts` | 2 | InventoryItemBrokenError→422 (BUG-8-5), effect failure with 200 success:true (BUG-8-2) |

**Total tests after hardening: 559** (was 552 post Phase 8 initial implementation)
