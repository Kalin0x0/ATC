ATC = ATC or {}
ATC.GroundLoot = ATC.GroundLoot or {}

local _lootZones = {}  -- id → { coords, items[], interaction registered }

function ATC.GroundLoot.Spawn(id, coords, items)
    if _lootZones[id] then ATC.GroundLoot.Remove(id) end
    _lootZones[id] = { coords=coords, items=items or {}, active=true }
    ATC.Interaction.RegisterZone('loot_'..id, coords, 1.5, 'Pick up items', function()
        TriggerServerEvent('atc:loot:pickup', { lootId=id })
    end)
    -- Spawn an object marker (yellow bag)
    local obj = CreateObject(GetHashKey('prop_money_bag_01'), coords.x, coords.y, coords.z, false, false, false)
    PlaceObjectOnGroundProperly(obj)
    FreezeEntityPosition(obj, true)
    SetEntityInvincible(obj, true)
    _lootZones[id].objHandle = obj
end

function ATC.GroundLoot.Remove(id)
    local zone = _lootZones[id]
    if not zone then return end
    ATC.Interaction.Remove('loot_'..id)
    if zone.objHandle and DoesEntityExist(zone.objHandle) then
        DeleteObject(zone.objHandle)
    end
    _lootZones[id] = nil
end

-- Server tells client to spawn/remove loot
RegisterNetEvent('atc:loot:spawn')
AddEventHandler('atc:loot:spawn', function(data)
    if not data or not data.id then return end
    ATC.GroundLoot.Spawn(data.id, vector3(data.x, data.y, data.z), data.items)
end)

RegisterNetEvent('atc:loot:remove')
AddEventHandler('atc:loot:remove', function(data)
    if data and data.id then ATC.GroundLoot.Remove(data.id) end
end)
