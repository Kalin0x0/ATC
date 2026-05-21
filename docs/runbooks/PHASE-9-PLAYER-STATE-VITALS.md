# Phase 9 — Player State & Vitals

**Status:** Complete + Hardened  
**Date:** 2026-05-15  
**Hardened:** 2026-05-15  
**Depends on:** Phase 8 (Usable Item Runtime)

---

## Overview

Phase 9 adds a server-authoritative character vitals system: health, hunger, thirst, stamina, stress, and armor. All mutation is server-side only. Redis provides a 60-second read-hot mirror. FiveM Lua exposes rate-limited client read requests and server-driven sync events. The item runtime is extended with a typed `vitals.modify` effect that fires when a consumable item is used.

---

## Files Added

| Path | Purpose |
|---|---|
| `packages/db/migrations/017_create_character_vitals.sql` | Schema migration |
| `packages/shared-types/src/vitals.ts` | Domain types |
| `packages/schemas/src/vitals.schema.ts` | Zod validators |
| `packages/db/src/repositories/vitals.repository.ts` | DB access layer |
| `packages/cache/src/vitals-cache.ts` | Redis cache layer |
| `packages/sdk/src/vitals.ts` | TypeScript SDK |
| `packages/runtime-items/src/vitals-effect.ts` | Item effect handler |
| `apps/api/src/routes/vitals.ts` | REST endpoints |
| `game/atc-core/server/vitals.lua` | FiveM Lua API |
| `packages/tests/src/vitals-schemas.test.ts` | Schema tests |
| `packages/tests/src/vitals-repo.test.ts` | Repository tests |
| `packages/tests/src/vitals-cache.test.ts` | Cache tests |
| `packages/tests/src/vitals-sdk.test.ts` | SDK tests |
| `packages/tests/src/vitals-effect.test.ts` | Effect handler tests |

---

## Files Modified

| Path | Change |
|---|---|
| `packages/shared-types/src/inventory.ts` | Added `AtcItemEffectConfig`, `effects?` on `AtcItemActionConfig` |
| `packages/shared-types/src/index.ts` | Re-exported vitals types |
| `packages/schemas/src/index.ts` | Re-exported vitals schemas |
| `packages/db/src/index.ts` | Exported `VitalsRepository` |
| `packages/cache/src/index.ts` | Exported `VitalsCache` |
| `packages/sdk/src/index.ts` | Exported `AtcVitalsSDK` |
| `packages/sdk/src/client.ts` | Added `vitals: AtcVitalsSDK` to `AtcClient` |
| `packages/runtime-items/src/executor.ts` | Added typed `effects[]` processing |
| `packages/runtime-items/src/index.ts` | Exported `createVitalsModifyHandler` |
| `apps/api/src/context.ts` | Added `vitals`, `vitalsCache` to `AppContext` |
| `apps/api/src/server.ts` | Registered `vitalsRoutes` |
| `apps/api/src/index.ts` | Wired `VitalsRepository`, `VitalsCache`, effect handler |
| `apps/api/src/server.test.ts` | Added Phase 9 API tests |
| `game/atc-core/shared/events.lua` | Added `ATC.Events.VITALS` constants |
| `game/atc-core/fxmanifest.lua` | Added `items_runtime.lua` (Phase 8 fix) + `vitals.lua` |
| `packages/locales/locales/en.json` | Added `vitals.*` keys |
| `packages/locales/locales/de.json` | Added `vitals.*` keys |
| `packages/locales/locales/fa.json` | Added `vitals.*` keys |

---

## Database

### Migration: `017_create_character_vitals.sql`

```sql
CREATE TABLE IF NOT EXISTS atc_character_vitals (
  character_id  VARCHAR(36)  NOT NULL,
  health        TINYINT      NOT NULL DEFAULT 100 CHECK (health  BETWEEN 0 AND 100),
  hunger        TINYINT      NOT NULL DEFAULT 100 CHECK (hunger  BETWEEN 0 AND 100),
  thirst        TINYINT      NOT NULL DEFAULT 100 CHECK (thirst  BETWEEN 0 AND 100),
  stamina       TINYINT      NOT NULL DEFAULT 100 CHECK (stamina BETWEEN 0 AND 100),
  stress        TINYINT      NOT NULL DEFAULT   0 CHECK (stress  BETWEEN 0 AND 100),
  armor         TINYINT      NOT NULL DEFAULT   0 CHECK (armor   BETWEEN 0 AND 100),
  created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (character_id),
  CONSTRAINT fk_vitals_character
    FOREIGN KEY (character_id) REFERENCES atc_characters(id) ON DELETE CASCADE
);
```

Run migrations: `pnpm --filter @atc/db migrate`

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/vitals/character/:characterId` | Fetch vitals (Redis-first) |
| `PATCH` | `/api/v1/vitals/character/:characterId` | Set specific vitals (clamped 0–100) |
| `POST` | `/api/v1/vitals/character/:characterId/mutate` | Increment/decrement/set a single vital (transactional) |
| `POST` | `/api/v1/vitals/character/:characterId/reset` | Reset all vitals to defaults |

All routes require the character to exist and be active (`status = 'active'`). 400 is returned for invalid input, 403 for inactive characters, 404 for unknown characters.

---

## SDK

```typescript
import { AtcClient } from '@atc/sdk'

const sdk = new AtcClient({ baseUrl: 'http://localhost:3000' })

// Read vitals (Redis-hot on server, direct on client)
const vitals = await sdk.vitals.get(characterId)

// Patch specific values
await sdk.vitals.patch(characterId, { health: 75, hunger: 60 })

// Transactional mutation (safe concurrent increment/decrement)
await sdk.vitals.mutate(characterId, { vital: 'thirst', mode: 'increment', amount: 25 })

// Full reset to defaults
await sdk.vitals.reset(characterId)
```

All methods return `AtcCharacterVitals | null`. Null indicates HTTP error — no retry is attempted.

---

## Item Effects (Runtime)

### Wiring a `vitals.modify` effect to a consumable item:

```typescript
// In item definition (atc_item_definitions.action_config JSON column):
{
  "type": "consume",
  "cooldownMs": 3000,
  "consumeQuantity": 1,
  "destroyOnEmpty": false,
  "effects": [
    { "type": "vitals.modify", "vital": "thirst", "mode": "increment", "amount": 25 }
  ]
}
```

Effects are non-fatal — if `vitals.mutate` fails, the item use still succeeds. The `result.effects[]` array in the use response reports per-effect success.

### How it works:

1. `ItemRuntimeExecutor.useItem()` processes inventory use (decrement, cooldown)
2. After DB commit, iterates `cfg.effects[]`
3. For each effect, calls `RuntimeEffectRegistry.execute(type, characterId, itemId, data)`
4. `createVitalsModifyHandler(vitalsService)` is the registered handler for `'vitals.modify'`
5. Handler calls `vitalsService.mutate(characterId, vital, mode, amount)`

### Registering at startup (`apps/api/src/index.ts`):

```typescript
itemRuntime.getEffectRegistry().register(
  'vitals.modify',
  createVitalsModifyHandler(vitalsRepo),
)
```

---

## FiveM Lua API

```lua
-- Read vitals for a player (async)
ATC.Vitals.Get(source, function(vitals)
  if vitals then
    print(vitals.health, vitals.hunger, vitals.thirst)
  end
end)

-- Patch specific vitals (server-authoritative)
ATC.Vitals.Patch(source, { hunger = 50 }, function(result)
  if result then print('Patched OK') end
end)

-- Mutate a single vital (transactional, safe under concurrency)
ATC.Vitals.Mutate(source, 'thirst', 'increment', 25, function(result)
  print(result and 'OK' or 'Failed')
end)

-- Sync current vitals to client (fires ATC.Events.VITALS.UPDATE)
ATC.Vitals.Sync(source)
```

### Client read event (rate-limited):

```lua
-- Client fires: TriggerServerEvent(ATC.Events.VITALS.REQUEST)
-- Server responds: TriggerClientEvent(ATC.Events.VITALS.UPDATE, source, vitals)
-- Rate limit: 10 requests / 60 seconds per player
```

### Events:

| Constant | Value | Direction |
|---|---|---|
| `ATC.Events.VITALS.REQUEST` | `atc:vitals:request` | Client → Server |
| `ATC.Events.VITALS.UPDATE` | `atc:vitals:update` | Server → Client |
| `ATC.Events.VITALS.CHANGED` | `atc:vitals:changed` | Server → Server (EventBus) |

---

## Redis Cache

- **Key:** `atc:vitals:character:{characterId}`
- **TTL:** 60 seconds
- **Serialization:** JSON.stringify / JSON.parse with explicit Date reconstruction
- **Corrupt eviction:** On parse failure, `redis.del(key).catch()` runs and null is returned
- **Failure policy:** Redis failure on GET falls through to DB (non-fatal). Redis failure on SET is best-effort (`.catch(() => undefined)`)

---

## Localization Keys

All keys added under `"vitals"` namespace in `en.json`, `de.json`, `fa.json`:

```
vitals.health
vitals.hunger
vitals.thirst
vitals.stamina
vitals.stress
vitals.armor
vitals.updated
vitals.invalid
vitals.not_found
```

---

## Security Properties

- Client cannot PATCH or mutate vitals directly (no client-facing mutation events)
- Client read event (`atc:vitals:request`) is rate-limited (10/60s) via `ATC.Firewall.On`
- `vitalsMutationSchema` enforces `amount` in `[0, 100]` (integer)
- `vitalsCharacterParamSchema` enforces `characterId` length `[20, 36]`
- `vitalsPatchSchema` rejects empty patches via Zod `.refine()`
- SQL clamping: `LEAST(100, col + ?)` / `GREATEST(0, col - ?)` enforces bounds even if schema validation is bypassed
- VITAL_COLUMNS whitelist prevents SQL injection in dynamic `patch()` SET clause
- All mutations require `requireActiveCharacter()` guard (character must exist and be `status = 'active'`)
- `SELECT FOR UPDATE` in `mutate()` prevents concurrent race on the same character row

---

## Known Constraints (By Design)

The following are explicitly out of scope and must not be added:

- Passive decay loops (hunger/thirst ticking over time) — Phase 10+
- Combat damage integration — Phase 12+
- EMS / medical revival — Phase 12+
- Status effects / buffs / debuffs — Phase 10+
- UI/NUI HUD rendering — Phase 10+
- Client-side vitals mutation of any kind

---

## Validation Commands

```bash
# Install dependencies
pnpm install

# Type-check all packages
pnpm turbo typecheck

# Build all packages
pnpm turbo build

# Run test suite
pnpm turbo test

# Run only vitals tests
pnpm --filter @atc/tests test -- --reporter=verbose vitals
```

---

## Hardening Applied (2026-05-15)

Five bugs were found and fixed during the Phase 9 hardening audit. See the hardening report for full details.

| Bug | Severity | Fix |
|---|---|---|
| BUG-9-1 | Medium | Migration column types: `INT UNSIGNED` → `TINYINT UNSIGNED`, `TIMESTAMP` → `DATETIME(3)` |
| BUG-9-2 | High | `vitals-effect.ts`: strict validation — vital name set, mode set, integer range, NaN/Infinity/float guards |
| BUG-9-3 | Medium | `AtcVitalsChangedEvent.changed` made optional — Lua layer cannot compute a diff |
| BUG-9-4 | Medium | Eager vitals row creation on character create (best-effort, non-blocking) |
| BUG-9-5 | Low | Lua `Patch()` now validates non-empty table with at least one valid vital key before sending |

Tests added: 27 unit tests in `vitals-hardening.test.ts` + 11 API tests in `server.test.ts`. Total: **661 tests, all pass**.

---

## Remaining Risks After Hardening

1. **Rate limiting on PATCH/POST API endpoints** — Only the FiveM Lua client read event is rate-limited. The REST mutation endpoints rely on bearer token auth and have no per-character rate limit. Add rate limiting via `@atc/security` for Phase 10 prep.
2. **Stale Redis key on character delete** — Characters are soft-deleted in ATC (status change, not DELETE). The SQL CASCADE does not fire. Redis TTL (60s) is the only cleanup. Since `requireActiveCharacter()` guards before Redis, the stale key is memory-only risk, not a data risk. Add `vitalsCache.del()` to the character soft-delete flow when that route is added.
3. **`AtcVitalsChangedEvent` not emitted by API routes** — The CHANGED event is emitted by FiveM Lua (Patch/Mutate) but not by the REST API. Direct API consumers have no event notification. Add EventBus emit when EventBus is wired in Phase 10+.
4. **Integration test against real MariaDB** — `LEAST/GREATEST` clamping and `CHECK` constraints are confirmed by SQL-string inspection in unit tests. A real MariaDB integration test would fully confirm constraint behavior.

---

## Phase 9 Scope Constraints (Permanent)

The following must not be added to this system at any future point without a new Phase:

- Passive decay loops (hunger/thirst ticking over time) — Phase 10+
- Combat damage integration — Phase 12+
- EMS / medical revival — Phase 12+
- Status effects / buffs / debuffs — Phase 10+
- UI/NUI HUD rendering — Phase 10+
- Client-side vitals mutation of any kind
