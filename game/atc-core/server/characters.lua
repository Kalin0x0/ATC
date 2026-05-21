-- ATC Core — Character Manager
-- Wraps character API calls and maintains local character state per source.
-- All accountId resolution happens server-side from the existing session.
-- The client sends only characterId; the server validates ownership via API.

ATC = ATC or {}
ATC.Characters = ATC.Characters or {}

-- ── Public API ───────────────────────────────────────────────────────────────

--- List active characters for the player's account.
--- Calls GET /api/v1/characters/account/:accountId
--- @param source number FiveM player source
--- @param callback function(ok, characters|nil)
function ATC.Characters.List(source, callback)
    local session = ATC.Sessions.Get(source)
    if not session or not session.accountId then
        ATC.Log.Warn('characters', 'List called with no session', { source = source })
        callback(false, nil)
        return
    end

    local path = '/api/v1/characters/account/' .. session.accountId
    ATC.HTTP.Get(path, function(ok, status, data, err)
        if not ok then
            ATC.Log.Error('characters', 'Character list API error', {
                source = source, status = status, err = err,
            })
            callback(false, nil)
            return
        end
        callback(true, data and data.characters or {})
    end)
end

--- Select a character for the player.
--- Calls PATCH /api/v1/sessions/:sessionId/character
--- Updates local session state on success.
--- @param source number FiveM player source
--- @param characterId string ULID of the character to select
--- @param callback function(ok, characterData|nil)
function ATC.Characters.Select(source, characterId, callback)
    local session = ATC.Sessions.Get(source)
    if not session then
        ATC.Log.Warn('characters', 'Select called with no session', { source = source })
        callback(false, nil)
        return
    end

    local path = '/api/v1/sessions/' .. session.id .. '/character'
    ATC.HTTP.Patch(path, { characterId = characterId }, function(ok, status, data, err)
        if not ok then
            ATC.Log.Error('characters', 'Character select API error', {
                source = source, status = status, characterId = characterId, err = err,
            })
            callback(false, nil)
            return
        end

        -- Update in-memory session with selected character and full response data
        ATC.Sessions.Update(source, { characterId = characterId, characterData = data })

        ATC.Log.Info('characters', 'Character selected', {
            source      = source,
            characterId = characterId,
            name        = (data and data.firstName or '?') .. ' ' .. (data and data.lastName or '?'),
        })

        -- Non-blocking vitals sync: push current server vitals to client
        -- Wrapped in function() so pcall catches nil-indexing of ATC.Vitals if the
        -- vitals module failed to load, not just errors inside Sync itself.
        SetTimeout(0, function()
            local ok, err = pcall(function() ATC.Vitals.Sync(source) end)
            if not ok then
                ATC.Log.Warn('characters', 'Vitals sync failed after character select', {
                    source = source, characterId = characterId, err = tostring(err),
                })
            end
        end)

        -- Non-blocking status effects sync: push current effects to client
        SetTimeout(0, function()
            local ok, err = pcall(function() ATC.StatusEffects.Sync(source) end)
            if not ok then
                ATC.Log.Warn('characters', 'Status effects sync failed after character select', {
                    source = source, characterId = characterId, err = tostring(err),
                })
            end
        end)

        callback(true, data)
    end)
end

--- Get the characterId currently attached to this player's session.
--- @param source number
--- @return string|nil
function ATC.Characters.GetSelectedId(source)
    local session = ATC.Sessions.Get(source)
    return session and session.characterId or nil
end

--- Get the full character data attached to this player's session.
--- Returns the API response data cached from the last Select call.
--- @param source number
--- @return table|nil
function ATC.Characters.GetSelected(source)
    local session = ATC.Sessions.Get(source)
    return session and session.characterData or nil
end
