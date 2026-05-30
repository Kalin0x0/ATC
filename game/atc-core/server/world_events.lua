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
