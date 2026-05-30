-- ============================================================
-- ATC Marketplace — client/init.lua (Phase 95)
-- Command, key binding, NUI bridge callbacks
-- ============================================================

local _open = false

-- ── Toggle marketplace ────────────────────────────────────────

RegisterCommand('marketplace', function()
    _open = not _open
    SetNuiFocus(_open, _open)
    if _open then
        TriggerServerEvent('atc:marketplace:listings:get')
    end
    SendNUIMessage({ type = _open and 'ATC_MARKETPLACE_OPEN' or 'ATC_MARKETPLACE_CLOSE' })
end, false)

RegisterKeyMapping('marketplace', 'Open Marketplace', 'keyboard', 'F8')

-- ── NUI → Server callbacks ────────────────────────────────────

RegisterNUICallback('atc:marketplace:close', function(_, cb)
    _open = false
    SetNuiFocus(false, false)
    SendNUIMessage({ type = 'ATC_MARKETPLACE_CLOSE' })
    cb('ok')
end)

RegisterNUICallback('atc:marketplace:listing:create', function(data, cb)
    TriggerServerEvent('atc:marketplace:listing:create', data)
    cb('ok')
end)

RegisterNUICallback('atc:marketplace:buy', function(data, cb)
    TriggerServerEvent('atc:marketplace:buy', data)
    cb('ok')
end)

-- ── Register net events ───────────────────────────────────────

local _netEvents = {
    'atc:marketplace:listings:response',
    'atc:marketplace:listing:created',
    'atc:marketplace:buy:response',
}
for _, e in ipairs(_netEvents) do
    RegisterNetEvent(e)
end

-- ── Server → NUI bridge ───────────────────────────────────────

AddEventHandler('atc:marketplace:listings:response', function(data)
    SendNUIMessage({ type = 'ATC_MARKETPLACE_DATA', payload = data })
end)

AddEventHandler('atc:marketplace:listing:created', function(data)
    SendNUIMessage({ type = 'ATC_MARKETPLACE_LISTED', payload = data })
end)

AddEventHandler('atc:marketplace:buy:response', function(data)
    local ok = data and data.success
    SendNUIMessage({
        type    = 'ATC_NOTIFICATION',
        payload = {
            message  = ok and 'Purchase successful!' or 'Purchase failed.',
            level    = ok and 'success' or 'error',
            duration = 4000,
        },
    })
    if ok then
        -- Refresh listings after a successful purchase
        TriggerServerEvent('atc:marketplace:listings:get')
    end
end)
