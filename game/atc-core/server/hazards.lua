-- ============================================================
-- ATC — Atlantic Core
-- server/hazards.lua — Environmental Hazard Zones
-- Registers persistent hazard zones; damages players on tick.
-- ============================================================

ATC        = ATC        or {}
ATC.Hazards = ATC.Hazards or {}

local _hazardZones = {}   -- id → { coords, radius, type, dpt }

--- Register a hazard zone and broadcast it to all clients.
--- @param id string          Unique zone identifier
--- @param coords vector3     World-space centre
--- @param radius number      Sphere radius in metres
--- @param hazardType string  'fire' | 'gas' | 'radiation' | …
--- @param damagePerTick number  HP removed every 5 s (default 5)
function ATC.Hazards.RegisterZone(id, coords, radius, hazardType, damagePerTick)
    _hazardZones[id] = {
        coords = coords,
        radius = radius,
        type   = hazardType,
        dpt    = damagePerTick or 5,
    }
    TriggerClientEvent('atc:hazard:zone:add', -1, {
        id     = id,
        x      = coords.x,
        y      = coords.y,
        z      = coords.z,
        radius = radius,
        type   = hazardType,
    })
end

--- Remove a hazard zone and notify all clients.
--- @param id string  Zone identifier previously passed to RegisterZone
function ATC.Hazards.RemoveZone(id)
    _hazardZones[id] = nil
    TriggerClientEvent('atc:hazard:zone:remove', -1, { id = id })
end

-- ── Damage tick ──────────────────────────────────────────────
-- Every 5 s, check each active zone and damage players inside it.

CreateThread(function()
    while true do
        Wait(5000)
        for id, zone in pairs(_hazardZones) do
            for _, playerId in ipairs(GetPlayers()) do
                local src    = tonumber(playerId)
                local ped    = GetPlayerPed(src)
                if not DoesEntityExist(ped) then goto continue_hazard end
                local pCoords = GetEntityCoords(ped)
                if #(pCoords - zone.coords) <= zone.radius then
                    local characterId = ATC.Sessions.GetCharacterId(src)
                    if characterId then
                        ATC.HTTP.Post(
                            '/api/v1/vitals/' .. characterId .. '/damage',
                            { amount = zone.dpt, source = 'hazard_' .. tostring(zone.type) },
                            function() end
                        )
                        TriggerClientEvent('atc:hazard:damage', src, {
                            hazardType = zone.type,
                            amount     = zone.dpt,
                        })
                    end
                end
                ::continue_hazard::
            end
        end
    end
end)
