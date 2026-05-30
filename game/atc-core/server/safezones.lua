-- ============================================================
-- ATC — Atlantic Core
-- server/safezones.lua — Safezone Entry / Exit Tracking
-- Tracks per-player zone state; exposes ATC.Safezones.IsInSafezone.
-- ============================================================

ATC           = ATC           or {}
ATC.Safezones = ATC.Safezones or {}

-- ── Zone definitions ─────────────────────────────────────────

local ZONES = {
    { id = 'spawn',    coords = vector3(-269.4,  -955.3,  31.2),  radius = 50.0,  label = 'Spawn Area'  },
    { id = 'hospital', coords = vector3( 295.84,-1447.53, 29.99), radius = 60.0,  label = 'Hospital'    },
    { id = 'pd_lobby', coords = vector3( 441.68, -982.44, 30.69), radius = 30.0,  label = 'Police HQ'   },
}

local _playersInZone = {}   -- source → zoneId | nil

-- ── Zone polling loop ────────────────────────────────────────
-- Checks every second; fires entry/exit events on transition.

CreateThread(function()
    while true do
        Wait(1000)
        for _, playerId in ipairs(GetPlayers()) do
            local src = tonumber(playerId)
            local ped = GetPlayerPed(src)
            if not DoesEntityExist(ped) then goto continue_sz end
            local pCoords = GetEntityCoords(ped)
            local inZone  = nil

            for _, zone in ipairs(ZONES) do
                if #(pCoords - zone.coords) <= zone.radius then
                    inZone = zone
                    break
                end
            end

            local wasIn = _playersInZone[src]

            if inZone and not wasIn then
                _playersInZone[src] = inZone.id
                TriggerClientEvent('atc:safezone:enter', src, { id = inZone.id, label = inZone.label })
            elseif not inZone and wasIn then
                _playersInZone[src] = nil
                TriggerClientEvent('atc:safezone:exit', src, {})
            end
            ::continue_sz::
        end
    end
end)

-- ── Public API ───────────────────────────────────────────────

--- Returns true when the given player source is currently inside a safezone.
--- @param source number  FiveM player source
--- @return boolean
function ATC.Safezones.IsInSafezone(source)
    return _playersInZone[source] ~= nil
end
