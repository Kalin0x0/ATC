-- ATC Core — Client Hotbar
-- Manages the 5-slot quickbar synced from inventory slots 1-5.
-- SyncFromInventory is called by client/inventory.lua's INVENTORY.UPDATE handler
-- to avoid registering a duplicate net event for the same event name.

ATC         = ATC         or {}
ATC.Hotbar  = ATC.Hotbar  or {}

local _slots    = {}   -- 1..5: { itemName, quantity, metadata } or nil
local _selected = 1

-- ── Public API ────────────────────────────────────────────────────────────────

function ATC.Hotbar.Set(slotIndex, item)
    if slotIndex < 1 or slotIndex > 5 then return end
    _slots[slotIndex] = item
    SendNUIMessage({ type = 'ATC_HOTBAR_UPDATE', payload = { slots = _slots, selected = _selected } })
end

function ATC.Hotbar.GetSelected()
    return _slots[_selected]
end

function ATC.Hotbar.SelectSlot(index)
    if index < 1 or index > 5 then return end
    _selected = index
    SendNUIMessage({ type = 'ATC_HOTBAR_SELECT', payload = { selected = _selected } })
end

--- Called by client/inventory.lua's INVENTORY.UPDATE handler.
--- Maps the first 5 inventory slots into the hotbar.
function ATC.Hotbar.SyncFromInventory(items)
    for i = 1, 5 do
        _slots[i] = items and items[i] or nil
    end
    SendNUIMessage({ type = 'ATC_HOTBAR_UPDATE', payload = { slots = _slots, selected = _selected } })
end

-- ── Key binds: 1-5 select slot ────────────────────────────────────────────────

for i = 1, 5 do
    RegisterCommand('atc_hotbar_' .. i, function()
        ATC.Hotbar.SelectSlot(i)
    end, false)
    RegisterKeyMapping('atc_hotbar_' .. i, 'Hotbar Slot ' .. i, 'keyboard', tostring(i))
end

-- ── Use selected hotbar item ──────────────────────────────────────────────────

RegisterCommand('atc_hotbar_use', function()
    local slot = _slots[_selected]
    if not slot then return end
    TriggerServerEvent(ATC.Events.ITEM.USE, { slotIndex = _selected })
end, false)
RegisterKeyMapping('atc_hotbar_use', 'Use Hotbar Item', 'keyboard', 'CAPITAL')
