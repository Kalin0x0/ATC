-- =============================================================================
-- ATC Dynamic World Events — Phase 99
-- Randomised ambient world events with blips and client notification.
-- =============================================================================

ATC             = ATC             or {}
ATC.WorldEvents = ATC.WorldEvents or {}

-- ---------------------------------------------------------------------------
-- In-memory event registry
-- Key: event id (string), Value: event descriptor
-- ---------------------------------------------------------------------------
local _activeEvents = {}

-- Weighted event type pool — higher weight = appears more often
local EVENT_TYPES = {
    'police_chase',
    'drug_deal',
    'protest',
    'vehicle_crash',
    'armed_robbery',
    'gang_war',
}

-- Configurable bounds (milliseconds)
local MIN_DURATION = 120000   --  2 minutes
local MAX_DURATION = 600000   -- 10 minutes
local MIN_INTERVAL = 600000   -- 10 minutes
local MAX_INTERVAL = 900000   -- 15 minutes
local INITIAL_DELAY = 30000   -- 30 s after resource start

-- Los Santos rough boundary (world units)
local SPAWN_X_MIN, SPAWN_X_MAX = -2000, 2000
local SPAWN_Y_MIN, SPAWN_Y_MAX = -2000, 2000
local SPAWN_Z_DEFAULT          = 30.0

-- ---------------------------------------------------------------------------
-- ATC.WorldEvents.SpawnEvent
-- Creates a tracked world event, broadcasts to all clients, schedules cleanup.
-- Returns the event id.
-- ---------------------------------------------------------------------------
function ATC.WorldEvents.SpawnEvent(eventType, coords, params)
    -- Generate a unique string id that does not collide with active events
    local id
    repeat
        id = tostring(math.random(100000, 999999))
    until not _activeEvents[id]

    _activeEvents[id] = {
        id        = id,
        type      = eventType,
        coords    = coords,
        params    = params or {},
        spawnTime = os.time(),
    }

    local payload = {
        id     = id,
        type   = eventType,
        coords = { x = coords.x, y = coords.y, z = coords.z },
        params = params or {},
    }

    TriggerClientEvent('atc:world:event:start', -1, payload)

    ATC.Log.Info('world_events', 'Dynamic event spawned', {
        id   = id,
        type = eventType,
        x    = coords.x,
        y    = coords.y,
    })

    -- Auto-cleanup after a random window
    local lifetime = math.random(MIN_DURATION, MAX_DURATION)
    SetTimeout(lifetime, function()
        ATC.WorldEvents.EndEvent(id)
    end)

    return id
end

-- ---------------------------------------------------------------------------
-- ATC.WorldEvents.EndEvent
-- Removes event from registry and notifies all clients to clean up blips.
-- ---------------------------------------------------------------------------
function ATC.WorldEvents.EndEvent(id)
    if not _activeEvents[id] then return end

    _activeEvents[id] = nil
    TriggerClientEvent('atc:world:event:end', -1, { id = id })

    ATC.Log.Info('world_events', 'Dynamic event ended', { id = id })
end

-- ---------------------------------------------------------------------------
-- ATC.WorldEvents.GetActive — diagnostic snapshot
-- ---------------------------------------------------------------------------
function ATC.WorldEvents.GetActive()
    local snapshot = {}
    for id, ev in pairs(_activeEvents) do
        snapshot[id] = {
            id        = ev.id,
            type      = ev.type,
            spawnTime = ev.spawnTime,
        }
    end
    return snapshot
end

-- ---------------------------------------------------------------------------
-- Seasonal event system
-- ---------------------------------------------------------------------------
ATC.WorldEvents.Seasonal = {}
local _activeSeasonal = nil

function ATC.WorldEvents.Seasonal.Start(seasonName, config)
    _activeSeasonal = { name=seasonName, config=config, startTime=os.time() }
    TriggerClientEvent('atc:world:seasonal:start', -1, { name=seasonName, config=config })
    ATC.Log.Info('world_events', 'Seasonal event started', { season=seasonName })
end

function ATC.WorldEvents.Seasonal.End()
    if not _activeSeasonal then return end
    local name = _activeSeasonal.name
    _activeSeasonal = nil
    TriggerClientEvent('atc:world:seasonal:end', -1, { name=name })
end

function ATC.WorldEvents.Seasonal.GetActive() return _activeSeasonal end

-- ---------------------------------------------------------------------------
-- Background loop: spawn a random world event every 10-15 minutes
-- ---------------------------------------------------------------------------
CreateThread(function()
    Wait(INITIAL_DELAY)

    while true do
        -- Select a random event type
        local eventType = EVENT_TYPES[math.random(#EVENT_TYPES)]

        -- Pick random coords within Los Santos
        local x = math.random(SPAWN_X_MIN, SPAWN_X_MAX)
        local y = math.random(SPAWN_Y_MIN, SPAWN_Y_MAX)

        ATC.WorldEvents.SpawnEvent(eventType, vector3(x, y, SPAWN_Z_DEFAULT), {})

        Wait(math.random(MIN_INTERVAL, MAX_INTERVAL))
    end
end)

-- ---------------------------------------------------------------------------
-- Natural disaster events
-- ---------------------------------------------------------------------------

--- Trigger a natural disaster world event and notify all clients.
--- @param disasterType string  e.g. 'earthquake', 'flood', 'wildfire'
--- @param coords vector3       Epicentre
--- @param intensity number     1 = minor, 2 = moderate, 3 = severe
--- @return string  Event id
function ATC.WorldEvents.TriggerDisaster(disasterType, coords, intensity)
    local id = ATC.WorldEvents.SpawnEvent('disaster_' .. tostring(disasterType), coords, { intensity = intensity or 1 })
    TriggerClientEvent('atc:world:disaster', -1, {
        id        = id,
        type      = disasterType,
        coords    = { x = coords.x, y = coords.y, z = coords.z },
        intensity = intensity or 1,
    })
    return id
end

-- ---------------------------------------------------------------------------
-- Economy events: market price fluctuations
-- ---------------------------------------------------------------------------

--- Broadcast a market fluctuation event to all clients.
--- @param eventType string  'surge' | 'crash'
--- @param itemName string   Item definition ID affected
--- @param magnitude number  Percentage change magnitude (10–50)
function ATC.WorldEvents.TriggerEconomyEvent(eventType, itemName, magnitude)
    ATC.Log.Info('economy_event', 'Market fluctuation', {
        type      = eventType,
        item      = itemName,
        magnitude = magnitude,
    })
    local msg = eventType == 'surge'
        and 'Market surge: ' .. tostring(itemName) .. ' prices rising'
        or  'Market crash: ' .. tostring(itemName) .. ' prices falling'
    TriggerClientEvent('atc:world:economy:event', -1, {
        type      = eventType,
        itemName  = itemName,
        magnitude = magnitude,
        message   = msg,
    })
end

-- Random economy event every 40–60 minutes
CreateThread(function()
    Wait(120000)   -- initial delay before first event
    while true do
        Wait(math.random(2400000, 3600000))   -- 40–60 min
        local items = { 'iron_ore', 'herbs', 'fish', 'drugs', 'scrap' }
        local types = { 'surge', 'crash' }
        ATC.WorldEvents.TriggerEconomyEvent(
            types[math.random(#types)],
            items[math.random(#items)],
            math.random(10, 50)
        )
    end
end)
