# API Standards

## REST API Conventions

### Base URL
```
http://localhost:30120/api/v1/   (development)
https://api.atc.internal/v1/    (production, behind nginx)
```

### URL Structure
```
/{resource}                      - Collection
/{resource}/{id}                 - Single resource
/{resource}/{id}/{sub-resource}  - Nested collection
/{resource}/{id}/actions/{verb}  - RPC-style action (use sparingly)
```

### Versioning
- Current version: `v1`
- Version is in the URL path, not headers
- Breaking changes require a new version (`v2`)
- Old versions remain live for at least one full release cycle
- Version sunset is announced via deprecation header: `Deprecation: true`

### HTTP Methods

| Method | Usage | Body | Idempotent |
|---|---|---|---|
| `GET` | Read data | None | ✅ |
| `POST` | Create resource or trigger action | JSON | ❌ |
| `PUT` | Full replace of resource | JSON | ✅ |
| `PATCH` | Partial update | JSON (RFC 7396) | ✅ |
| `DELETE` | Remove resource | None | ✅ |

---

## Request & Response Format

### Request Headers (required on all API calls from FiveM)
```
Content-Type: application/json
Authorization: Bearer {server-to-server-token}
X-ATC-Server-ID: {serverId}
X-ATC-Request-ID: {uuidv7}
```

### Response Envelope
```typescript
// Success
{
  "success": true,
  "data": { ... },          // The actual resource or result
  "meta": {                 // Optional metadata
    "page": 1,
    "pageSize": 50,
    "total": 243
  }
}

// Error
{
  "success": false,
  "error": {
    "code": "INVENTORY_WEIGHT_EXCEEDED",
    "message": "Cannot add item: weight limit exceeded",
    "details": {
      "currentWeight": 28.5,
      "itemWeight": 3.0,
      "maxWeight": 30.0
    }
  },
  "requestId": "01HXZ..."
}
```

### HTTP Status Codes

| Code | Usage |
|---|---|
| `200` | Success (GET, PATCH, DELETE) |
| `201` | Resource created (POST) |
| `204` | Success, no body (DELETE) |
| `400` | Bad request / validation failure |
| `401` | Missing or invalid auth token |
| `403` | Authenticated but insufficient permissions |
| `404` | Resource not found |
| `409` | Conflict (e.g., duplicate, race condition) |
| `422` | Valid JSON but business rule violation |
| `429` | Rate limit exceeded |
| `500` | Internal server error |
| `503` | Service temporarily unavailable |

---

## Error Codes

Error codes follow: `{DOMAIN}_{NOUN}_{DESCRIPTION}` (SCREAMING_SNAKE_CASE)

```
PLAYER_NOT_FOUND
PLAYER_SESSION_EXPIRED
PLAYER_CHARACTER_LIMIT_REACHED

INVENTORY_WEIGHT_EXCEEDED
INVENTORY_ITEM_NOT_FOUND
INVENTORY_STACK_LIMIT_REACHED
INVENTORY_STASH_LOCKED

ECONOMY_INSUFFICIENT_FUNDS
ECONOMY_TRANSFER_LIMIT_EXCEEDED
ECONOMY_FRAUD_BLOCKED

VEHICLE_NOT_OWNED
VEHICLE_ALREADY_SPAWNED
VEHICLE_PLATE_CONFLICT

TERRITORY_NOT_CONTESTABLE
TERRITORY_ALREADY_OWNED

HOUSING_NOT_OWNED
HOUSING_ACCESS_DENIED

ADMIN_PERMISSION_DENIED
ADMIN_ALREADY_BANNED

VALIDATION_SCHEMA_ERROR
RATE_LIMIT_EXCEEDED
INTERNAL_ERROR
```

---

## SDK API Conventions

### Lua SDK Pattern

```lua
-- Namespace: ATC.SDK.{Domain}.{Action}
-- All methods return (result, error)

-- Player
local player, err = ATC.SDK.Player.Get(source)
local player, err = ATC.SDK.Player.GetByIdentifier('license:abc123')
local player, err = ATC.SDK.Player.GetByCharacterId('01HXZ...')
local ok, err     = ATC.SDK.Player.Update(characterId, { health = 200 })
local ok, err     = ATC.SDK.Player.Kick(source, 'reason')

-- Inventory
local inv, err    = ATC.SDK.Inventory.Get(characterId)
local count, err  = ATC.SDK.Inventory.GetItemCount(characterId, 'water_bottle')
local ok, err     = ATC.SDK.Inventory.AddItem(characterId, 'water_bottle', 1, {})
local ok, err     = ATC.SDK.Inventory.RemoveItem(characterId, 'water_bottle', 1)
local ok, err     = ATC.SDK.Inventory.HasItem(characterId, 'water_bottle', 1)

-- Economy
local bal, err    = ATC.SDK.Economy.GetBalance(characterId, 'cash')
local ok, err     = ATC.SDK.Economy.Transfer(fromId, toId, amount, 'cash', 'reason')
local ok, err     = ATC.SDK.Economy.AddMoney(characterId, amount, 'cash', 'source')
local ok, err     = ATC.SDK.Economy.RemoveMoney(characterId, amount, 'cash', 'reason')

-- Vehicle
local vehicles, err = ATC.SDK.Vehicle.GetOwned(characterId)
local ok, err       = ATC.SDK.Vehicle.Spawn(plate, coords, heading)
local ok, err       = ATC.SDK.Vehicle.Impound(plate, reason)

-- Territory
local zone, err   = ATC.SDK.Territory.GetByCoords(coords)
local owner, err  = ATC.SDK.Territory.GetOwner(territoryId)

-- Dispatch
local ok, err     = ATC.SDK.Dispatch.CreateCall(type, coords, description, metadata)

-- Admin
local ok, err     = ATC.SDK.Admin.Ban(identifier, reason, duration, adminId, evidence)
local ok, err     = ATC.SDK.Admin.Kick(source, reason, adminId)
local ok, err     = ATC.SDK.Admin.Warn(identifier, reason, adminId)
```

### Error Handling Pattern

```lua
-- Always check for error
local player, err = ATC.SDK.Player.Get(source)
if err then
    ATC.Core.Log.Error('Failed to get player', { source = source, error = err })
    return
end

-- Or use the callback style (for async operations)
ATC.SDK.Inventory.AddItem(characterId, 'water_bottle', 1, {}, function(ok, err)
    if not ok then
        -- handle error
    end
end)
```

### TypeScript SDK Pattern

```typescript
import { ATCPlayer, ATCInventory, ATCEconomy } from '@atc/sdk'

// All methods are async and throw typed errors
try {
    const player = await ATCPlayer.getBySource(source)
    const inventory = await ATCInventory.get(player.characterId)
    await ATCInventory.addItem(player.characterId, 'water_bottle', 1, {})
    await ATCEconomy.transfer(fromId, toId, 500, 'cash', 'purchase')
} catch (err) {
    if (err instanceof ATCError) {
        console.error(err.code, err.message, err.details)
    }
}
```

---

## Pagination

All list endpoints support pagination:

```
GET /api/v1/players?page=1&pageSize=50
GET /api/v1/economy/{id}/transactions?page=2&pageSize=25&sortBy=created_at&sortDir=desc
```

Response meta:
```json
{
  "meta": {
    "page": 2,
    "pageSize": 25,
    "total": 1248,
    "totalPages": 50
  }
}
```

---

## Server-to-Server Authentication

FiveM → API communication uses a shared server token:

```
Authorization: Bearer {ATC_SERVER_TOKEN}
```

- Token is set in environment variables (never in code)
- Token rotates daily in production
- Each token is scoped to a specific server instance
- All requests without a valid token return 401

---

## API Rate Limits

| Endpoint Group | Limit | Window |
|---|---|---|
| GET endpoints | 1000 req | 60s |
| Inventory mutations | 100 req | 60s |
| Economy mutations | 50 req | 60s |
| Admin endpoints | 200 req | 60s |
| Auth endpoints | 10 req | 60s |

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1716000060
```

---

## API Changelog Process

1. Add new fields: additive, no version bump
2. Rename/remove fields: version bump required
3. Change response shape: version bump required
4. New endpoint: no version bump (additive)
5. Remove endpoint: version bump + 2-release deprecation

All changes logged in `CHANGELOG.md` per `keepachangelog.com` format.
