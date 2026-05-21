# Compatibility Bridge Architecture

## Purpose

Compatibility bridges allow existing scripts written for QBCore, ESX, Qbox, or ND Core to run on ATC **without modification**. Bridges are completely optional — servers that don't need legacy script support don't load them.

**Bridges are a compatibility layer, not an integration layer.** ATC internals never use bridge code.

---

## Architecture Principle

```
Legacy Script                Bridge               ATC SDK
─────────────               ───────              ────────
exports['qb-core']   ──►   intercept   ──►   ATC.SDK.Player.Get()
:GetPlayer()                translate           ATC.SDK.Inventory.Get()
                             adapt                   │
                             return               MariaDB / Redis
QB-formatted data   ◄──    QB format   ◄──   ATC-formatted data
```

The bridge:
1. Intercepts the legacy API call
2. Translates parameters to ATC format
3. Calls the ATC SDK
4. Translates the response back to the legacy format
5. Returns to the calling script

---

## Bridge Isolation Rules

1. Bridges live exclusively in `bridges/` — never in `packages/` or `plugins/`
2. Bridges have **zero internal ATC package dependencies** (no `@atc/*` imports)
3. Bridges communicate with ATC only through the Lua SDK (`ATC.SDK.*`)
4. Bridges must declare `dependency '[atc-sdk]'` in fxmanifest.lua
5. If ATC SDK changes, bridges update — not the other way around
6. Bridges are versioned separately from ATC core

---

## QBCore Bridge

### Directory
```
bridges/qbcore-bridge/
├── atc.manifest.json          ← Bridge manifest
├── fxmanifest.lua
├── server/
│   ├── index.lua              ← Main bridge entry
│   ├── player.lua             ← Player API translation
│   ├── inventory.lua          ← Item API translation
│   ├── economy.lua            ← Economy API translation
│   ├── jobs.lua               ← Job API translation
│   ├── gangs.lua              ← Gang API translation
│   └── events.lua             ← QB event translation
├── client/
│   ├── index.lua
│   └── events.lua
└── shared/
    └── config.lua
```

### Player Translation

```lua
-- bridges/qbcore-bridge/server/player.lua
-- Intercepts QBCore.Functions.GetPlayer(source)

local QBCore = {}
QBCore.Functions = {}

-- The bridge registers as 'qb-core' export to intercept calls
function QBCore.Functions.GetPlayer(source)
    local player, err = ATC.SDK.Player.Get(source)
    if not player then return nil end

    -- Return QB-formatted player object
    return {
        PlayerData = {
            source = source,
            identifier = player.identifier,
            license = player.license,
            name = player.characterName,
            money = {
                cash = player.cashBalance,
                bank = player.bankBalance,
                crypto = player.cryptoBalance or 0
            },
            job = {
                name = player.job.name,
                label = player.job.label,
                type = player.job.type or 'none',
                grade = {
                    level = player.job.grade,
                    name = player.job.gradeName
                },
                onduty = player.isOnDuty
            },
            gang = {
                name = player.gang and player.gang.name or 'none',
                label = player.gang and player.gang.label or 'None',
                grade = {
                    level = player.gang and player.gang.grade or 0,
                    name = player.gang and player.gang.gradeName or 'none'
                }
            },
            metadata = player.metadata or {},
            position = player.lastPosition,
            charinfo = {
                firstname = player.firstName,
                lastname = player.lastName,
                birthdate = player.birthdate,
                nationality = player.nationality
            }
        },

        -- QB method shims
        Functions = {
            AddMoney = function(self, moneyType, amount, reason)
                ATC.SDK.Economy.AddMoney(player.characterId, amount, moneyType, reason or 'qb_compat')
            end,
            RemoveMoney = function(self, moneyType, amount, reason)
                ATC.SDK.Economy.RemoveMoney(player.characterId, amount, moneyType, reason or 'qb_compat')
            end,
            GetMoney = function(self, moneyType)
                local bal = ATC.SDK.Economy.GetBalance(player.characterId, moneyType)
                return bal or 0
            end,
            AddItem = function(self, item, amount, slot, info)
                ATC.SDK.Inventory.AddItem(player.characterId, item, amount, info or {})
            end,
            RemoveItem = function(self, item, amount, slot)
                ATC.SDK.Inventory.RemoveItem(player.characterId, item, amount)
            end,
            HasItem = function(self, item, amount)
                return ATC.SDK.Inventory.HasItem(player.characterId, item, amount or 1)
            end,
            SetJobDuty = function(self, onDuty)
                ATC.SDK.Player.Update(player.characterId, { isOnDuty = onDuty })
            end
        }
    }
end

-- Register as qb-core export
exports('GetPlayer', QBCore.Functions.GetPlayer)
exports('GetPlayerByIdentifier', function(identifier)
    local player, err = ATC.SDK.Player.GetByIdentifier(identifier)
    if not player then return nil end
    return QBCore.Functions.GetPlayer(player.activeSource)
end)
```

### Item Translation

```lua
-- bridges/qbcore-bridge/server/inventory.lua

-- QB item format → ATC item format mapping
local function qbItemToATC(qbItem)
    return {
        name = qbItem.name,
        label = qbItem.label,
        weight = qbItem.weight,
        stackable = qbItem.unique == false,
        usable = qbItem.useable or false,
        metadata = qbItem.info or {}
    }
end

-- QBCore.Functions.AddItem → ATC.SDK.Inventory.AddItem
exports('AddItem', function(source, item, amount, slot, info)
    local player, _ = ATC.SDK.Player.Get(source)
    if not player then return false end
    local ok, err = ATC.SDK.Inventory.AddItem(player.characterId, item, amount or 1, info or {})
    return ok
end)
```

### Event Bridge

```lua
-- bridges/qbcore-bridge/server/events.lua
-- Translates QB events to ATC events and vice versa

-- When ATC fires player connected, also fire QB-style event
-- (for scripts listening to QB events)
ATC.Core.EventBus.On('atc:player:connected', function(payload)
    TriggerClientEvent('QBCore:Client:OnPlayerLoaded', payload.source)
end)

ATC.Core.EventBus.On('atc:inventory:item:added', function(payload)
    TriggerClientEvent('inventory:client:ItemBox', payload.source, {
        name = payload.item,
        amount = payload.quantity
    }, 'add')
end)
```

---

## ESX Bridge

### Translation Strategy

```lua
-- bridges/esx-bridge/server/player.lua

ESX = {}

function ESX.GetPlayerFromId(source)
    local player, err = ATC.SDK.Player.Get(source)
    if not player then return nil end

    return {
        identifier = player.identifier,
        name = player.characterName,
        source = source,

        -- ESX method shims
        getMoney = function(self)
            local bal, _ = ATC.SDK.Economy.GetBalance(player.characterId, 'cash')
            return bal or 0
        end,
        getAccount = function(self, accountName)
            local currency = accountName == 'bank' and 'bank' or 'cash'
            local bal, _ = ATC.SDK.Economy.GetBalance(player.characterId, currency)
            return { money = bal or 0, name = accountName }
        end,
        addMoney = function(self, money)
            ATC.SDK.Economy.AddMoney(player.characterId, money, 'cash', 'esx_compat')
        end,
        removeMoney = function(self, money)
            ATC.SDK.Economy.RemoveMoney(player.characterId, money, 'cash', 'esx_compat')
        end,
        addAccountMoney = function(self, account, money)
            local currency = account == 'bank' and 'bank' or 'cash'
            ATC.SDK.Economy.AddMoney(player.characterId, money, currency, 'esx_compat')
        end,
        removeAccountMoney = function(self, account, money)
            local currency = account == 'bank' and 'bank' or 'cash'
            ATC.SDK.Economy.RemoveMoney(player.characterId, money, currency, 'esx_compat')
        end,
        getInventoryItem = function(self, item)
            local count, _ = ATC.SDK.Inventory.GetItemCount(player.characterId, item)
            return { count = count, name = item }
        end,
        addInventoryItem = function(self, item, count)
            ATC.SDK.Inventory.AddItem(player.characterId, item, count, {})
        end,
        removeInventoryItem = function(self, item, count)
            ATC.SDK.Inventory.RemoveItem(player.characterId, item, count)
        end,
        getJob = function(self)
            return {
                name = player.job.name,
                label = player.job.label,
                grade = player.job.grade,
                grade_name = player.job.gradeName,
                grade_label = player.job.gradeLabel
            }
        end
    }
end

exports('GetPlayerFromId', ESX.GetPlayerFromId)
```

---

## Bridge Limitations

Bridges intentionally do NOT support:
- Internal QB/ESX data structures that ATC has no equivalent for
- QB-specific shared object (`QBCore.Shared.*`) — only player/inventory/economy methods
- Direct database access that bypasses ATC security layer
- Events that would bypass the ATC Event Firewall

If a legacy script relies on behavior that ATC explicitly prohibits (e.g., trusting client-sent money amounts), the bridge will **not** implement that behavior. The bridge enforces ATC security even when emulating legacy APIs.

---

## Bridge Activation

Bridges are opt-in FiveM resources. Enable in `server.cfg`:

```cfg
# Optional: only add bridges for frameworks you need
ensure qbcore-bridge
ensure esx-bridge

# Do NOT ensure both if you're running pure ATC
```

---

## Migration Path

For servers migrating from QB/ESX to ATC:

```
Phase 1: Run ATC + bridges simultaneously
  - ATC handles all new scripts
  - Bridges allow legacy scripts to function
  - Monitor bridge call logs for heavy usage

Phase 2: Migrate high-traffic scripts
  - Rewrite most-used legacy scripts to use ATC.SDK directly
  - Remove bridge dependency from migrated scripts

Phase 3: Bridge sunset
  - Remove bridges once all scripts are migrated
  - Full ATC performance, no compatibility overhead
```
