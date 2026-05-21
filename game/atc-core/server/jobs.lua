-- ATC Core — Jobs Bridge
-- Server-side only. Character IDs are always resolved server-side from source.
-- CLIENTS CANNOT SELF-ASSIGN JOBS OR MODIFY EMPLOYMENT STATUS.
-- All clock-in/out must flow through server-side Lua with server-validated parameters.

ATC = ATC or {}
ATC.Jobs = ATC.Jobs or {}

-- ── Internal helpers ──────────────────────────────────────────────────────────

local function _getCharacterId(source)
    return ATC.Characters.GetSelectedId(source)
end

-- ── Public server API ─────────────────────────────────────────────────────────

--- Fetch a paginated list of active jobs.
--- @param callback function(ok, page|nil, errorCode|nil)
function ATC.Jobs.GetJobs(callback)
    ATC.HTTP.Get('/api/v1/jobs?status=active&limit=50', function(ok, status, data, err)
        if not ok then
            ATC.Log.Error('jobs', 'GetJobs API error', { status = status, err = err })
            callback(false, nil, 'API_ERROR')
            return
        end
        callback(true, data, nil)
    end)
end

--- Fetch all employment contracts for a character.
--- @param source       number  FiveM player source (character resolved server-side)
--- @param callback     function(ok, page|nil, errorCode|nil)
function ATC.Jobs.GetEmployment(source, callback)
    local characterId = _getCharacterId(source)
    if not characterId then
        ATC.Log.Warn('jobs', 'GetEmployment called with no character selected', { source = source })
        callback(false, nil, 'NO_CHARACTER')
        return
    end

    ATC.HTTP.Get(('/api/v1/employment/character/%s'):format(characterId), function(ok, status, data, err)
        if not ok then
            ATC.Log.Error('jobs', 'GetEmployment API error', {
                source = source, characterId = characterId, status = status, err = err,
            })
            callback(false, nil, 'API_ERROR')
            return
        end
        callback(true, data, nil)
    end)
end

--- Clock in a player's character to a job. Requires an active employment contract.
--- Character ID is always resolved server-side — never trust client input for this.
--- @param source       number  FiveM player source
--- @param contractId   string  Active employment contract ID (verified server-side)
--- @param jobId        string  Job ID (server-side reference only)
--- @param callback     function(ok, session|nil, errorCode|nil)
function ATC.Jobs.ClockIn(source, contractId, jobId, callback)
    local characterId = _getCharacterId(source)
    if not characterId then
        ATC.Log.Warn('jobs', 'ClockIn called with no character selected', { source = source })
        callback(false, nil, 'NO_CHARACTER')
        return
    end

    if type(contractId) ~= 'string' or contractId == '' then
        ATC.Log.Warn('jobs', 'ClockIn called with invalid contractId', {
            source = source, characterId = characterId, contractId = contractId,
        })
        callback(false, nil, 'INVALID_CONTRACT')
        return
    end

    -- FIX BUG-9: Validate jobId server-side — client cannot inject an arbitrary job reference.
    if type(jobId) ~= 'string' or jobId == '' then
        ATC.Log.Warn('jobs', 'ClockIn called with invalid jobId', {
            source = source, characterId = characterId, jobId = jobId,
        })
        callback(false, nil, 'INVALID_JOB')
        return
    end

    ATC.HTTP.Post('/api/v1/work-sessions/clock-in', {
        contractId   = contractId,
        characterId  = characterId,
        jobId        = jobId,
    }, function(ok, status, data, err)
        if not ok then
            local errorCode = 'API_ERROR'
            if data and data.error then
                errorCode = data.error
            end
            ATC.Log.Error('jobs', 'ClockIn API error', {
                source = source, characterId = characterId, contractId = contractId,
                status = status, errorCode = errorCode,
            })
            callback(false, nil, errorCode)
            return
        end
        ATC.Log.Info('jobs', 'ClockIn success', {
            source = source, characterId = characterId, sessionId = data and data.id,
        })
        callback(true, data, nil)
    end)
end

--- Clock out a player's character from their active work session.
--- Character ID is always resolved server-side.
--- @param source       number  FiveM player source
--- @param callback     function(ok, session|nil, errorCode|nil)
function ATC.Jobs.ClockOut(source, callback)
    local characterId = _getCharacterId(source)
    if not characterId then
        ATC.Log.Warn('jobs', 'ClockOut called with no character selected', { source = source })
        callback(false, nil, 'NO_CHARACTER')
        return
    end

    ATC.HTTP.Post('/api/v1/work-sessions/clock-out', {
        characterId = characterId,
    }, function(ok, status, data, err)
        if not ok then
            local errorCode = 'API_ERROR'
            if data and data.error then
                errorCode = data.error
            end
            ATC.Log.Error('jobs', 'ClockOut API error', {
                source = source, characterId = characterId,
                status = status, errorCode = errorCode,
            })
            callback(false, nil, errorCode)
            return
        end
        ATC.Log.Info('jobs', 'ClockOut success', {
            source = source, characterId = characterId, sessionId = data and data.id,
        })
        callback(true, data, nil)
    end)
end
