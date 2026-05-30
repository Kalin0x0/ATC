-- =============================================================================
-- ATC NPC World — Phase 96
-- Ambient population schedules and crime-reactive NPC behaviour
-- =============================================================================

ATC         = ATC         or {}
ATC.NPCWorld = ATC.NPCWorld or {}

-- ---------------------------------------------------------------------------
-- Schedule table (sorted ascending by hour)
-- Each entry drives density + mood for a named zone.
-- ---------------------------------------------------------------------------
local _schedules = {
    { hour = 0,  zone = 'downtown', density = 'verylow', mood = 'nervous'  },
    { hour = 6,  zone = 'downtown', density = 'low',     mood = 'calm'     },
    { hour = 9,  zone = 'downtown', density = 'high',    mood = 'busy'     },
    { hour = 18, zone = 'downtown', density = 'medium',  mood = 'relaxed'  },
    { hour = 22, zone = 'downtown', density = 'low',     mood = 'cautious' },
}

local _currentSchedule = nil

-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------
local function _getHour()
    return math.floor(GetClockHours())
end

-- Find the schedule entry whose hour is the highest that is <= current hour.
-- Falls back to midnight (hour=0) entry when no earlier match exists.
local function _findSchedule(hour)
    local best = _schedules[1]
    for _, s in ipairs(_schedules) do
        if s.hour <= hour and s.hour >= best.hour then
            best = s
        end
    end
    return best
end

-- ---------------------------------------------------------------------------
-- ATC.NPCWorld.Tick — called every in-game minute cycle
-- Pushes new world-state to all clients when the schedule changes.
-- ---------------------------------------------------------------------------
function ATC.NPCWorld.Tick()
    local hour     = _getHour()
    local schedule = _findSchedule(hour)

    if _currentSchedule ~= schedule then
        _currentSchedule = schedule

        TriggerClientEvent('atc:world:npc:schedule', -1, {
            density = schedule.density,
            mood    = schedule.mood,
            hour    = hour,
            zone    = schedule.zone,
        })

        ATC.Log.Debug('npc_world', 'Schedule updated', {
            hour    = hour,
            density = schedule.density,
            mood    = schedule.mood,
        })
    end
end

-- ---------------------------------------------------------------------------
-- Hourly world tick (every 60 s of real time == ~1 in-game hour at 48x speed)
-- ---------------------------------------------------------------------------
CreateThread(function()
    while true do
        ATC.NPCWorld.Tick()
        Wait(60000)
    end
end)

-- ---------------------------------------------------------------------------
-- React to active dispatch calls: push a flee reaction to clients near
-- the incident coordinates.
-- ---------------------------------------------------------------------------
AddEventHandler('atc:dispatch:call:new', function(call)
    if not call                        then return end
    if call.type ~= 'police'           then return end
    if not call.coords                 then return end

    TriggerClientEvent('atc:world:npc:reaction', -1, {
        type   = 'flee',
        coords = { x = call.coords.x, y = call.coords.y, z = call.coords.z },
        radius = 100.0,
    })

    ATC.Log.Debug('npc_world', 'Flee reaction triggered', {
        x = call.coords.x,
        y = call.coords.y,
    })
end)
