-- ============================================================
-- ATC Core — Client NPC Interactions
-- Spawns interactable NPCs at fixed points and binds them to
-- dialogue trees through the interaction framework.
-- Depends on: ATC.Interaction (interaction.lua),
--             ATC.Dialogue    (dialogue.lua)
-- ============================================================

ATC = ATC or {}
ATC.NPCInteractions = ATC.NPCInteractions or {}

local _spawned = {}  -- id -> ped handle

-- Predefined interactable NPCs (peds spawned at fixed points with dialogue trees)
local NPC_DEFS = {
  {
    id='shopkeeper', model='mp_m_shopkeep_01', x=25.7, y=-1347.3, z=29.5, h=270.0,
    label='Talk to Shopkeeper',
    tree={ npcId='shopkeeper', speaker='Shopkeeper', text='Welcome to the 24/7. What can I get you?',
      options={
        { label='Browse the store', action='open_shop' },
        { label='Any work around here?', next={ speaker='Shopkeeper', text='Not unless you count restocking. Check the job center.', options={ { label='Thanks' } } } },
        { label='Just looking' },
      } }
  },
  {
    id='mechanic', model='s_m_y_xmech_02', x=-337.5, y=-136.8, z=39.0, h=70.0,
    label='Talk to Mechanic',
    tree={ npcId='mechanic', speaker='Mechanic', text='Car trouble? I can fix anything with wheels.',
      options={
        { label='Repair my vehicle', action='repair_vehicle' },
        { label='How much for a tune-up?', next={ speaker='Mechanic', text='Depends on the damage. Bring it in and I will take a look.', options={ { label='Will do' } } } },
        { label='Never mind' },
      } }
  },
}

local function loadModel(model)
  local hash = GetHashKey(model)
  RequestModel(hash)
  local t = GetGameTimer()
  while not HasModelLoaded(hash) and GetGameTimer()-t < 5000 do Wait(50) end
  return hash
end

function ATC.NPCInteractions.SpawnAll()
  if not (ATC.Interaction and ATC.Dialogue) then return end
  for _, def in ipairs(NPC_DEFS) do
    if not _spawned[def.id] then
      local hash = loadModel(def.model)
      if HasModelLoaded(hash) then
        local ped = CreatePed(4, hash, def.x, def.y, def.z - 1.0, def.h, false, true)
        SetEntityInvincible(ped, true)
        FreezeEntityPosition(ped, true)
        SetBlockingOfNonTemporaryEvents(ped, true)
        _spawned[def.id] = ped
        SetModelAsNoLongerNeeded(hash)
        -- Register interaction zone at NPC position
        ATC.Interaction.RegisterZone('npc_'..def.id, vector3(def.x, def.y, def.z), 2.0, def.label, function()
          ATC.Dialogue.Start(def.tree)
        end)
      end
    end
  end
end

function ATC.NPCInteractions.RemoveAll()
  for id, ped in pairs(_spawned) do
    if DoesEntityExist(ped) then DeleteEntity(ped) end
    if ATC.Interaction then ATC.Interaction.Remove('npc_'..id) end
  end
  _spawned = {}
end

-- Handle dialogue actions emitted by dialogue.lua via TriggerEvent('atc:dialogue:action:client', action)
RegisterNetEvent('atc:dialogue:action:client')
AddEventHandler('atc:dialogue:action:client', function(action)
  if not action then return end
  if action == 'open_shop' then
    TriggerServerEvent('atc:example_shop:catalog')
  elseif action == 'repair_vehicle' then
    local veh = GetVehiclePedIsIn(PlayerPedId(), false)
    if veh ~= 0 then
      SetVehicleFixed(veh)
      SetVehicleDeformationFixed(veh)
      SendNUIMessage({ type='ATC_NOTIFICATION', payload={ message='Vehicle repaired', level='success', duration=3000 } })
    else
      SendNUIMessage({ type='ATC_NOTIFICATION', payload={ message='You are not in a vehicle', level='warning', duration=3000 } })
    end
  end
end)

-- Spawn NPCs once the player's character is in the world
AddEventHandler(ATC.Events.CHARACTER.SELECTED, function(data)
  if data and data.success then
    Citizen.SetTimeout(5000, function() ATC.NPCInteractions.SpawnAll() end)
  end
end)

AddEventHandler('onResourceStop', function(r)
  if r == GetCurrentResourceName() then ATC.NPCInteractions.RemoveAll() end
end)
