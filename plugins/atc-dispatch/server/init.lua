-- atc-dispatch — Server Init
-- Handles 911 calls from players and internal dispatch events from other plugins.
-- Persists all calls to the API and notifies on-duty LEOs.

ATC.DispatchPlugin = ATC.DispatchPlugin or {}

-- ── Player 911 Call ───────────────────────────────────────────────────────────
-- Players use the /911 command (registered client-side) to fire this event.
-- Message length is capped server-side; priority is always 2 for player-generated calls.
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

    ATC.HTTP.Post('/api/v1/dispatch/calls', {
        callType              = 'player_911',
        priority              = 2,
        description           = message,
        reportedByPrincipalId = ATC.Accounts.GetPrincipalId(src),
        locationX             = coords.x,
        locationY             = coords.y,
        locationZ             = coords.z,
    }, function(ok, status, data)
        if ok then
            -- Acknowledge back to caller
            TriggerClientEvent('atc:dispatch:call:received', src, data)

            -- Push to all on-duty police officers
            for _, playerId in ipairs(GetPlayers()) do
                local pid     = tonumber(playerId)
                local session = ATC.Sessions and ATC.Sessions.Get(pid)
                if session and session.job == 'police' and session.onDuty then
                    TriggerClientEvent(ATC.Events.DISPATCH.CALL_RECEIVED, pid, data)
                end
            end
        else
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

    local priority = (callData.priority == 'high') and 1 or 2

    ATC.HTTP.Post('/api/v1/dispatch/calls', {
        callType    = callData.type    or 'internal',
        priority    = priority,
        description = callData.message or 'Dispatch call',
        locationX   = callData.coords and callData.coords.x,
        locationY   = callData.coords and callData.coords.y,
        locationZ   = callData.coords and callData.coords.z,
    }, function(ok, status, data)
        if ok then
            -- Notify only on-duty officers/EMS — mirrors the player 911 filter.
            -- Broadcasting with -1 would push sensitive call data to all clients.
            for _, playerId in ipairs(GetPlayers()) do
                local pid     = tonumber(playerId)
                local session = ATC.Sessions and ATC.Sessions.Get(pid)
                if session and (session.job == 'police' or session.job == 'ems') and session.onDuty then
                    TriggerClientEvent(ATC.Events.DISPATCH.CALL_RECEIVED, pid, data)
                end
            end
        else
            ATC.Log.Warn('dispatch', 'Internal dispatch call failed to persist', {
                httpStatus = status,
                callType   = callData.type,
            })
        end
    end)
end)
