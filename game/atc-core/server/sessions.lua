-- ATC Core — Player Session Manager
-- In-memory session store keyed by source.
-- accountId and session.id are populated from the REST API on CLIENT_READY.

ATC = ATC or {}
ATC.Sessions = ATC.Sessions or {}

local _sessions = {}  -- source (number) → session table
local _pending  = {}  -- source (number) → { accountId } stored during playerConnecting

-- ── Public API ───────────────────────────────────────────────────────────────

--- Create a new session for a connected player.
--- @param source number FiveM player source
--- @param identifier string Primary license identifier
--- @param opts table { language?, id?, accountId? }
--- @return table session
function ATC.Sessions.Create(source, identifier, opts)
    opts = opts or {}

    local language = opts.language or ATC.Config.DefaultLocale
    if not ATC.Locales.IsSupported(language) then
        language = ATC.Config.DefaultLocale
    end

    local session = {
        id          = opts.id or (identifier .. '_' .. tostring(os.time())),
        accountId   = opts.accountId or nil,
        source      = source,
        identifier  = identifier,
        connectedAt = os.time(),
        lastSeen    = os.time(),
        language    = language,
        characterId   = nil,
        characterData = nil,
        isActive    = true,
    }

    _sessions[source] = session

    ATC.Log.Info('sessions', 'Session created', {
        source     = source,
        identifier = identifier,
        language   = language,
    })

    return session
end

--- Retrieve an active session by FiveM source.
--- @param source number
--- @return table|nil
function ATC.Sessions.Get(source)
    return _sessions[source]
end

--- Update fields on an existing session.
--- @param source number
--- @param data table Key-value pairs to merge
--- @return boolean success
function ATC.Sessions.Update(source, data)
    if not _sessions[source] then return false end
    for k, v in pairs(data) do
        _sessions[source][k] = v
    end
    _sessions[source].lastSeen = os.time()
    return true
end

--- Remove a session on player disconnect.
--- @param source number
function ATC.Sessions.Remove(source)
    local session = _sessions[source]
    if not session then return end

    local duration = os.time() - session.connectedAt

    ATC.Log.Info('sessions', 'Session removed', {
        source     = source,
        identifier = session.identifier,
        language   = session.language,
        durationSeconds = duration,
    })

    _sessions[source] = nil
    _pending[source]  = nil
end

--- Return all active sessions (read-only reference).
function ATC.Sessions.GetAll()
    return _sessions
end

--- Return count of active sessions.
function ATC.Sessions.Count()
    local n = 0
    for _ in pairs(_sessions) do n = n + 1 end
    return n
end

--- Check whether a source has an active session.
function ATC.Sessions.IsActive(source)
    return _sessions[source] ~= nil
end

--- Store pending account data between playerConnecting and CLIENT_READY.
--- @param source number
--- @param data table { accountId }
function ATC.Sessions.StorePending(source, data)
    _pending[source] = data
end

--- Consume and clear pending data for a source.
--- @param source number
--- @return table|nil
function ATC.Sessions.ConsumePending(source)
    local data = _pending[source]
    _pending[source] = nil
    return data
end

--- Return the characterId currently selected by this player.
--- Alias for plugins that prefer the Sessions namespace.
--- @param source number
--- @return string|nil
function ATC.Sessions.GetCharacterId(source)
    local session = _sessions[source]
    return session and session.characterId or nil
end
