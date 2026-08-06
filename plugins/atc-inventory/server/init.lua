-- ATC Inventory Plugin — Server
-- Handles server-authoritative item use.
-- The server verifies item ownership via API before calling any handler.
-- Clients cannot trigger effects directly — only the slot index is trusted
-- after server-side validation confirms it contains the expected item.

-- ── Item use handler table ────────────────────────────────────────────────────
-- Each key is an itemId (matches item definition IDs in the API).
-- Each value is function(source, slotData) — slotData is the API-verified slot object.
-- All vital mutations use ATC.Vitals.Patch (server-authoritative, no client trust).

local ITEM_HANDLERS = {

    water_bottle = function(src, _slotData)
        ATC.Vitals.Get(src, function(ok, vitals)
            if not ok or not vitals then return end
            local currentThirst = tonumber(vitals.thirst) or 50
            local newThirst     = math.min(100, currentThirst + 30)
            ATC.Vitals.Patch(src, { thirst = newThirst }, function(patchOk)
                if patchOk then
                    TriggerClientEvent('atc:inventory:item:effect', src, {
                        effectType = 'drink',
                        itemId     = 'water_bottle',
                    })
                    ATC.Log.Debug('inventory', 'water_bottle used — thirst restored', {
                        source     = src,
                        oldThirst  = currentThirst,
                        newThirst  = newThirst,
                    })
                end
            end)
        end)
    end,

    bandage = function(src, _slotData)
        ATC.Vitals.Get(src, function(ok, vitals)
            if not ok or not vitals then return end
            local currentHealth = tonumber(vitals.health) or 50
            local newHealth     = math.min(100, currentHealth + 15)
            ATC.Vitals.Patch(src, { health = newHealth }, function(patchOk)
                if patchOk then
                    TriggerClientEvent('atc:inventory:item:effect', src, {
                        effectType = 'heal',
                        itemId     = 'bandage',
                    })
                    ATC.Log.Debug('inventory', 'bandage used — health restored', {
                        source     = src,
                        oldHealth  = currentHealth,
                        newHealth  = newHealth,
                    })
                end
            end)
        end)
    end,

    burger = function(src, _slotData)
        ATC.Vitals.Get(src, function(ok, vitals)
            if not ok or not vitals then return end
            local currentHunger = tonumber(vitals.hunger) or 50
            local newHunger     = math.min(100, currentHunger + 35)
            ATC.Vitals.Patch(src, { hunger = newHunger }, function(patchOk)
                if patchOk then
                    TriggerClientEvent('atc:inventory:item:effect', src, {
                        effectType = 'eat',
                        itemId     = 'burger',
                    })
                    ATC.Log.Debug('inventory', 'burger used — hunger restored', {
                        source     = src,
                        oldHunger  = currentHunger,
                        newHunger  = newHunger,
                    })
                end
            end)
        end)
    end,

}

-- ── Event: item use ───────────────────────────────────────────────────────────

ATC.Firewall.On(
    'atc:inventory:item:use',
    {
        clientAllowed  = true,
        requireSession = true,
        rateLimit      = { window = 1000, max = 5 },
    },
    function(src, payload)
        local slot = payload and tonumber(payload.slotIndex)
        if not slot or slot < 1 then
            ATC.Log.Warn('inventory', 'item:use — invalid slotIndex', {
                source = src, payload = payload,
            })
            return
        end

        local characterId = ATC.Characters.GetSelectedId(src)
        if not characterId then
            ATC.Log.Warn('inventory', 'item:use — no character selected', { source = src })
            return
        end

        -- Server-side ownership verification: fetch the actual inventory and confirm
        -- the slot exists and contains an item before dispatching any handler.
        ATC.Inventory.Get(src, function(ok, data)
            if not ok or not data then
                ATC.Log.Warn('inventory', 'item:use — failed to fetch inventory', {
                    source = src, characterId = characterId,
                })
                return
            end

            -- API returns items as an array; slot is 1-based.
            local items    = data.items or {}
            local slotData = items[slot]

            if not slotData or not slotData.itemId then
                ATC.Log.Warn('inventory', 'item:use — slot empty or missing itemId', {
                    source = src, slot = slot,
                })
                return
            end

            local itemId  = slotData.itemId
            local handler = ITEM_HANDLERS[itemId]

            if not handler then
                -- Item exists but has no registered use handler — not an error
                ATC.Log.Debug('inventory', 'item:use — no handler for item', {
                    source = src, itemId = itemId, slot = slot,
                })
                return
            end

            -- Consume the item via API (removes one quantity from the slot)
            ATC.HTTP.Post(
                '/api/v1/inventory/character/' .. characterId .. '/use',
                { slotIndex = slot },
                function(consumeOk, consumeStatus, _consumeData, consumeErr)
                    if not consumeOk then
                        ATC.Log.Error('inventory', 'item:use — consume API error', {
                            source = src, status = consumeStatus, err = consumeErr,
                        })
                        return
                    end

                    -- Dispatch the use handler only after confirmed consumption
                    handler(src, slotData)

                    ATC.Log.Info('inventory', 'Item used', {
                        source      = src,
                        characterId = characterId,
                        itemId      = itemId,
                        slot        = slot,
                    })
                end
            )
        end)
    end
)

-- ── Crafting server handlers ─────────────────────────────────────────────────
-- There is no one-call craft endpoint. POST /api/v1/crafting/craft does not
-- exist, so every craft attempt 404'd and nothing was ever made.
--
-- The API models crafting as industrial production jobs rather than as a
-- character action: POST /api/v1/crafting/jobs wants a queueId (a registered
-- manufacturing station), an initiatedByPrincipalId, a quantityOrdered and a
-- jobNonce, and the job is then settled by a separate /complete, /fail or
-- /cancel call. That runtime never touches character inventory — it neither
-- consumes ingredients nor grants the output — and atc_crafting_recipes has no
-- ingredient columns at all (recipe_id, recipe_name, output_item_id,
-- output_quantity, recipe_type, required_station, crafting_time_seconds), so
-- the server has no record of what a recipe costs. Repointing this handler at
-- the job model would mean inventing stations, queues, timed completion and an
-- ingredient list: a gameplay redesign, not a path fix, so it is not attempted
-- here. Hand-rolling the craft from inventory add/remove is out for the same
-- reason — the ingredients would have to come from the client.
--
-- The recipe list endpoint is real and is called normally below.
--
-- A switch, not a TODO: set it to true once a craft route exists that resolves
-- the recipe server-side and mutates the character's inventory.
local CRAFTING_API_ENABLED = false
local _warnedCraft         = false

ATC.Firewall.On('atc:crafting:recipes:get', {clientAllowed=true,requireSession=true,rateLimit={window=5000,max=5}}, function(src)
    ATC.HTTP.Get('/api/v1/crafting/recipes', function(ok, _, data)
        TriggerClientEvent('atc:crafting:recipes:response', src, ok and data or { recipes={} })
    end)
end)

ATC.Firewall.On('atc:crafting:craft', {clientAllowed=true,requireSession=true,rateLimit={window=3000,max=5}}, function(src, payload)
    local recipeId    = type(payload)=='table' and tostring(payload.recipeId or ''):sub(1,64) or ''
    local characterId = ATC.Sessions.GetCharacterId(src)
    if recipeId=='' or not characterId then return end

    if not CRAFTING_API_ENABLED then
        if not _warnedCraft then
            _warnedCraft = true
            ATC.Log.Warn('inventory', 'Crafting is disabled: no craft endpoint exists and the crafting runtime never touches character inventory. See CRAFTING_API_ENABLED in this file.', {
                path = '/api/v1/crafting/craft',
            })
        end
        -- Nothing was crafted, so nothing is claimed. The crafting NUI prints
        -- every failed result as 'Not enough materials', which is not the
        -- reason, so the player is told the truth over the notify channel
        -- rather than handed a wrong explanation.
        TriggerClientEvent(ATC.Events.NOTIFY.SHOW, src, {
            message  = 'Crafting is unavailable right now',
            level    = 'warning',
            duration = 3000,
        })
        return
    end

    ATC.HTTP.Post('/api/v1/crafting/craft', { characterId=characterId, recipeId=recipeId }, function(ok, _, data)
        TriggerClientEvent('atc:crafting:result', src, { success=ok, resultItem=ok and data and data.itemName, data=data })
        if ok then
            ATC.HTTP.Get('/api/v1/inventory/character/'..characterId, function(iok,_,idata)
                if iok then TriggerClientEvent(ATC.Events.INVENTORY.UPDATE, src, idata) end
            end)
        end
    end)
end)

ATC.Log.Info('inventory', 'atc-inventory server plugin loaded')
