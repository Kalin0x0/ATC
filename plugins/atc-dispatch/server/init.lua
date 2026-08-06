-- atc-dispatch — Server Init
-- Handles 911 calls from players and internal dispatch events from other plugins.
-- Persists all calls to the API and notifies on-duty LEOs.

ATC.DispatchPlugin = ATC.DispatchPlugin or {}

-- ── Local Responder Fan-out ───────────────────────────────────────────────────
-- Alerting on-duty responders is a purely server-local broadcast: every field the
-- client renders is already known here before the API is ever contacted. It must
-- not be gated on the persistence request — a rejected or dropped POST cannot be
-- allowed to silence a live 911 call.
-- Only on-duty responders are targeted; broadcasting with -1 would push sensitive
-- call data to all clients.
--- @param jobs table  set of allowed job names, e.g. { police = true }
--- @param call table  locally built call payload
local function _notifyOnDuty(jobs, call)
    for _, playerId in ipairs(GetPlayers()) do
        local pid     = tonumber(playerId)
        local session = ATC.Sessions and ATC.Sessions.Get(pid)
        if session and session.onDuty and jobs[session.job] then
            TriggerClientEvent(ATC.Events.DISPATCH.CALL_RECEIVED, pid, call)
        end
    end
end

local POLICE_ONLY   = { police = true }
local POLICE_AND_EMS = { police = true, ems = true }

-- createDispatchCallSchema requires a single free-text location string, so world
-- coordinates are flattened for the API. The client fan-out keeps the vector.
local function _formatLocation(coords)
    if not coords then return 'Unknown location' end
    return ('%.2f, %.2f, %.2f'):format(coords.x, coords.y, coords.z)
end

local function _makeIdempotencyKey(kind)
    return ('atc:dispatch:%s:%d:%d'):format(kind, os.time(), math.random(1, 999999999))
end

-- ── Player 911 Call ───────────────────────────────────────────────────────────
-- Players use the /911 command (registered client-side) to fire this event.
-- Message length is capped server-side; priority is always 'medium' for
-- player-generated calls.
ATC.Firewall.On('atc:dispatch:911', {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { window = 30000, max = 3 },
}, function(src, payload)
    -- Sanitize and cap message length — never trust raw client strings
    local message = (type(payload) == 'table' and type(payload.message) == 'string')
        and payload.message
        or 'Emergency'
    message = message:sub(1, 128)

    local ped    = GetPlayerPed(src)
    local coords = GetEntityCoords(ped)

    -- Built entirely from server-trusted state — no field comes from the API.
    local call = {
        callType    = 'player_911',
        priority    = 'medium',
        description = message,
        coords      = { x = coords.x, y = coords.y, z = coords.z },
    }

    -- Acknowledge back to caller
    TriggerClientEvent('atc:dispatch:call:received', src, call)

    -- Push to all on-duty police officers
    _notifyOnDuty(POLICE_ONLY, call)

    -- Persistence only. Nothing above depends on the response body, and the
    -- create schema carries no call-type field, so 'player_911' stays local.
    ATC.HTTP.Post('/api/v1/dispatch/calls', {
        source           = 'civilian',
        callerIdentifier = ATC.Accounts.GetPrincipalId(src),
        location         = _formatLocation(coords),
        priority         = call.priority,
        description      = message,
        idempotencyKey   = _makeIdempotencyKey('911'),
    }, function(ok, status)
        if not ok then
            ATC.Log.Warn('dispatch', '911 call failed to persist', {
                source     = src,
                httpStatus = status,
            })
        end
    end)
end)

-- ── Internal Dispatch Bus ─────────────────────────────────────────────────────
-- Other plugins (e.g. atc-combat) fire the server-local event 'atc:dispatch:call:new'
-- to inject automated dispatch calls without touching the client.
-- This is a plain AddEventHandler because the source is always the server itself.
AddEventHandler('atc:dispatch:call:new', function(callData)
    if type(callData) ~= 'table' then return end

    -- 1:1 translation of the previous numeric scale onto the API priority enum:
    -- callers pass 'high' for urgent calls, anything else is a routine call.
    local priority = (callData.priority == 'high') and 'high' or 'medium'
    local coords   = callData.coords

    local call = {
        callType    = callData.type    or 'internal',
        priority    = priority,
        description = callData.message or 'Dispatch call',
        coords      = coords and { x = coords.x, y = coords.y, z = coords.z } or nil,
    }

    -- Notify only on-duty officers/EMS — mirrors the player 911 filter.
    _notifyOnDuty(POLICE_AND_EMS, call)

    -- Persistence only. The fan-out above is already done and reads nothing
    -- from the response; callData.type has no home in the create schema.
    ATC.HTTP.Post('/api/v1/dispatch/calls', {
        source         = 'automated',
        location       = _formatLocation(coords),
        priority       = priority,
        description    = call.description,
        idempotencyKey = _makeIdempotencyKey('internal'),
    }, function(ok, status)
        if not ok then
            ATC.Log.Warn('dispatch', 'Internal dispatch call failed to persist', {
                httpStatus = status,
                callType   = callData.type,
            })
        end
    end)
end)
