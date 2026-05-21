# SDK Structure

## Overview

The ATC SDK is the unified interface for all game logic. It exists in two forms:

1. **Lua SDK** — used by FiveM server/client scripts (plugins, bridges)
2. **TypeScript SDK** — used by `apps/api` services and build tools

Both SDKs expose the same conceptual API. The Lua SDK communicates with the API via HTTP. The TypeScript SDK operates directly within the API process.

---

## SDK Principles

- **One interface** — plugin authors learn one API, not the underlying architecture
- **Error-first** — every call returns `(result, error)` in Lua; throws typed errors in TS
- **No internal details** — the SDK hides whether data comes from Redis, MariaDB, or in-memory
- **Versioned** — SDK version matches API version; breaking changes are major bumps
- **Permission-checked** — every SDK call checks calling plugin's declared permissions

---

## Lua SDK

### Location
```
packages/sdk/lua/
├── ATC/
│   ├── SDK.lua              ← Entry point, namespace setup
│   ├── Core.lua             ← Event Bus, Plugin Registry, Logging
│   ├── Player.lua           ← Player/character operations
│   ├── Inventory.lua        ← Item/stash operations
│   ├── Economy.lua          ← Currency/transaction operations
│   ├── Vehicle.lua          ← Vehicle operations
│   ├── Housing.lua          ← Property operations
│   ├── Territory.lua        ← Zone/ownership operations
│   ├── Dispatch.lua         ← Emergency dispatch
│   ├── Social.lua           ← Groups/factions/friends
│   ├── Admin.lua            ← Admin operations
│   └── _http.lua            ← Internal HTTP client (not public)
└── init.lua                 ← Auto-loaded by fxmanifest
```

### SDK.lua (Entry Point)

```lua
-- packages/sdk/lua/ATC/SDK.lua

ATC = ATC or {}
ATC.SDK = ATC.SDK or {}
ATC.SDK._version = '1.0.0'
ATC.SDK._apiVersion = '1'
ATC.SDK._initialized = false

--- Load all SDK modules
local modules = {
    'ATC/Core',
    'ATC/Player',
    'ATC/Inventory',
    'ATC/Economy',
    'ATC/Vehicle',
    'ATC/Housing',
    'ATC/Territory',
    'ATC/Dispatch',
    'ATC/Social',
    'ATC/Admin',
}

for _, module in ipairs(modules) do
    ATC.SDK[module] = require(module)
end

ATC.SDK._initialized = true
```

### Player.lua (Example Module)

```lua
-- packages/sdk/lua/ATC/Player.lua

ATC.SDK.Player = {}

--- Get player data by source (server source/net ID)
--- @param source number FiveM player source
--- @return table|nil player, string|nil error
function ATC.SDK.Player.Get(source)
    if not source or type(source) ~= 'number' then
        return nil, 'INVALID_SOURCE'
    end

    -- Check Redis session cache first
    local cached = ATC.SDK._Cache.Get('player:source:' .. source)
    if cached then return cached, nil end

    -- Call API
    local res, err = ATC.SDK._Http.Get('/api/v1/players/by-source/' .. source)
    if err then return nil, err end

    -- Cache the result
    ATC.SDK._Cache.Set('player:source:' .. source, res.data, 30)

    return res.data, nil
end

--- Get player by identifier
--- @param identifier string License/Discord identifier
--- @return table|nil player, string|nil error
function ATC.SDK.Player.GetByIdentifier(identifier)
    local res, err = ATC.SDK._Http.Get('/api/v1/players/' .. identifier)
    if err then return nil, err end
    return res.data, nil
end

--- Check if a player is online
--- @param characterId string UUID v7
--- @return boolean
function ATC.SDK.Player.IsOnline(characterId)
    local cached = ATC.SDK._Cache.Get('player:online:' .. characterId)
    return cached == true
end

--- Update player data
--- @param characterId string UUID v7
--- @param data table Fields to update
--- @return boolean ok, string|nil error
function ATC.SDK.Player.Update(characterId, data)
    local res, err = ATC.SDK._Http.Patch(
        '/api/v1/players/' .. characterId,
        data
    )
    if err then return false, err end
    return true, nil
end
```

### Inventory.lua (Example Module)

```lua
-- packages/sdk/lua/ATC/Inventory.lua

ATC.SDK.Inventory = {}

--- Get a player's full inventory
function ATC.SDK.Inventory.Get(characterId)
    local res, err = ATC.SDK._Http.Get('/api/v1/inventory/' .. characterId)
    if err then return nil, err end
    return res.data, nil
end

--- Add item to player inventory
--- @param characterId string
--- @param itemName string Item definition name
--- @param quantity number
--- @param metadata table Optional metadata
--- @return boolean ok, string|nil error
function ATC.SDK.Inventory.AddItem(characterId, itemName, quantity, metadata)
    local res, err = ATC.SDK._Http.Post('/api/v1/inventory/' .. characterId .. '/add', {
        itemName = itemName,
        quantity = quantity or 1,
        metadata = metadata or {}
    })
    if err then return false, err end
    return true, nil
end

--- Remove item from player inventory
function ATC.SDK.Inventory.RemoveItem(characterId, itemName, quantity)
    local res, err = ATC.SDK._Http.Post('/api/v1/inventory/' .. characterId .. '/remove', {
        itemName = itemName,
        quantity = quantity or 1
    })
    if err then return false, err end
    return true, nil
end

--- Check if player has item (at least quantity)
function ATC.SDK.Inventory.HasItem(characterId, itemName, quantity)
    local inv, err = ATC.SDK.Inventory.Get(characterId)
    if err then return false end
    quantity = quantity or 1
    local count = 0
    for _, item in ipairs(inv.items) do
        if item.name == itemName then
            count = count + item.quantity
        end
    end
    return count >= quantity
end

--- Get count of specific item
function ATC.SDK.Inventory.GetItemCount(characterId, itemName)
    local inv, err = ATC.SDK.Inventory.Get(characterId)
    if err then return 0, err end
    local count = 0
    for _, item in ipairs(inv.items) do
        if item.name == itemName then
            count = count + item.quantity
        end
    end
    return count, nil
end
```

---

## TypeScript SDK

### Location
```
packages/sdk/typescript/
├── src/
│   ├── index.ts             ← Public exports
│   ├── player.ts
│   ├── inventory.ts
│   ├── economy.ts
│   ├── vehicle.ts
│   ├── housing.ts
│   ├── territory.ts
│   ├── dispatch.ts
│   ├── admin.ts
│   ├── errors.ts            ← Typed error classes
│   └── types/
│       ├── player.types.ts
│       ├── inventory.types.ts
│       ├── economy.types.ts
│       └── ...
└── package.json
```

### errors.ts

```typescript
export class ATCError extends Error {
    constructor(
        public readonly code: string,
        message: string,
        public readonly details?: Record<string, unknown>
    ) {
        super(message)
        this.name = 'ATCError'
    }
}

export class ATCNotFoundError extends ATCError {}
export class ATCPermissionError extends ATCError {}
export class ATCValidationError extends ATCError {}
export class ATCBusinessRuleError extends ATCError {}
export class ATCConflictError extends ATCError {}
```

### player.ts

```typescript
import { ATCError, ATCNotFoundError } from './errors'
import type { Player, Character, CreateCharacterDto } from './types/player.types'
import { PlayerRepository } from '@atc/db'
import { redis } from '@atc/cache'

export class ATCPlayerSDK {
    constructor(private readonly repo: PlayerRepository) {}

    async getBySource(source: number): Promise<Player> {
        const cached = await redis.get<Player>(`atc:player:source:${source}`)
        if (cached) return cached

        const player = await this.repo.findBySource(source)
        if (!player) throw new ATCNotFoundError('PLAYER_NOT_FOUND', `Player with source ${source} not found`)

        await redis.set(`atc:player:source:${source}`, player, { ex: 30 })
        return player
    }

    async getByIdentifier(identifier: string): Promise<Player> {
        return this.repo.findByIdentifier(identifier)
            .then(p => {
                if (!p) throw new ATCNotFoundError('PLAYER_NOT_FOUND', `Player ${identifier} not found`)
                return p
            })
    }

    async createCharacter(playerId: string, data: CreateCharacterDto): Promise<Character> {
        const existing = await this.repo.countCharacters(playerId)
        if (existing >= 3) {
            throw new ATCBusinessRuleError(
                'PLAYER_CHARACTER_LIMIT_REACHED',
                'Maximum characters reached',
                { limit: 3, current: existing }
            )
        }
        return this.repo.createCharacter(playerId, data)
    }
}
```

---

## SDK Registration in FiveM

```lua
-- fivem/[atc-sdk]/fxmanifest.lua

fx_version 'cerulean'
game 'gta5'

name '[atc-sdk]'
description 'ATC SDK — Atlantic Core'
version '1.0.0'
author 'Atlantic Community'

shared_scripts {
    'ATC/SDK.lua',
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',  -- DB if needed server-side
}

-- Exports for other resources (read-only SDK surface)
exports {
    'GetSDKVersion',
    'GetPlayer',
    -- etc.
}
```

---

## SDK Extension by Plugins

Plugins can extend the SDK with their own namespace:

```lua
-- plugins/atc-inventory/server/index.lua

-- Register plugin's public API on the SDK
ATC.SDK.RegisterExtension('Inventory', {
    GetPlayerWeight = function(characterId)
        -- Implementation
    end,
    GetCraftingRecipes = function()
        -- Implementation
    end
})

-- Now other plugins can call:
-- ATC.SDK.Inventory.GetPlayerWeight(characterId)
-- ATC.SDK.Inventory.GetCraftingRecipes()
```

---

## SDK Versioning

```
SDK Version: 1.0.0
  Major: Breaking change to public API
  Minor: New methods added (backwards compatible)
  Patch: Bug fixes

API Version: v1
  Bumped only on REST API breaking changes
  SDK targets a specific API version
```

If a plugin's `apiVersion` in manifest is `"1"` and the SDK exposes `v2`, the compatibility layer translates calls. After two major versions, old API versions are dropped.
