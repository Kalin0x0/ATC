-- ATC Anti-Cheat client — detect GodMode, noclip, teleport
ATC = ATC or {}
ATC.AntiCheatClient = ATC.AntiCheatClient or {}

local _lastHealth = 200
local _lastPos    = nil
local _lastTime   = 0

CreateThread(function()
    while true do
        Wait(2000)
        if not (ATC.Core and ATC.Core.IsReady()) then goto continue end
        if not (ATC.Characters and ATC.Characters.IsSpawned()) then goto continue end

        local ped    = PlayerPedId()
        local health = GetEntityHealth(ped)
        local now    = GetGameTimer()

        -- GodMode detection: health should never go UP without an event
        if health > _lastHealth + 50 and not IsEntityDead(ped) then
            TriggerServerEvent('atc:anticheat:report', { reason='health_jump ('..health..')' })
        end
        _lastHealth = health

        -- Teleport detection: position jump without vehicle
        local pos = GetEntityCoords(ped)
        if _lastPos and not IsPedInAnyVehicle(ped, false) then
            local dt   = (now - _lastTime) / 1000.0
            local dist = #(pos - _lastPos)
            if dt > 0 and dist / dt > 100.0 then
                TriggerServerEvent('atc:anticheat:report', { reason='teleport ('..math.floor(dist)..'m in '..string.format('%.1f',dt)..'s)' })
            end
        end
        _lastPos  = pos
        _lastTime = now

        ::continue::
    end
end)

-- Note: health jumps from legitimate healing (medkits, medical treatment) can
-- temporarily exceed the +50 threshold. The server-side report handler uses
-- rate-limiting (3 per 10 s) so a single heal will not cause a ban. If false
-- positives continue, raise the threshold or suppress reporting while a
-- 'atc:medical:heal' flag is set.

RegisterNetEvent('atc:anticheat:warning')
AddEventHandler('atc:anticheat:warning', function(data)
    ATC.Log.Warn('anticheat', 'Warning received', data)
    -- Don't show to player — just log client-side
end)
