ATC = ATC or {}
ATC.Interaction = ATC.Interaction or {}

local _targets = {}   -- registered interactable entities/coords
local _active  = nil  -- currently highlighted target
local INTERACT_KEY = 38  -- E key (INPUT_PICKUP)
local MAX_DIST = 3.0

-- Register a world interaction at coords
function ATC.Interaction.RegisterZone(id, coords, radius, label, action)
    _targets[id] = { type='zone', coords=coords, radius=radius, label=label, action=action }
end

-- Register entity interaction (ped/vehicle/object)
function ATC.Interaction.RegisterEntity(id, entityNetId, label, action)
    _targets[id] = { type='entity', entityNetId=entityNetId, label=label, action=action }
end

-- Remove a target
function ATC.Interaction.Remove(id)
    _targets[id] = nil
    if _active == id then _active = nil end
end

-- Internal: find nearest interactable in range
local function _findNearest()
    local ped    = PlayerPedId()
    local myPos  = GetEntityCoords(ped)
    local best, bestDist, bestLabel = nil, MAX_DIST, nil

    for id, t in pairs(_targets) do
        local dist
        if t.type == 'zone' then
            dist = #(myPos - t.coords)
        elseif t.type == 'entity' then
            local ent = NetworkGetEntityFromNetworkId(t.entityNetId)
            if DoesEntityExist(ent) then
                dist = #(myPos - GetEntityCoords(ent))
            end
        end
        if dist and dist < bestDist then
            best, bestDist, bestLabel = id, dist, t.label
        end
    end
    return best, bestLabel
end

-- Draw 3D text above a position
local function _draw3DText(coords, text)
    local onScreen, screenX, screenY = World3dToScreen2d(coords.x, coords.y, coords.z + 0.5)
    if not onScreen then return end
    local camCoords = GetGameplayCamCoords()
    local dist = #(camCoords - coords)
    local scale = math.max(0.3, math.min(0.7, 1.0 - (dist / 20.0)))
    SetTextScale(scale, scale)
    SetTextFont(4)
    SetTextProportional(1)
    SetTextColour(212, 175, 55, 255)  -- ATC gold
    SetTextOutline()
    SetTextCentre(1)
    SetTextEntry("STRING")
    AddTextComponentString(text)
    DrawText(screenX, screenY)
    -- Draw interaction key hint below
    SetTextScale(scale * 0.7, scale * 0.7)
    SetTextFont(4)
    SetTextProportional(1)
    SetTextColour(255, 255, 255, 200)
    SetTextOutline()
    SetTextCentre(1)
    SetTextEntry("STRING")
    AddTextComponentString("[E] Interact")
    DrawText(screenX, screenY + 0.025)
end

-- Main thread: scan, draw, handle input
CreateThread(function()
    while true do
        local sleep = 100
        if ATC.Core.IsReady() and ATC.Characters and ATC.Characters.IsSpawned() then
            sleep = 0
            local id, label = _findNearest()
            _active = id

            if id then
                local t = _targets[id]
                local drawPos
                if t.type == 'zone' then
                    drawPos = t.coords
                elseif t.type == 'entity' then
                    local ent = NetworkGetEntityFromNetworkId(t.entityNetId)
                    if DoesEntityExist(ent) then drawPos = GetEntityCoords(ent) end
                end
                if drawPos then _draw3DText(drawPos, label or 'Interact') end

                if IsControlJustReleased(0, INTERACT_KEY) then
                    if t.action then t.action() end
                end
            end
        end
        Wait(sleep)
    end
end)

-- ── Public: property door interaction (registered by atc-housing) ──────────
AddEventHandler('atc:interaction:register:zone', function(id, x, y, z, radius, label)
    ATC.Interaction.RegisterZone(id, vector3(x,y,z), tonumber(radius) or 1.5, label, function()
        TriggerServerEvent('atc:housing:property:enter', { propertyId = id })
    end)
end)

AddEventHandler('atc:interaction:register:entity', function(id, netId, label)
    ATC.Interaction.RegisterEntity(id, netId, label, function()
        TriggerEvent('atc:interaction:entity:used', id, netId)
    end)
end)

AddEventHandler('atc:interaction:remove', function(id)
    ATC.Interaction.Remove(id)
end)
