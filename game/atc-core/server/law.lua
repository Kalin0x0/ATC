-- ATC Core — Law Enforcement Bridge
-- Server-side only. All law enforcement operations are server-authoritative.
-- Characters are always resolved server-side from source.
-- CLIENTS CANNOT SELF-REPORT ARRESTS, WARRANTS, OR JAIL STATE.

ATC = ATC or {}
ATC.Law = ATC.Law or {}

-- ── Internal helpers ──────────────────────────────────────────────────────────

local function _getCharacterId(source)
    return ATC.Characters.GetSelectedId(source)
end

local function _principalId(source)
    return ATC.Accounts.GetPrincipalId(source)
end

-- ── Warrants ──────────────────────────────────────────────────────────────────

--- Fetch all warrants for a character (server-resolved from source).
--- @param source    number  FiveM player source (character resolved server-side)
--- @param callback  function(ok, warrants|nil, errorCode|nil)
function ATC.Law.GetWarrants(source, callback)
    local characterId = _getCharacterId(source)
    if not characterId then
        ATC.Log.Warn('law', 'GetWarrants called with no character selected', { source = source })
        callback(false, nil, 'NO_CHARACTER')
        return
    end

    ATC.HTTP.Get(('/api/v1/law/warrants?characterId=%s&status=active'):format(characterId), function(ok, status, data, err)
        if not ok then
            ATC.Log.Error('law', 'GetWarrants API error', {
                source = source, characterId = characterId, status = status, err = err,
            })
            callback(false, nil, 'API_ERROR')
            return
        end
        callback(true, data and data.items or {}, nil)
    end)
end

--- Issue a warrant against a character. Only callable server-side from authorized officer logic.
--- The issuedByPrincipalId is resolved from the officer source — clients cannot inject this.
--- @param officerSource  number  FiveM source of the issuing officer
--- @param targetCharId   string  Target character ID (server-verified)
--- @param agencyId       string  Agency ID
--- @param severity       string  'infraction' | 'misdemeanor' | 'felony'
--- @param reason         string
--- @param expiresAt      string|nil  ISO-8601 datetime or nil
--- @param callback       function(ok, warrant|nil, errorCode|nil)
function ATC.Law.IssueWarrant(officerSource, targetCharId, agencyId, severity, reason, expiresAt, callback)
    if type(targetCharId) ~= 'string' or targetCharId == '' then
        callback(false, nil, 'INVALID_CHARACTER')
        return
    end
    if type(agencyId) ~= 'string' or agencyId == '' then
        callback(false, nil, 'INVALID_AGENCY')
        return
    end
    if type(reason) ~= 'string' or reason == '' then
        callback(false, nil, 'INVALID_REASON')
        return
    end

    local principalId = _principalId(officerSource)
    if not principalId then
        callback(false, nil, 'NO_PRINCIPAL')
        return
    end

    local body = {
        characterId         = targetCharId,
        issuedByPrincipalId = principalId,
        agencyId            = agencyId,
        severity            = severity,
        reason              = reason,
    }
    if type(expiresAt) == 'string' then
        body.expiresAt = expiresAt
    end

    ATC.HTTP.Post('/api/v1/law/warrants', body, function(ok, status, data, err)
        if not ok then
            ATC.Log.Error('law', 'IssueWarrant API error', {
                officerSource = officerSource, targetCharId = targetCharId, status = status, err = err,
            })
            callback(false, nil, 'API_ERROR')
            return
        end
        callback(true, data, nil)
    end)
end

-- ── Citations ─────────────────────────────────────────────────────────────────

--- Issue a citation (fine) against a character.
--- Officer principal ID is resolved server-side — clients cannot inject this.
--- @param officerSource  number  FiveM source of the issuing officer
--- @param targetCharId   string  Target character ID
--- @param agencyId       string  Agency ID
--- @param reason         string
--- @param amount         number  Fine amount (positive)
--- @param currency       string  e.g. 'USD'
--- @param idempotencyKey string  Client-generated idempotency key
--- @param callback       function(ok, citation|nil, errorCode|nil)
function ATC.Law.IssueCitation(officerSource, targetCharId, agencyId, reason, amount, currency, idempotencyKey, callback)
    if type(targetCharId) ~= 'string' or targetCharId == '' then
        callback(false, nil, 'INVALID_CHARACTER')
        return
    end
    if type(agencyId) ~= 'string' or agencyId == '' then
        callback(false, nil, 'INVALID_AGENCY')
        return
    end
    if type(reason) ~= 'string' or reason == '' then
        callback(false, nil, 'INVALID_REASON')
        return
    end
    if type(amount) ~= 'number' or amount <= 0 then
        callback(false, nil, 'INVALID_AMOUNT')
        return
    end
    if type(idempotencyKey) ~= 'string' or idempotencyKey == '' then
        callback(false, nil, 'INVALID_IDEMPOTENCY_KEY')
        return
    end

    local principalId = _principalId(officerSource)
    if not principalId then
        callback(false, nil, 'NO_PRINCIPAL')
        return
    end

    local body = {
        characterId         = targetCharId,
        issuedByPrincipalId = principalId,
        agencyId            = agencyId,
        reason              = reason,
        amount              = amount,
        currency            = currency or 'USD',
        idempotencyKey      = idempotencyKey,
    }

    ATC.HTTP.Post('/api/v1/law/citations', body, function(ok, status, data, err)
        if not ok then
            ATC.Log.Error('law', 'IssueCitation API error', {
                officerSource = officerSource, targetCharId = targetCharId, status = status, err = err,
            })
            callback(false, nil, 'API_ERROR')
            return
        end
        callback(true, data, nil)
    end)
end

-- ── Arrests ───────────────────────────────────────────────────────────────────

--- Record an arrest. Officer and character IDs are resolved server-side.
--- @param officerSource  number  FiveM source of the arresting officer
--- @param targetCharId   string  Target character ID (server-verified)
--- @param agencyId       string  Agency ID
--- @param severity       string  'infraction' | 'misdemeanor' | 'felony'
--- @param reason         string
--- @param warrantId      string|nil  Optional associated warrant ID
--- @param notes          string|nil  Optional arrest notes
--- @param callback       function(ok, arrest|nil, errorCode|nil)
function ATC.Law.RecordArrest(officerSource, targetCharId, agencyId, severity, reason, warrantId, notes, callback)
    if type(targetCharId) ~= 'string' or targetCharId == '' then
        callback(false, nil, 'INVALID_CHARACTER')
        return
    end
    if type(agencyId) ~= 'string' or agencyId == '' then
        callback(false, nil, 'INVALID_AGENCY')
        return
    end
    if type(reason) ~= 'string' or reason == '' then
        callback(false, nil, 'INVALID_REASON')
        return
    end

    local principalId = _principalId(officerSource)
    if not principalId then
        callback(false, nil, 'NO_PRINCIPAL')
        return
    end

    local body = {
        characterId            = targetCharId,
        arrestedByPrincipalId  = principalId,
        agencyId               = agencyId,
        severity               = severity,
        reason                 = reason,
    }
    if type(warrantId) == 'string' and warrantId ~= '' then
        body.warrantId = warrantId
    end
    if type(notes) == 'string' and notes ~= '' then
        body.notes = notes
    end

    ATC.HTTP.Post('/api/v1/law/arrests', body, function(ok, status, data, err)
        if not ok then
            ATC.Log.Error('law', 'RecordArrest API error', {
                officerSource = officerSource, targetCharId = targetCharId, status = status, err = err,
            })
            callback(false, nil, 'API_ERROR')
            return
        end
        callback(true, data, nil)
    end)
end

-- ── Jail State ────────────────────────────────────────────────────────────────

--- Get the active jail record for a character (server-resolved from source).
--- Returns nil if no active jail record exists.
--- @param source    number  FiveM player source
--- @param callback  function(ok, jailRecord|nil, errorCode|nil)
function ATC.Law.GetJailState(source, callback)
    local characterId = _getCharacterId(source)
    if not characterId then
        ATC.Log.Warn('law', 'GetJailState called with no character selected', { source = source })
        callback(false, nil, 'NO_CHARACTER')
        return
    end

    ATC.HTTP.Get(('/api/v1/law/jail/character/%s'):format(characterId), function(ok, status, data, err)
        if not ok then
            ATC.Log.Error('law', 'GetJailState API error', {
                source = source, characterId = characterId, status = status, err = err,
            })
            callback(false, nil, 'API_ERROR')
            return
        end
        callback(true, data, nil)
    end)
end

--- Place a character into jail (server-side only — clients never call this directly).
--- @param targetCharId    string  Target character ID
--- @param arrestRecordId  string  Associated arrest record ID
--- @param releaseAt       string|nil  ISO-8601 datetime or nil
--- @param callback        function(ok, jailRecord|nil, errorCode|nil)
function ATC.Law.EnterJail(targetCharId, arrestRecordId, releaseAt, callback)
    if type(targetCharId) ~= 'string' or targetCharId == '' then
        callback(false, nil, 'INVALID_CHARACTER')
        return
    end
    if type(arrestRecordId) ~= 'string' or arrestRecordId == '' then
        callback(false, nil, 'INVALID_ARREST_RECORD')
        return
    end

    local body = {
        characterId    = targetCharId,
        arrestRecordId = arrestRecordId,
    }
    if type(releaseAt) == 'string' then
        body.releaseAt = releaseAt
    end

    ATC.HTTP.Post('/api/v1/law/jail', body, function(ok, status, data, err)
        if not ok then
            ATC.Log.Error('law', 'EnterJail API error', {
                targetCharId = targetCharId, arrestRecordId = arrestRecordId, status = status, err = err,
            })
            callback(false, nil, 'API_ERROR')
            return
        end
        callback(true, data, nil)
    end)
end

--- Release a character from jail (server-side only).
--- @param jailRecordId         string  Jail record ID to release
--- @param releasedByPrincipalId string  Principal ID of the releasing officer
--- @param callback             function(ok, jailRecord|nil, errorCode|nil)
function ATC.Law.ReleaseFromJail(jailRecordId, releasedByPrincipalId, callback)
    if type(jailRecordId) ~= 'string' or jailRecordId == '' then
        callback(false, nil, 'INVALID_JAIL_RECORD')
        return
    end
    if type(releasedByPrincipalId) ~= 'string' or releasedByPrincipalId == '' then
        callback(false, nil, 'INVALID_PRINCIPAL')
        return
    end

    local body = { releasedByPrincipalId = releasedByPrincipalId }

    ATC.HTTP.Post(('/api/v1/law/jail/%s/release'):format(jailRecordId), body, function(ok, status, data, err)
        if not ok then
            ATC.Log.Error('law', 'ReleaseFromJail API error', {
                jailRecordId = jailRecordId, status = status, err = err,
            })
            callback(false, nil, 'API_ERROR')
            return
        end
        callback(true, data, nil)
    end)
end
