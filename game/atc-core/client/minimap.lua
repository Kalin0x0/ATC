-- ============================================================
-- ATC — Atlantic Core
-- client/minimap.lua — Minimap enhancements, custom blip API
-- ============================================================

ATC = ATC or {}
ATC.Minimap = ATC.Minimap or {}

local _blips = {}   -- id → blipHandle

-- Expand minimap in vehicles
CreateThread(function()
    while true do
        if ATC.Core.IsReady() and ATC.Characters and ATC.Characters.IsSpawned() then
            if ATC.Vehicles.IsInVehicle() then
                SetRadarZoom(900)   -- wider view in vehicles
            else
                SetRadarZoom(1100)  -- tighter on foot
            end
        end
        Wait(2000)
    end
end)

-- Custom blip API
function ATC.Minimap.AddBlip(id, coords, label, sprite, color, scale)
    if _blips[id] then ATC.Minimap.RemoveBlip(id) end
    local blip = AddBlipForCoord(coords.x, coords.y, coords.z)
    SetBlipSprite(blip, sprite or 1)
    SetBlipColour(blip, color or 5)
    SetBlipScale(blip, scale or 0.8)
    SetBlipDisplay(blip, 4)
    BeginTextCommandSetBlipName('STRING')
    AddTextComponentString(label or '')
    EndTextCommandSetBlipName(blip)
    _blips[id] = blip
    return blip
end

function ATC.Minimap.RemoveBlip(id)
    local blip = _blips[id]
    if blip and DoesBlipExist(blip) then RemoveBlip(blip) end
    _blips[id] = nil
end

function ATC.Minimap.UpdateBlip(id, coords)
    local blip = _blips[id]
    if not blip or not DoesBlipExist(blip) then return end
    SetBlipCoords(blip, coords.x, coords.y, coords.z)
end

-- Blip for active job (updated on job change)
AddEventHandler('atc:jobs:job:changed', function(data)
    ATC.Minimap.RemoveBlip('active_job')
end)

-- Compass heading display
RegisterNetEvent('atc:minimap:blip:add')
AddEventHandler('atc:minimap:blip:add', function(data)
    if not data or not data.id then return end
    ATC.Minimap.AddBlip(data.id, vector3(data.x, data.y, data.z), data.label, data.sprite, data.color, data.scale)
end)

RegisterNetEvent('atc:minimap:blip:remove')
AddEventHandler('atc:minimap:blip:remove', function(data)
    if data and data.id then ATC.Minimap.RemoveBlip(data.id) end
end)
