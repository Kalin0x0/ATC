# ATC Plugin Development Guide

Atlantic Core (ATC) plugin development guide for first- and third-party plugin authors.
Covers plugin structure, SDK usage, event conventions, security, NUI patterns,
economy integration, and publishing.

---

## 1. Plugin Structure

Every ATC plugin is a self-contained FiveM resource with an ATC manifest file.
The minimum required layout:

```
plugins/atc-example-shop/
├── atc.manifest.json     ← ATC plugin registry metadata (required)
├── fxmanifest.lua        ← FiveM resource manifest (required)
├── server/
│   └── init.lua          ← Server-side logic
├── client/
│   └── init.lua          ← Client-side logic
├── shared/
│   └── config.lua        ← Shared constants / config (optional)
├── api/
│   └── index.ts          ← TypeScript REST extension (optional)
└── ui/
    └── index.tsx         ← React NUI component (optional)
```

### atc.manifest.json

```json
{
  "id": "atc-example-shop",
  "name": "ATC Example Shop",
  "version": "0.1.0",
  "description": "Reference implementation: NPC shop using ATC SDK",
  "author": "Atlantic Community",
  "license": "MIT",
  "atcMinVersion": "0.1.0",
  "dependencies": ["atc-core"],
  "permissions": ["economy:charge", "inventory:write"],
  "events": {
    "emits":     ["atc:example_shop:catalog:response", "atc:example_shop:buy:result"],
    "listensTo": ["atc:example_shop:catalog", "atc:example_shop:buy"]
  }
}
```

| Field          | Required | Description                                                 |
|----------------|----------|-------------------------------------------------------------|
| `id`           | Yes      | Unique kebab-case identifier, e.g. `atc-my-plugin`         |
| `name`         | Yes      | Human-readable display name                                 |
| `version`      | Yes      | Semantic version (MAJOR.MINOR.PATCH)                        |
| `description`  | Yes      | One-sentence summary                                        |
| `atcMinVersion`| Yes      | Minimum ATC core version required                           |
| `dependencies` | Yes      | Array of plugin ids that must load first                    |
| `permissions`  | No       | Declared capability requirements (reviewed on publish)      |
| `events.emits` | No       | Events this plugin fires (for documentation / audit)        |
| `events.listensTo` | No   | Events this plugin handles                                  |

### fxmanifest.lua

```lua
fx_version 'cerulean'
game      'gta5'
lua54     'yes'

name        'atc-example-shop'
description 'ATC Example Shop — reference plugin'
version     '0.1.0'

dependency  'atc-core'

shared_scripts {
    'shared/config.lua',
}

server_scripts {
    'server/init.lua',
}

client_scripts {
    'client/init.lua',
}

-- NUI (optional)
ui_page 'ui/index.html'
files {
    'ui/index.html',
    'ui/css/*.css',
    'ui/js/*.js',
}
```

---

## 2. Using ATC.SDK.*

ATC exposes its SDK through two surfaces: server-side Lua globals (injected by `atc-core`)
and the `exports['atc-sdk']` FiveM export table for external resources.

### Server-side (Lua)

`ATC` is a global table available in every plugin that lists `atc-core` as a dependency.

```lua
-- Resolve a session
local session = ATC.Sessions.Get(source)           -- returns session table or nil
local charId  = ATC.Sessions.GetCharacterId(source) -- UUID string or nil
local all     = ATC.Sessions.GetAll()              -- table of all active sessions

-- Principal / account
local principalId = ATC.Accounts.GetPrincipalId(source) -- Discord/license ID

-- Outbound HTTP to the ATC API
ATC.HTTP.Get('/api/v1/players/'..charId, function(data, status) end)
ATC.HTTP.Post('/api/v1/inventory/add', { characterId=charId, itemName='water_bottle', quantity=1 }, function(data) end)
ATC.HTTP.Patch('/api/v1/players/'..charId, { health=100 }, function(data) end)
ATC.HTTP.Delete('/api/v1/sessions/'..sessionId, function(data) end)

-- Economy
ATC.Economy.Credit(charId, 500, 'cash',  'mission_reward', function(ok, wallet) end)
ATC.Economy.Debit (charId, 200, 'cash',  'item_purchase',  function(ok, wallet) end)
ATC.Economy.Transfer(fromId, toId, 300, 'cash', 'player_trade', function(ok) end)

-- Economy plugin helpers (wraps principal resolution internally)
ATC.EconomyPlugin.Pay   (source, amount, reason, cb)  -- credit player's wallet
ATC.EconomyPlugin.Charge(source, amount, reason, cb)  -- debit player's wallet

-- Logging
ATC.Log.Info    ('my-plugin', 'message', { key='value' })
ATC.Log.Warn    ('my-plugin', 'message', { key='value' })
ATC.Log.Error   ('my-plugin', 'message', { key='value' })
ATC.Log.Security('my-plugin', 'message', { key='value' })
ATC.Log.Debug   ('my-plugin', 'message', { key='value' })  -- only emits when ATC.Config.Debug = true

-- Vitals & status effects
ATC.Vitals.Sync(source)        -- push latest vitals to client
ATC.StatusEffects.Sync(source) -- push status effects to client
```

### Client-side (Lua)

Client SDK is available as the global `ATC.SDK` after `atc-core` client scripts have loaded.

```lua
-- Player / session
local ready    = ATC.SDK.Player.IsReady()       -- boolean
local char     = ATC.SDK.Player.GetCharacter()  -- character table or nil
local sessionId= ATC.SDK.Player.GetSessionId()  -- UUID or nil

-- Vitals
local vitals  = ATC.SDK.Vitals.Get()            -- { health, hunger, thirst, stress }
local hp      = ATC.SDK.Vitals.GetHealth()
local hunger  = ATC.SDK.Vitals.GetHunger()
local thirst  = ATC.SDK.Vitals.GetThirst()

-- Inventory
local inv     = ATC.SDK.Inventory.Get()         -- array of item entries
local hasWater= ATC.SDK.Inventory.HasItem('water_bottle') -- boolean

-- Economy
local wallet  = ATC.SDK.Economy.GetWallet()     -- { cash, bank }
local cash    = ATC.SDK.Economy.GetCash()
local bank    = ATC.SDK.Economy.GetBank()

-- Jobs
local job     = ATC.SDK.Jobs.GetActive()        -- active job table or nil
local onDuty  = ATC.SDK.Jobs.IsOnDuty()         -- boolean

-- Combat
local isDead  = ATC.SDK.Combat.IsDead()         -- boolean

-- Vehicles
local inVehicle = ATC.SDK.Vehicles.IsInVehicle() -- boolean
local vehState  = ATC.SDK.Vehicles.GetState()    -- vehicle state table or nil

-- Interaction zones
ATC.Interaction.RegisterZone(id, coords, radius, label, onEnterCb)
ATC.Interaction.RegisterEntity(id, entityHandle, label, onInteractCb)
ATC.Interaction.Remove(id)

-- Emotes
ATC.Emotes.Play('wave')
ATC.Emotes.Stop()
local playing = ATC.Emotes.IsPlaying()

-- Voice
ATC.Voice.JoinChannel('faction_radio', { key=0x49 })
ATC.Voice.LeaveChannel('faction_radio')
local talking = ATC.Voice.IsTalking()
```

### exports['atc-sdk'] (cross-resource)

For resources that cannot list `atc-core` as a Lua dependency, the SDK is also
available via FiveM exports.

**Server:**
```lua
local sdk     = exports['atc-sdk']
local charId  = sdk:GetCharacterId(source)
local session = sdk:GetSession(source)
```

**Client:**
```lua
local sdk    = exports['atc-sdk']
local char   = sdk:GetCharacter()
local wallet = sdk:GetWallet()
```

---

## 3. Event Naming Convention

All ATC events follow the pattern:

```
atc:{plugin_id}:{noun}:{verb}
```

| Segment    | Rules                                                         | Example           |
|------------|---------------------------------------------------------------|-------------------|
| `atc`      | Always the literal prefix `atc`                               | `atc`             |
| `plugin_id`| Snake-case plugin identifier (hyphens replaced with `_`)      | `example_shop`    |
| `noun`     | The entity or resource the event concerns                     | `catalog`, `buy`  |
| `verb`     | Past/present tense action or lifecycle word                   | `request`, `result`, `response` |

```lua
-- Good
'atc:example_shop:catalog:request'
'atc:example_shop:buy:result'
'atc:inventory:item:added'
'atc:economy:transaction:completed'

-- Bad — never do these
'ExampleShop:Buy'           -- no prefix, PascalCase
'atc_example_shop_buy'      -- underscores throughout
'atc:shop:purchaseItem'     -- camelCase in segment
```

### Registration

```lua
-- Server: declare before use
RegisterNetEvent('atc:example_shop:buy')

-- Client: declare before use
RegisterNetEvent('atc:example_shop:buy:result')
AddEventHandler ('atc:example_shop:buy:result', function(data) ... end)
```

---

## 4. Firewall Usage (ATC.Firewall.On)

Every server event that accepts client input MUST be wrapped in `ATC.Firewall.On`.
The firewall validates sessions, enforces rate limits, and logs violations automatically.

```lua
ATC.Firewall.On(eventName, options, handler)
```

| Option          | Type    | Default | Description                                              |
|-----------------|---------|---------|----------------------------------------------------------|
| `clientAllowed` | boolean | false   | Allow this event to be triggered by clients              |
| `requireSession`| boolean | true    | Reject if source has no active ATC session               |
| `rateLimit`     | table   | nil     | `{ window = <ms>, max = <count> }`                       |
| `minCooldown`   | number  | nil     | Hard per-player cooldown in ms (overrides rateLimit)     |

```lua
-- Catalog request: clients may call, max 5 per 5 seconds
ATC.Firewall.On('atc:example_shop:catalog', {
    clientAllowed = true,
    requireSession = true,
    rateLimit = { window = 5000, max = 5 },
}, function(src)
    TriggerClientEvent('atc:example_shop:catalog:response', src, ITEMS)
end)

-- Purchase: tighter limits to prevent abuse
ATC.Firewall.On('atc:example_shop:buy', {
    clientAllowed = true,
    requireSession = true,
    rateLimit = { window = 2000, max = 10 },
}, function(src, payload)
    -- Always sanitize payload — never trust raw client data
    local itemId = type(payload) == 'table'
        and tostring(payload.itemId or ''):sub(1, 64)
        or ''
    -- ... business logic
end)
```

Firewall violations are automatically emitted to `ATC.Log.Security` and counted
in the player's risk score. Repeated violations will trigger automatic lockdown.

---

## 5. NUI Pattern

### Server to Client to NUI

```
Server ──TriggerClientEvent──► Client ──SendNUIMessage──► NUI (browser)
```

### Sending data to NUI

```lua
-- client/init.lua
SendNUIMessage({
    type    = 'ATC_NOTIFICATION',
    payload = {
        message  = 'Purchase successful',
        level    = 'success',   -- 'info' | 'success' | 'warn' | 'error'
        duration = 3000,
    }
})

-- Open a custom UI panel
SendNUIMessage({
    type    = 'SHOP_OPEN',
    payload = { items = items },
})

-- Close
SendNUIMessage({ type = 'SHOP_CLOSE' })
```

### Receiving callbacks from NUI

```lua
-- client/init.lua
RegisterNUICallback('shop_buy', function(data, cb)
    -- data comes from NUI JavaScript: nuiCallback('shop_buy', { itemId: 'water_bottle' })
    TriggerServerEvent('atc:example_shop:buy', { itemId = data.itemId })
    cb({ ok = true })  -- must always call cb to unblock the NUI fetch
end)

RegisterNUICallback('shop_close', function(_, cb)
    SetNuiFocus(false, false)
    SendNUIMessage({ type = 'SHOP_CLOSE' })
    cb({})
end)
```

### Focus management

```lua
-- Open UI: give focus to NUI
SetNuiFocus(true, true)

-- Close UI: return focus to game
SetNuiFocus(false, false)
```

Always release NUI focus when the player presses Escape or moves away from an interaction zone.

### NUI JavaScript side (ui/js/shop.js)

```javascript
window.addEventListener('message', (event) => {
    const { type, payload } = event.data
    if (type === 'SHOP_OPEN') renderShop(payload.items)
    if (type === 'SHOP_CLOSE') hideShop()
})

async function buyItem(itemId) {
    const res = await fetch(`https://atc-example-shop/shop_buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId }),
    })
    const data = await res.json()
    if (!data.ok) console.error('buy failed')
}
```

---

## 6. Economy Integration

### Charge a player (debit)

```lua
local principalId = ATC.Accounts.GetPrincipalId(src)
if not principalId then return end

ATC.EconomyPlugin.Charge(src, 150, 'shop_burger', function(ok, walletData)
    if not ok then
        TriggerClientEvent('atc:example_shop:buy:result', src, {
            success = false, reason = 'insufficient_funds'
        })
        return
    end
    -- Proceed with item delivery
end)
```

### Pay a player (credit)

```lua
ATC.EconomyPlugin.Pay(src, 500, 'mission_reward', function(ok, walletData)
    if ok then
        ATC.Log.Info('my-plugin', 'Player paid', { source = src, amount = 500 })
    end
end)
```

### Direct economy (character ID required)

```lua
local charId = ATC.Sessions.GetCharacterId(src)
ATC.Economy.Credit(charId, 100, 'cash', 'bonus', function(ok, wallet) end)
ATC.Economy.Debit (charId, 50,  'cash', 'fee',   function(ok, wallet) end)
ATC.Economy.Transfer(fromCharId, toCharId, 200, 'cash', 'trade', function(ok) end)
```

---

## 7. Example Plugin — atc-example-shop

A complete, working reference plugin demonstrating all patterns above.

### File tree

```
plugins/atc-example-shop/
├── atc.manifest.json
├── fxmanifest.lua
├── server/init.lua
└── client/init.lua
```

### server/init.lua

```lua
ATC = ATC or {}

local ITEMS = {
    { id='water_bottle', name='Water Bottle', price=50,  description='Restores thirst' },
    { id='burger',       name='Burger',       price=150, description='Restores hunger' },
    { id='bandage',      name='Bandage',      price=200, description='Restores 15 HP'  },
}

local SHOP_COORDS = vector3(24.47, -1346.64, 29.5)

-- Catalog request
ATC.Firewall.On('atc:example_shop:catalog', {
    clientAllowed = true, requireSession = true,
    rateLimit = { window = 5000, max = 5 },
}, function(src)
    TriggerClientEvent('atc:example_shop:catalog:response', src, ITEMS)
end)

-- Purchase
ATC.Firewall.On('atc:example_shop:buy', {
    clientAllowed = true, requireSession = true,
    rateLimit = { window = 2000, max = 10 },
}, function(src, payload)
    local itemId = type(payload) == 'table'
        and tostring(payload.itemId or ''):sub(1, 64) or ''

    local item
    for _, i in ipairs(ITEMS) do
        if i.id == itemId then item = i; break end
    end

    if not item then
        TriggerClientEvent('atc:example_shop:buy:result', src,
            { success = false, reason = 'not_found' })
        return
    end

    local principalId = ATC.Accounts.GetPrincipalId(src)
    if not principalId then return end

    ATC.EconomyPlugin.Charge(src, item.price, 'shop_'..itemId, function(ok, walletData)
        if not ok then
            TriggerClientEvent('atc:example_shop:buy:result', src,
                { success = false, reason = 'insufficient_funds' })
            return
        end
        local characterId = ATC.Sessions.GetCharacterId(src)
        if characterId then
            ATC.HTTP.Post('/api/v1/inventory/add', {
                characterId = characterId,
                itemName    = itemId,
                quantity    = 1,
                metadata    = {},
            }, function() end)
        end
        TriggerClientEvent('atc:example_shop:buy:result', src,
            { success = true, item = item, wallet = walletData })
    end)
end)
```

### client/init.lua

```lua
local _inRange  = false
local _shopOpen = false
local SHOP_COORDS = vector3(24.47, -1346.64, 29.5)

CreateThread(function()
    while true do
        local dist = #(GetEntityCoords(PlayerPedId()) - SHOP_COORDS)
        if dist < 3.0 and not _inRange then
            _inRange = true
            ATC.Interaction.RegisterZone('example_shop', SHOP_COORDS, 3.0,
                '24/7 Shop', function()
                    _shopOpen = true
                    TriggerServerEvent('atc:example_shop:catalog')
                    SetNuiFocus(true, true)
                    SendNUIMessage({
                        type    = 'ATC_NOTIFICATION',
                        payload = { message = 'Shop opened', level = 'info', duration = 2000 }
                    })
                end)
        elseif dist >= 3.0 and _inRange then
            _inRange = false
            ATC.Interaction.Remove('example_shop')
        end
        Wait(500)
    end
end)

for _, e in ipairs({'atc:example_shop:catalog:response','atc:example_shop:buy:result'}) do
    RegisterNetEvent(e)
end

AddEventHandler('atc:example_shop:catalog:response', function(items)
    local names = {}
    for _, i in ipairs(items or {}) do table.insert(names, i.name) end
    SendNUIMessage({
        type    = 'ATC_NOTIFICATION',
        payload = { message = 'Shop: '..table.concat(names, ', '), level = 'info', duration = 5000 }
    })
end)

AddEventHandler('atc:example_shop:buy:result', function(data)
    if data and data.success then
        SendNUIMessage({
            type    = 'ATC_NOTIFICATION',
            payload = { message = 'Bought: '..tostring(data.item and data.item.name or 'item'),
                        level = 'success', duration = 3000 }
        })
    else
        SendNUIMessage({
            type    = 'ATC_NOTIFICATION',
            payload = { message = 'Cannot buy: '..(data and data.reason or 'error'),
                        level = 'error', duration = 3000 }
        })
    end
end)
```

---

## 8. Security Checklist

Every plugin PR must pass this checklist before merge.

- [ ] No client-trusted values used in server logic — always sanitize payload fields
- [ ] All server events wrapped in `ATC.Firewall.On` with appropriate rate limits
- [ ] Input validated (type checks, length caps, enum membership checks)
- [ ] Sensitive operations (economy, inventory writes) logged with `ATC.Log.Security`
- [ ] No direct SQL; all DB access through the ATC HTTP API or repository layer
- [ ] No hardcoded credentials or connection strings
- [ ] No hardcoded UI strings — use i18n translation keys
- [ ] `requireSession = true` on all player-facing Firewall events
- [ ] `TriggerServerEvent` calls made only from within Firewall handlers
- [ ] No `TriggerEvent` (server→server) for cross-plugin communication — use Event Bus

### Common mistakes

```lua
-- WRONG: trusting client amount
ATC.Firewall.On('atc:shop:buy', {clientAllowed=true}, function(src, payload)
    local price = payload.price  -- client can send 0!
    ATC.EconomyPlugin.Charge(src, price, 'shop', cb)
end)

-- RIGHT: server owns the price
ATC.Firewall.On('atc:shop:buy', {clientAllowed=true, requireSession=true,
    rateLimit={window=2000,max=10}}, function(src, payload)
    local itemId = type(payload)=='table' and tostring(payload.itemId or ''):sub(1,64) or ''
    local item = ITEMS[itemId]  -- look up server-authoritative price
    if not item then return end
    ATC.EconomyPlugin.Charge(src, item.price, 'shop_'..itemId, cb)
end)
```

---

## 9. Publishing

### Version numbering

ATC plugins follow semantic versioning:

| Increment | When                                               |
|-----------|----------------------------------------------------|
| MAJOR     | Breaking change to events, schema, or public API   |
| MINOR     | New feature, backward compatible                   |
| PATCH     | Bug fix, no API change                             |

### atc.manifest.json required publish fields

```json
{
  "id":           "atc-my-plugin",
  "name":         "My Plugin",
  "version":      "1.0.0",
  "description":  "One sentence",
  "author":       "Your name or org",
  "license":      "MIT",
  "atcMinVersion":"0.1.0",
  "dependencies": ["atc-core"],
  "permissions":  ["economy:charge"]
}
```

### Submission checklist

1. All `atc.manifest.json` required fields present
2. `fxmanifest.lua` lists `dependency 'atc-core'`
3. Security checklist passed (section 8)
4. All events declared in `atc.manifest.json` events block
5. README or inline comments explaining non-obvious behavior
6. No test/debug code left in production paths (`ATC.Config.Debug` gates are fine)
7. Version bumped appropriately for the change set

---

## Quick Reference Card

```lua
-- Session
ATC.Sessions.Get(src)               -- session table
ATC.Sessions.GetCharacterId(src)    -- UUID
ATC.Accounts.GetPrincipalId(src)    -- principal string

-- Economy
ATC.EconomyPlugin.Charge(src, amt, reason, cb)
ATC.EconomyPlugin.Pay   (src, amt, reason, cb)

-- Firewall
ATC.Firewall.On(event, { clientAllowed=true, requireSession=true,
    rateLimit={window=2000,max=10} }, handler)

-- Logging
ATC.Log.Info('plugin-id', 'msg', {})
ATC.Log.Security('plugin-id', 'suspicious action', { src=src })

-- Vitals / status
ATC.Vitals.Sync(src)
ATC.StatusEffects.Sync(src)

-- HTTP to API
ATC.HTTP.Post('/api/v1/inventory/add', payload, cb)
ATC.HTTP.Get ('/api/v1/players/'..id, cb)
```
