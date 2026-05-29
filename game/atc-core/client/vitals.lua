-- ATC Core — Client Vitals
-- Caches the authoritative vitals pushed from the server and applies
-- health/armour values to the local ped.

ATC        = ATC        or {}
ATC.Vitals = ATC.Vitals or {}

local _vitals = { health = 100, armor = 0, hunger = 100, thirst = 100, stamina = 100 }

-- ── Public API ────────────────────────────────────────────────────────────────

--- Returns the current vitals snapshot.
function ATC.Vitals.Get()
    return _vitals
end

--- Replaces the vitals cache and applies values to the ped.
--- Called internally; use the net-event handlers in normal flow.
function ATC.Vitals.Set(data)
    if not data then return end
    _vitals.health  = data.health  or _vitals.health
    _vitals.armor   = data.armor   or _vitals.armor
    _vitals.hunger  = data.hunger  or _vitals.hunger
    _vitals.thirst  = data.thirst  or _vitals.thirst
    _vitals.stamina = data.stamina or _vitals.stamina

    local ped = PlayerPedId()
    -- GTA health range: 100 (dead) – 200 (full). We map 0-100 vitals→100-200 game HP.
    SetEntityHealth(ped, 100 + math.floor((_vitals.health / 100.0) * 100))
    SetPedArmour(ped, _vitals.armor or 0)
end

--- Returns true when health is above zero.
function ATC.Vitals.IsAlive()
    return _vitals.health > 0
end

-- ── Internal: apply + broadcast ───────────────────────────────────────────────

local function ApplyAndBroadcast(data)
    ATC.Vitals.Set(data)
    SendNUIMessage({ type = 'ATC_VITALS_UPDATE', payload = _vitals })
end

-- ── Network events ────────────────────────────────────────────────────────────

-- Full vitals snapshot from server (response to atc:vitals:request)
RegisterNetEvent(ATC.Events.VITALS.UPDATE)
AddEventHandler(ATC.Events.VITALS.UPDATE, function(data)
    ApplyAndBroadcast(data)
end)

-- Incremental vitals mutation (e.g., hunger tick, damage)
RegisterNetEvent(ATC.Events.VITALS.CHANGED)
AddEventHandler(ATC.Events.VITALS.CHANGED, function(data)
    ApplyAndBroadcast(data)
end)

-- ── Poll + decay threads ──────────────────────────────────────────────────────

-- Pull the authoritative vitals snapshot from the server every 8 s.
-- The server is the single source of truth; we never compute vitals client-side.
CreateThread(function()
    while true do
        Wait(8000)
        if ATC.Core.IsReady() and ATC.Characters and ATC.Characters.IsSpawned() then
            TriggerServerEvent(ATC.Events.VITALS.REQUEST)
        end
    end
end)

-- Signal the server every 30 s to apply hunger/thirst decay for this player.
-- The server validates the tick and writes the result; the client never mutates
-- hunger/thirst directly.
CreateThread(function()
    while true do
        Wait(30000)
        if ATC.Core.IsReady() and ATC.Characters and ATC.Characters.IsSpawned() then
            TriggerServerEvent('atc:vitals:decay:tick')
        end
    end
end)
