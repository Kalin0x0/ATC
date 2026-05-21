-- ATC Core — Status Effects
-- Server-side status effect read/apply/clear via REST API.
-- Client may only read effects; all mutation is server-authoritative.

ATC = ATC or {}
ATC.StatusEffects = ATC.StatusEffects or {}

-- ── Internal helpers ─────────────────────────────────────────────────────────

local function _getCharacterId(source)
    return ATC.Characters.GetSelectedId(source)
end

local function _basePath(characterId)
    return '/api/v1/status-effects/character/' .. characterId
end

-- ── Public server API ─────────────────────────────────────────────────────────

--- Fetch active status effects for the player's selected character.
--- @param source number FiveM player source
--- @param callback function(ok, data|nil)
function ATC.StatusEffects.Get(source, callback)
    local characterId = _getCharacterId(source)
    if not characterId then
        ATC.Log.Warn('status_effects', 'Get called with no selected character', { source = source })
        if callback then callback(false, nil) end
        return
    end

    ATC.HTTP.Get(_basePath(characterId), function(ok, status, data, err)
        if not ok then
            ATC.Log.Error('status_effects', 'Get API error', {
                source = source, characterId = characterId, status = status, err = err,
            })
            if callback then callback(false, nil) end
            return
        end
        if callback then callback(true, data) end
    end)
end

--- Apply a status effect to the player's selected character. Server-only.
--- @param source number FiveM player source
--- @param effect table { type, severity, source, reason, durationSeconds? }
--- @param callback function(ok, effect|nil)
function ATC.StatusEffects.Apply(source, effect, callback)
    if type(effect) ~= 'table' then
        ATC.Log.Warn('status_effects', 'Apply called with invalid effect table', { source = source })
        if callback then callback(false, nil) end
        return
    end

    local characterId = _getCharacterId(source)
    if not characterId then
        ATC.Log.Warn('status_effects', 'Apply called with no selected character', { source = source })
        if callback then callback(false, nil) end
        return
    end

    ATC.HTTP.Post(_basePath(characterId), effect, function(ok, status, data, err)
        if not ok then
            ATC.Log.Error('status_effects', 'Apply API error', {
                source = source, characterId = characterId, status = status, err = err,
            })
            if callback then callback(false, nil) end
            return
        end
        TriggerEvent(ATC.Events.STATUS.CHANGED, source, { action = 'applied', effect = data })
        if callback then callback(true, data) end
    end)
end

--- Clear a specific status effect from the player's selected character. Server-only.
--- @param source number FiveM player source
--- @param effectType string One of the AtcStatusEffectType values
--- @param callback function(ok)
function ATC.StatusEffects.Clear(source, effectType, callback)
    if type(effectType) ~= 'string' or effectType == '' then
        ATC.Log.Warn('status_effects', 'Clear called with invalid effectType', { source = source })
        if callback then callback(false) end
        return
    end

    local characterId = _getCharacterId(source)
    if not characterId then
        ATC.Log.Warn('status_effects', 'Clear called with no selected character', { source = source })
        if callback then callback(false) end
        return
    end

    ATC.HTTP.Delete(_basePath(characterId) .. '/' .. effectType, function(ok, status, _data, err)
        if not ok then
            ATC.Log.Error('status_effects', 'Clear API error', {
                source = source, characterId = characterId, effectType = effectType,
                status = status, err = err,
            })
            if callback then callback(false) end
            return
        end
        TriggerEvent(ATC.Events.STATUS.CHANGED, source, { action = 'cleared', type = effectType })
        if callback then callback(true) end
    end)
end

--- Sync current status effects to the player's client.
--- Called non-blocking after character select.
--- @param source number FiveM player source
function ATC.StatusEffects.Sync(source)
    ATC.StatusEffects.Get(source, function(ok, data)
        if ok and data then
            TriggerClientEvent(ATC.Events.STATUS.UPDATE, source, data)
        end
    end)
end

-- ── Client-readable event (read-only) ─────────────────────────────────────────

ATC.Firewall.On(ATC.Events.STATUS.REQUEST, {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { max = 10, window = 60 },
}, function(src, _payload)
    local characterId = _getCharacterId(src)
    if not characterId then
        ATC.Log.Warn('status_effects', 'STATUS.REQUEST with no selected character', { source = src })
        return
    end

    ATC.HTTP.Get(_basePath(characterId), function(ok, _status, data, _err)
        if ok and data then
            TriggerClientEvent(ATC.Events.STATUS.UPDATE, src, data)
        end
    end)
end)
