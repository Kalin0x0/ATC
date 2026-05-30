-- atc-territory — Client Init
-- Receives territory zone data and claim broadcasts from the server.
-- Forwards data to the NUI via SendNUIMessage.
-- Never sends any authoritative data to the server from this file.

local _zones = {}

-- ── Zone List Response ────────────────────────────────────────────────────────
RegisterNetEvent('atc:territory:zones:response')
AddEventHandler('atc:territory:zones:response', function(data)
    _zones = data or {}
    SendNUIMessage({ type = 'ATC_TERRITORY_ZONES', payload = _zones })
end)

-- ── Territory Claimed Broadcast ───────────────────────────────────────────────
RegisterNetEvent('atc:territory:claimed')
AddEventHandler('atc:territory:claimed', function(data)
    if not data then return end
    -- Update local cache if the zone exists
    for i, zone in ipairs(_zones) do
        if zone.id == data.zoneId then
            _zones[i].factionId = data.factionId
            break
        end
    end
    -- Notify NUI of the ownership change
    SendNUIMessage({ type = 'ATC_TERRITORY_ZONES', payload = _zones })
    -- Show in-world notification
    SendNUIMessage({ type = 'ATC_NOTIFICATION', payload = {
        message  = 'Territory captured: ' .. (data.zoneId or 'unknown'),
        level    = 'warning',
        duration = 5000,
    }})
end)

-- ── Request zones on character select ────────────────────────────────────────
AddEventHandler(ATC.Events.CHARACTER.SELECTED, function(data)
    TriggerServerEvent('atc:territory:zones:request')
end)

-- ── NUI / Territory Panel ─────────────────────────────────────────────────

--- /territory  (F2)
--- Opens the territory control map panel.
RegisterCommand('territory', function()
    SetNuiFocus(true, true)
    TriggerServerEvent('atc:territory:zones:request')
    SendNUIMessage({ type = 'ATC_TERRITORY_OPEN', payload = { zones = {}, gang = nil } })
end, false)
RegisterKeyMapping('territory', 'Open Territory Map', 'keyboard', 'F2')

RegisterNUICallback('atc:territory:close', function(_, cb)
    SetNuiFocus(false, false)
    cb('ok')
end)

RegisterNUICallback('atc:territory:claim', function(data, cb)
    TriggerServerEvent('atc:territory:claim', data)
    cb('ok')
end)
