-- ATC Jobs Plugin — Server
-- Duty toggling, job-state synchronisation and the payroll run loop.
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

--- First item of a paged API response, whatever the page is called.
--- @param data table|nil Decoded response body
--- @return table|nil
local function _firstItem(data)
    if type(data) ~= 'table' then return nil end
    local items = data.items or data.data or data.rows
    if type(items) ~= 'table' then return nil end
    return items[1]
end

-- Job catalogue cache, so a duty toggle does not fetch the whole catalogue.
-- Job definitions change through admin action, not during play, so a long TTL
-- costs nothing: a renamed job shows its new label on the next refresh.
local _jobNames    = {}
local _jobNamesAt  = 0

--- Refresh the jobId → name map from the job catalogue.
--- Best-effort: on failure the previous map is kept and callers fall back to
--- the raw jobId, which is a worse label but never a wrong one.
local function _refreshJobNames(cb)
    local ttl = ATC.JobsPlugin.Config.JobCatalogueTtlSeconds
    if _jobNamesAt > 0 and (os.time() - _jobNamesAt) < ttl then
        if cb then cb() end
        return
    end
    ATC.HTTP.Get('/api/v1/jobs?limit=100', function(ok, _status, data)
        if ok and type(data) == 'table' then
            local items = data.items or data.data or data.rows
            if type(items) == 'table' then
                local names = {}
                for _, job in ipairs(items) do
                    if type(job) == 'table' and job.id then
                        names[job.id] = job.name or job.slug or job.id
                    end
                end
                _jobNames   = names
                _jobNamesAt = os.time()
            end
        end
        if cb then cb() end
    end)
end

--- Human-readable name for a job, falling back to its id.
local function _jobLabel(jobId)
    if not jobId then return nil end
    return _jobNames[jobId] or jobId
end

--- The character's active employment contract, or nil when unemployed.
--- @param characterId string
--- @param cb function(ok, contract|nil)
local function _activeContract(characterId, cb)
    ATC.HTTP.Get('/api/v1/employment/character/' .. characterId .. '?status=active&limit=1',
    function(ok, status, data, err)
        if not ok then
            ATC.Log.Error('jobs', 'employment lookup failed', {
                characterId = characterId, status = status, err = err,
            })
            cb(false, nil)
            return
        end
        cb(true, _firstItem(data))
    end)
end

--- The character's open work session, or nil when clocked out.
--- An active work session *is* being on duty: the API has no separate duty
--- state, and atc_work_sessions is what payroll is computed from, so anything
--- else would pay for hours nobody recorded.
--- @param characterId string
--- @param cb function(ok, session|nil)
local function _activeSession(characterId, cb)
    ATC.HTTP.Get('/api/v1/work-sessions/character/' .. characterId .. '?status=active&limit=1',
    function(ok, status, data, err)
        if not ok then
            ATC.Log.Error('jobs', 'work-session lookup failed', {
                characterId = characterId, status = status, err = err,
            })
            cb(false, nil)
            return
        end
        cb(true, _firstItem(data))
    end)
end

--- Push the duty state to one player. The client reads onDuty and jobLabel, so
--- both are always set rather than being passed through from an API body that
--- carries neither.
--- @param src number
--- @param onDuty boolean
--- @param jobId string|nil
--- @param reason string|nil Why the state did not change, when it did not
local function _pushDuty(src, onDuty, jobId, reason)
    TriggerClientEvent('atc:jobs:duty:update', src, {
        onDuty   = onDuty,
        jobLabel = _jobLabel(jobId),
        reason   = reason,
    })
end

-- ── Firewall Events ───────────────────────────────────────────────────────────

--- atc:jobs:duty:toggle
--- Client requests to flip their on-duty / off-duty state.
--- On duty is modelled as an open work session:
---   clocked out → POST /api/v1/work-sessions/clock-in  (needs the contract)
---   clocked in  → POST /api/v1/work-sessions/clock-out
--- The API is authoritative — the resulting state comes from its response, not
--- from what the client asked for.
ATC.Firewall.On('atc:jobs:duty:toggle', {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { window = ATC.JobsPlugin.Config.DutyToggleCooldownMs, max = 5 },
}, function(src, _payload)
    local characterId = _getCharacterId(src)
    if not characterId then return end

    _refreshJobNames(function()
        _activeSession(characterId, function(ok, session)
            if not ok then return end

            if session then
                ATC.HTTP.Post('/api/v1/work-sessions/clock-out', {
                    characterId = characterId,
                }, function(cok, status, _data, err)
                    if not cok then
                        ATC.Log.Error('jobs', 'clock-out failed', {
                            source = src, characterId = characterId, status = status, err = err,
                        })
                        -- Still on duty: the session was not closed.
                        _pushDuty(src, true, session.jobId, 'clock_out_failed')
                        return
                    end
                    _pushDuty(src, false, session.jobId)
                end)
                return
            end

            _activeContract(characterId, function(cok, contract)
                if not cok then return end
                if not contract then
                    -- Nothing to clock into. Told plainly rather than silently
                    -- ignored, so the player knows why the key did nothing.
                    _pushDuty(src, false, nil, 'no_contract')
                    return
                end

                local ped    = GetPlayerPed(src)
                local coords = ped and GetEntityCoords(ped) or nil

                ATC.HTTP.Post('/api/v1/work-sessions/clock-in', {
                    contractId       = contract.id,
                    characterId      = characterId,
                    jobId            = contract.jobId,
                    locationMetadata = coords and {
                        x = coords.x, y = coords.y, z = coords.z,
                    } or nil,
                }, function(iok, status, _data, err)
                    if not iok then
                        ATC.Log.Error('jobs', 'clock-in failed', {
                            source = src, characterId = characterId,
                            contractId = contract.id, status = status, err = err,
                        })
                        _pushDuty(src, false, contract.jobId, 'clock_in_failed')
                        return
                    end
                    _pushDuty(src, true, contract.jobId)
                end)
            end)
        end)
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
    _refreshJobNames(function()
        _activeContract(characterId, function(ok, contract)
            if not ok then return end

            _activeSession(characterId, function(sok, session)
                -- A failed session lookup is reported as off duty, which is what
                -- the client would show anyway; it is not evidence of the state.
                TriggerClientEvent('atc:jobs:state:response', src, {
                    onDuty   = sok and session ~= nil,
                    jobLabel = contract and _jobLabel(contract.jobId) or nil,
                    contract = contract,
                    session  = session,
                })
            end)
        end)
    end)
end)

-- ── Payroll ───────────────────────────────────────────────────────────────────

--- Run payroll for one organisation over the period that just closed.
--- Two calls, as the API models it: /preview builds the run from the active
--- contracts, /commit posts it to the ledger. Preview is idempotent on the key,
--- so a retry after a failed commit reuses the same run instead of paying twice.
--- @param org table Entry from Config.PayrollOrganisations
--- @param periodStart string ISO 8601
--- @param periodEnd string ISO 8601
local function _runPayroll(org, periodStart, periodEnd)
    -- Derived from the period, not from a counter: two servers running the same
    -- period produce the same key and therefore the same run.
    local key = ('atc:payroll:%s:%s'):format(org.organizationId, periodStart)

    ATC.HTTP.Post('/api/v1/payroll/preview', {
        organizationId       = org.organizationId,
        periodStart          = periodStart,
        periodEnd            = periodEnd,
        currency             = org.currency,
        idempotencyKey       = key,
        createdByPrincipalId = org.createdByPrincipalId,
    }, function(ok, status, data, err)
        if not ok then
            ATC.Log.Error('jobs', 'payroll preview failed', {
                organizationId = org.organizationId, status = status, err = err,
            })
            return
        end

        local run = type(data) == 'table' and data.run or nil
        local runId = run and run.id or nil
        if not runId then
            ATC.Log.Error('jobs', 'payroll preview returned no run id', {
                organizationId = org.organizationId,
            })
            return
        end

        ATC.HTTP.Post('/api/v1/payroll/commit', {
            runId            = runId,
            orgAccountId     = org.orgAccountId,
            payrollAccountId = org.payrollAccountId,
        }, function(cok, cstatus, _cdata, cerr)
            if not cok then
                ATC.Log.Error('jobs', 'payroll commit failed', {
                    organizationId = org.organizationId, runId = runId,
                    status = cstatus, err = cerr,
                })
                return
            end
            ATC.Log.Info('jobs', 'Payroll committed', {
                organizationId = org.organizationId, runId = runId,
                periodStart = periodStart, periodEnd = periodEnd,
            })
        end)
    end)
end

--- Payroll runs per organisation and period, which is how the API models it —
--- there is no per-player tick, and the old one posted to a route that never
--- existed. Nothing fires unless PayrollOrganisations is filled in: an empty
--- list means this server does not run payroll, which is a valid setup and not
--- an error.
CreateThread(function()
    local orgs = ATC.JobsPlugin.Config.PayrollOrganisations
    if type(orgs) ~= 'table' or #orgs == 0 then
        ATC.Log.Info('jobs', 'Payroll is idle: no organisations configured. Add entries to PayrollOrganisations to run it.')
        return
    end

    local intervalMs  = ATC.JobsPlugin.Config.PayrollIntervalMs
    local intervalSec = math.floor(intervalMs / 1000)

    -- Aligned to the interval so restarts do not shift period boundaries and
    -- produce overlapping runs. The first run covers the period that closed
    -- most recently, so a restart mid-period does not skip it.
    local periodEndAt = math.floor(os.time() / intervalSec) * intervalSec

    while true do
        Wait(intervalMs)

        local periodStart = os.date('!%Y-%m-%dT%H:%M:%S.000Z', periodEndAt)
        periodEndAt = periodEndAt + intervalSec
        local periodEnd = os.date('!%Y-%m-%dT%H:%M:%S.000Z', periodEndAt)

        for _, org in ipairs(orgs) do
            if type(org) == 'table' and org.organizationId then
                _runPayroll(org, periodStart, periodEnd)
            end
        end
    end
end)

ATC.Log.Info('jobs', 'atc-jobs server initialised')
