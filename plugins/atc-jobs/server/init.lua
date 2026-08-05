-- ATC Jobs Plugin — Server
-- Duty toggling, job-state synchronisation and server-side payroll tick.
-- Character IDs are resolved from the server session — never from client payload.

ATC           = ATC           or {}
ATC.JobsPlugin = ATC.JobsPlugin or {}

-- ── Internal helpers ──────────────────────────────────────────────────────────

-- Set once the disabled-feature warning has been emitted, so a player mashing
-- the duty key does not flood the log with the same line.
local _warnedDuty = false

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

    if not ATC.JobsPlugin.Config.DutyApiEnabled then
        -- No duty endpoint exists, so there is nothing to call. Warn once per
        -- boot instead of per toggle: repeating it for every button press would
        -- bury the one message that matters.
        if not _warnedDuty then
            _warnedDuty = true
            ATC.Log.Warn('jobs', 'Duty toggling is disabled: the API serves no duty endpoint. See DutyApiEnabled in the plugin config.')
        end
        return
    end

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

    -- Employment lives under /api/v1/employment, not /api/v1/jobs — the latter
    -- is the job catalogue (definitions and grades), not who works where.
    -- The response is a page of contracts, so the active one is picked out here
    -- rather than handing the raw page to the client.
    ATC.HTTP.Get('/api/v1/employment/character/' .. characterId .. '?status=active&limit=1',
    function(ok, status, data, err)
        if not ok then
            ATC.Log.Error('jobs', 'state:request API error', {
                source = src, characterId = characterId, status = status, err = err,
            })
            return
        end

        local items    = (type(data) == 'table' and (data.items or data.data or data.rows)) or nil
        local contract = (type(items) == 'table' and items[1]) or nil

        -- onDuty has no server-side source: no duty endpoint, and no duty
        -- column on atc_employment_contracts. It is reported as false so the
        -- client keeps a defined state, not because the player is known to be
        -- off duty. Revisit together with DutyApiEnabled.
        TriggerClientEvent('atc:jobs:state:response', src, {
            onDuty   = false,
            jobLabel = contract and (contract.jobLabel or contract.jobId) or nil,
            contract = contract,
        })
    end)
end)

-- ── Payroll Thread ────────────────────────────────────────────────────────────

--- Fires a payroll tick for every player that has an active character session,
--- every PayrollIntervalMs (default 30 min).
--- Dormant unless PayrollApiEnabled is set: the endpoint it posts to does not
--- exist, and the note that once stood here — that the API filters by duty
--- state so only on-duty characters are paid — was not true of any endpoint the
--- API serves. Payroll there runs per organisation and period.
CreateThread(function()
    if not ATC.JobsPlugin.Config.PayrollApiEnabled then
        ATC.Log.Warn('jobs', 'Payroll ticks are disabled: the API models payroll per organisation and period (POST /api/v1/payroll/preview, then /commit), not per character. See PayrollApiEnabled in the plugin config.')
        return
    end

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
