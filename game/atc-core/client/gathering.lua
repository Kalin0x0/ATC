-- ============================================================
-- ATC — Atlantic Core
-- client/gathering.lua — Resource Gathering Interaction Points
-- Registers world spots; triggers server-side item grant.
-- ============================================================

ATC           = ATC           or {}
ATC.Gathering = ATC.Gathering or {}

-- ── Gather spot definitions ──────────────────────────────────
-- tool = nil means no tool required; otherwise item must be equipped.

local GATHER_SPOTS = {
    { id = 'forest_herbs', coords = vector3(-1188.9, 4926.7, 224.2),  label = 'Gather Herbs',  resource = 'herbs',      tool = nil          },
    { id = 'beach_scrap',  coords = vector3(-1371.4,   34.9,  54.3),  label = 'Collect Scrap', resource = 'scrap',      tool = nil          },
    { id = 'mine_ore',     coords = vector3( 2936.2, 2783.8,  41.2),  label = 'Mine Ore',      resource = 'iron_ore',   tool = 'pickaxe'    },
    { id = 'fishing_spot', coords = vector3( -815.7, 5545.2,  34.5),  label = 'Fish',          resource = 'fish',       tool = 'fishing_rod' },
}

local _gatherThread = false

-- ── Register interaction zones once the character is spawned ─

CreateThread(function()
    while true do
        Wait(1000)
        if not (ATC.Core.IsReady() and ATC.Characters and ATC.Characters.IsSpawned()) then goto skip end
        if not _gatherThread then
            _gatherThread = true
            for _, spot in ipairs(GATHER_SPOTS) do
                local s = spot  -- capture for closure
                ATC.Interaction.RegisterZone('gather_' .. s.id, s.coords, 3.0, s.label, function()
                    TriggerServerEvent('atc:gathering:collect', {
                        resource = s.resource,
                        spotId   = s.id,
                        tool     = s.tool,
                    })
                    -- Gather animation
                    local dict = 'amb@world_human_gardener_plant@male@base'
                    RequestAnimDict(dict)
                    Citizen.SetTimeout(500, function()
                        if HasAnimDictLoaded(dict) then
                            TaskPlayAnim(PlayerPedId(), dict, 'base', 2.0, -2.0, 4000, 1, 0, false, false, false)
                        end
                    end)
                end)
            end
        end
        ::skip::
    end
end)

-- ── Server response ──────────────────────────────────────────

RegisterNetEvent('atc:gathering:result')
AddEventHandler('atc:gathering:result', function(data)
    if not data then return end
    if data.success then
        SendNUIMessage({
            type    = 'ATC_NOTIFICATION',
            payload = {
                message  = 'Gathered: ' .. tostring(data.quantity or 1) .. 'x ' .. tostring(data.resource or 'item'),
                level    = 'success',
                duration = 3000,
            },
        })
        TriggerServerEvent(ATC.Events.INVENTORY.REQUEST)
    else
        SendNUIMessage({
            type    = 'ATC_NOTIFICATION',
            payload = {
                message  = data.reason or 'Nothing to gather here',
                level    = 'warning',
                duration = 3000,
            },
        })
    end
end)
