# Phase 3 Runbook — Character & Identity Layer

## Overview

Phase 3 adds persistent character management to Atlantic Core. Players can create up to 5 characters per account and select one when joining the game world. Character state is persisted to MariaDB and cached in Redis alongside the session.

---

## What Was Built

### Database
| Migration | Table/Change | Purpose |
|---|---|---|
| `005_create_characters.sql` | `atc_characters` | Stores character records (ULID PKs, slot 1–5, status enum) |
| `006_alter_sessions_add_character.sql` | `atc_player_sessions.character_id` | FK to selected character, NULL until selected |

### API Endpoints
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/characters` | Create a character (max 5 per account, unique slot) |
| `GET` | `/api/v1/characters/account/:accountId` | List active characters for an account |
| `GET` | `/api/v1/characters/:characterId` | Fetch a single character |
| `PATCH` | `/api/v1/sessions/:sessionId/character` | Attach character to session (validates ownership + active status) |

### Packages Changed
| Package | Change |
|---|---|
| `@atc/shared-types` | New types: `AtcCharacterStatus`, `AtcCreateCharacterRequest`, `AtcCreateCharacterResponse`, `AtcCharacterListResponse`, `AtcCharacterSelectRequest`, `AtcCharacterSelectResponse`. Added `characterId?` to `AtcSessionResponse`. |
| `@atc/schemas` | New: `characterCreateSchema`, `characterSelectSchema`, param schemas |
| `@atc/db` | New: `CharacterRepository` with create/list/findById/findOwnedByAccount/countByAccount/softDelete/updateStatus. `CharacterLimitError`, `CharacterSlotTakenError`. `SessionRepository` extended with `findById`, `attachCharacter`, `characterId` field. |
| `@atc/cache` | `CachedSession` extended with `characterId: string \| null` |
| `@atc/sdk` | New: `AtcCharactersSDK` with create/listByAccount/get/selectForSession. Added `patch()` to `AtcHttpClient`. |
| `@atc/api` | New route file `characters.ts`. `AppContext` extended with `characters`. |
| `game/atc-core` | New `server/characters.lua`. `server/http.lua` extended with `ATC.HTTP.Patch`. `server/sessions.lua` extended with pending store and `accountId`/`characterId` tracking. `server/main.lua` registers `atc:character:select` handler. `fxmanifest.lua` includes `characters.lua`. |
| `@atc/locales` | Added `character.*` section to en/de/fa locale files (9 keys each). |

---

## Security Model

- **No client trust**: The client sends only `characterId`. The server resolves `accountId` from the existing session (never from the client payload).
- **Ownership validation**: `PATCH /api/v1/sessions/:sessionId/character` calls `findOwnedByAccount(characterId, session.accountId)` — a character from another account returns `403`.
- **Status check**: Only `active` characters can be selected. Deleted/suspended returns `422`.
- **Session guard**: Selecting a character on an ended session returns `409`.
- **Rate limiting**: The `atc:character:select` FiveM event is rate-limited to 3 requests per 60 seconds per player.
- **Input validation**: Character names must match `/^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/` (letters, spaces, hyphens, apostrophes only).
- **Slot limit**: `CharacterRepository.create` enforces max 5 active characters per account at the DB level before insert.
- **Duplicate slot**: MySQL `ER_DUP_ENTRY` on the `UNIQUE(account_id, slot)` constraint is caught and surfaced as `CharacterSlotTakenError` → `409`.

---

## Running Migrations

Migrations run automatically on API startup via `runMigrations(pool)`. To check status manually:

```bash
# Inside docker or DB shell
SELECT * FROM atc_migrations ORDER BY applied_at;
```

Expected after Phase 3:
```
001_create_accounts
002_create_player_sessions
003_create_bans
004_add_identifier_index
005_create_characters
006_alter_sessions_add_character
```

---

## Environment Variables

No new environment variables are required for Phase 3. All existing Phase 2 variables apply.

---

## FiveM Integration

The FiveM resource (`game/atc-core`) handles character flow:

1. **`playerConnecting`** — account upsert stores `accountId` in `ATC.Sessions.StorePending`
2. **`atc:core:client:ready`** — consumes pending accountId, calls `POST /api/v1/sessions`, upgrades in-memory session with API-assigned `session.id`
3. **`atc:character:select`** — client fires this event with `{ characterId }`. Server validates, calls `PATCH /api/v1/sessions/:sessionId/character`, updates local session state, emits `atc:player:character:selected` (server-side for plugins) and `atc:character:selected` (client-side for UI)

### Lua API
```lua
-- List active characters
ATC.Characters.List(source, function(ok, characters)
    if ok then
        -- characters = array of character objects from API
    end
end)

-- Select character
ATC.Characters.Select(source, characterId, function(ok, data)
    if ok then
        -- data.firstName, data.lastName, data.characterId
    end
end)

-- Get selected characterId
local charId = ATC.Characters.GetSelectedId(source)

-- Get full selected character data (from last Select response)
local charData = ATC.Characters.GetSelected(source)
```

---

## Error Codes

| HTTP | Meaning |
|---|---|
| `400` | Validation failed (name chars, slot range, gender enum, etc.) |
| `403` | Character not owned by session account |
| `404` | Session or character not found |
| `409` | Session has ended OR character slot already taken |
| `422` | Character limit reached (5 max) OR character is not active |

---

## Test Coverage

| Suite | Tests | Location |
|---|---|---|
| Character schema validation | 16 | `packages/tests/src/character-api.test.ts` |
| SDK character methods | 9 | `packages/tests/src/sdk-characters.test.ts` |
| API character routes | 26 (incl. hardening) | `apps/api/src/server.test.ts` |

Total Phase 3 tests: **51** (after hardening). Overall total: **185 tests, all pass**.

## Hardening Notes (Phase 3 Hardening — 2026-05-15)

Eight bugs were found and fixed in the hardening pass:

| # | Severity | Bug | Fix |
|---|---|---|---|
| 1 | CRITICAL | `attachCharacter` SQL referenced `updated_at` column that doesn't exist on `atc_player_sessions` | Removed invalid `updated_at = NOW(3)` from UPDATE statement |
| 2 | CRITICAL | `attachCharacter` returned `void` — silent success even if session ended concurrently; API returned 200 with no DB update | Changed to `Promise<boolean>`, route now returns 409 when `false` |
| 3 | HIGH | `_countActive` + INSERT not in a transaction — concurrent requests could create >5 characters | Wrapped in transaction with `SELECT ... FOR UPDATE` on account row |
| 4 | HIGH | `UNIQUE(account_id, slot)` permanently locked slot after soft-delete — player exhausted all 5 slots permanently | Migration 007 makes `slot` nullable; `softDelete` now sets `slot = NULL`, freeing slot for reuse |
| 5 | HIGH | No account status check in character creation — banned/suspended accounts could create characters | Added `accounts.getStatusById()` check before create; returns 403 for non-active accounts |
| 6 | MEDIUM | `characterData` never stored in sessions.lua — `ATC.Characters.GetSelected()` always returned nil | Fixed: `ATC.Sessions.Update` now sets `characterData = data` |
| 7 | LOW | Name schema accepted all-whitespace strings (e.g. `"   "`) | Added `.trim()` to name schema; `"   ".trim()` fails `min(2)` |
| 8 | LOW | Lua payload validation only checked `#characterId == 26`, not ULID charset | Added `characterId:match('^[0-9A-Za-z]+$')` guard |
