-- ATC Jobs Plugin — Server
-- Duty toggling, job-state synchronisation and server-side payroll tick.
-- Character IDs are resolved from the server session — never from client payload.

ATC           = ATC           or {}
ATC.JobsPlugin = ATC.JobsPlugin or {}

-- ── Internal helpers ──────────────────────────────────────────────────────────

--- Safely resolve characterId from session.
--- Returns nil (and logs) if no session or no character is selected.
--- @param source number FiveM player source
--- @return string|nil
local function _getCharacterId(source)
    local session = ATC.Sessions.Get(source)
    if not session then
        ATC.Log.Warn('jobs', 'No session for source', { source = source })
        return nil
    end
    if not session.characterId then
        ATC.Log.Warn('jobs', 'No character selected', { source = source })
        return nil
    end
    return session.characterId
end

-- ── Firewall Events ───────────────────────────────────────────────────────────

--- atc:jobs:duty:toggle
--- Client requests to flip their on-duty / off-duty state.
--- The API is authoritative: it returns the new job state on success.
ATC.Firewall.On('atc:jobs:duty:toggle', {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { window = ATC.JobsPlugin.Config.DutyToggleCooldownMs, max = 5 },
}, function(src, _payload)
    local characterId = _getCharacterId(src)
    if not characterId then return end

    ATC.HTTP.Post('/api/v1/jobs/duty/toggle', {
        characterId = characterId,
    }, function(ok, status, data, err)
        if not ok then
            ATC.Log.Error('jobs', 'duty:toggle API error', {
                source = src, characterId = characterId, status = status, err = err,
            })
            return
        end
        -- Broadcast the new duty state back to the client.
        TriggerClientEvent('atc:jobs:duty:update', src, data)
    end)
end)

--- atc:jobs:state:request
--- Client requests the current job state (called after character selection).
ATC.Firewall.On('atc:jobs:state:request', {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { window = 5000, max = 3 },
}, function(src, _payload)
    local characterId = _getCharacterId(src)
    if not characterId then return end

    ATC.HTTP.Get('/api/v1/jobs/character/' .. characterId, function(ok, status, data, err)
        if not ok then
            ATC.Log.Error('jobs', 'state:request API error', {
                source = src, characterId = characterId, status = status, err = err,
            })
            return
        end
        TriggerClientEvent('atc:jobs:state:response', src, data)
    end)
end)

-- ── Payroll Thread ────────────────────────────────────────────────────────────

--- Fires a payroll tick for every player that has an active character session.
--- The API handles duty-state filtering — only on-duty characters receive pay.
--- Runs every PayrollIntervalMs (default 30 min). Using CreateThread + Wait
--- instead of a cron to keep payroll server-local and avoid event-bus overhead.
CreateThread(function()
    while true do
        Wait(ATC.JobsPlugin.Config.PayrollIntervalMs)

        local players = GetPlayers()
        local ticked  = 0

        for _, playerId in ipairs(players) do
            local src         = tonumber(playerId)
            local characterId = _getCharacterId(src)

            if characterId then
                ticked = ticked + 1
                ATC.HTTP.Post('/api/v1/jobs/payroll/tick', {
                    characterId = characterId,
                }, function(ok, status, _data, err)
                    if not ok then
                        ATC.Log.Warn('jobs', 'payroll:tick API error', {
                            source = src, characterId = characterId,
                            status = status, err = err,
                        })
                    end
                end)
            end
        end

        if ticked > 0 then
            ATC.Log.Info('jobs', 'Payroll tick dispatched', { count = ticked })
        end
    end
end)

ATC.Log.Info('jobs', 'atc-jobs server initialised')
