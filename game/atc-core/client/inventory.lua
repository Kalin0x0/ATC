-- ATC Core — Client Inventory
-- Caches the player's inventory slots as pushed by the server.
-- All mutations happen server-side; the client only reads and forwards to NUI.

ATC           = ATC           or {}
ATC.Inventory = ATC.Inventory or {}

local _items = {}   -- array of slot tables { slotIndex, itemName, quantity, metadata, ... }

-- ── Public API ────────────────────────────────────────────────────────────────

--- Returns the full inventory slot array.
function ATC.Inventory.Get()
    return _items
end

--- Returns a single slot by its 1-based index, or nil.
function ATC.Inventory.GetSlot(index)
    return _items[index]
end

--- Empties the local cache (called on character deselect / resource stop).
function ATC.Inventory.Clear()
    _items = {}
end

--- Returns (true, slot) if a slot with the item and quantity > 0 exists.
function ATC.Inventory.HasItem(itemName)
    for _, slot in ipairs(_items) do
        if slot.itemName == itemName and (slot.quantity or 0) > 0 then
            return true, slot
        end
    end
    return false, nil
end

-- ── Network events ────────────────────────────────────────────────────────────

-- Full inventory snapshot (response to atc:inventory:request or post-mutation)
RegisterNetEvent(ATC.Events.INVENTORY.UPDATE)
AddEventHandler(ATC.Events.INVENTORY.UPDATE, function(data)
    _items = (data and data.slots) or {}
    SendNUIMessage({ type = 'ATC_INVENTORY_UPDATE', payload = _items })
    -- Sync first 5 slots into the hotbar (hotbar.lua owns no net event)
    if ATC.Hotbar and ATC.Hotbar.SyncFromInventory then
        ATC.Hotbar.SyncFromInventory(_items)
    end
end)

-- Server confirms a successful item use
RegisterNetEvent(ATC.Events.ITEM.USED)
AddEventHandler(ATC.Events.ITEM.USED, function(data)
    if not data then return end
    SendNUIMessage({
        type    = 'ATC_ITEM_USED',
        payload = { slotIndex = data.slotIndex, itemName = data.itemName },
    })
end)

-- Server rejects item use due to cooldown
RegisterNetEvent(ATC.Events.ITEM.COOLDOWN)
AddEventHandler(ATC.Events.ITEM.COOLDOWN, function(data)
    if not data then return end
    SendNUIMessage({
        type    = 'ATC_ITEM_COOLDOWN',
        payload = { slotIndex = data.slotIndex, remainingMs = data.remainingMs },
    })
end)

-- Server notifies that an item's durability has reached zero
RegisterNetEvent(ATC.Events.ITEM.BROKEN)
AddEventHandler(ATC.Events.ITEM.BROKEN, function(data)
    if not data then return end
    SendNUIMessage({
        type    = 'ATC_ITEM_BROKEN',
        payload = { slotIndex = data.slotIndex, itemName = data.itemName },
    })
end)

-- ── NUI callbacks ─────────────────────────────────────────────────────────────

-- Player clicks "use" on an item in the NUI inventory panel
RegisterNUICallback('atc:inventory:use', function(data, cb)
    local slotIndex = tonumber(data and data.slotIndex)
    if not slotIndex then cb('error'); return end
    TriggerServerEvent(ATC.Events.ITEM.USE, { slotIndex = slotIndex })
    cb('ok')
end)

-- Player closes the inventory panel
RegisterNUICallback('atc:inventory:close', function(_data, cb)
    SetNuiFocus(false, false)
    SendNUIMessage({ type = 'ATC_INVENTORY_CLOSE' })
    cb('ok')
end)

-- ── Keybind ───────────────────────────────────────────────────────────────────

RegisterCommand('atc_inventory', function()
    if not ATC.Core.IsReady() then return end
    if not (ATC.Characters and ATC.Characters.IsSpawned()) then return end

    -- Request a fresh snapshot from the server before opening the panel
    TriggerServerEvent(ATC.Events.INVENTORY.REQUEST)
    SetNuiFocus(true, true)
    SendNUIMessage({ type = 'ATC_INVENTORY_OPEN' })
end, false)

RegisterKeyMapping(
    'atc_inventory',
    ATC.Locale.T('inventory.open') or 'Open Inventory',
    'keyboard',
    'TAB'
)
