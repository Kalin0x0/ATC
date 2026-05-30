-- ============================================================
-- ATC — Atlantic Core
-- client/hazards.lua — Environmental Hazard Zones (Client)
-- Receives zone data from server; shows damage feedback.
-- ============================================================

ATC = ATC or {}

local _zones = {}   -- id → zone data

-- ── Zone lifecycle ───────────────────────────────────────────

RegisterNetEvent('atc:hazard:zone:add')
AddEventHandler('atc:hazard:zone:add', function(data)
    if not data or not data.id then return end
    _zones[data.id] = data
    -- Particle effect hint for fire zones
    -- (core_snow used as placeholder — swap to a fire looped fx when available)
    if data.type == 'fire' then
        StartParticleFxLoopedAtCoord('core_snow', data.x, data.y, data.z, 0, 0, 0, 1.0, false, false, false, false)
    end
end)

RegisterNetEvent('atc:hazard:zone:remove')
AddEventHandler('atc:hazard:zone:remove', function(data)
    if data and data.id then
        _zones[data.id] = nil
    end
end)

-- ── Damage feedback ──────────────────────────────────────────

RegisterNetEvent('atc:hazard:damage')
AddEventHandler('atc:hazard:damage', function(data)
    if not data then return end
    local msg
    if data.hazardType == 'fire' then
        msg = 'You are burning!'
    elseif data.hazardType == 'gas' then
        msg = 'Toxic gas!'
    else
        msg = 'Environmental hazard!'
    end
    SendNUIMessage({
        type    = 'ATC_NOTIFICATION',
        payload = {
            message  = msg .. ' (-' .. tostring(data.amount) .. ' HP)',
            level    = 'error',
            duration = 3000,
        },
    })
    -- Brief screen-damage timecycle modifier
    SetTimecycleModifier('damage')
    Citizen.SetTimeout(1000, function() ClearTimecycleModifier() end)
end)
