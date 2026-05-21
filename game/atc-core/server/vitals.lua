-- ATC Core — Vitals Manager
-- Server-side only. Wraps vitals API calls.
-- CLIENTS CANNOT MUTATE VITALS DIRECTLY. All vitals mutations must go through
-- server-side Lua (plugins call ATC.Vitals.Patch/Mutate directly).
-- The only client-initiated event is atc:vitals:request (read-only).

ATC = ATC or {}
ATC.Vitals = ATC.Vitals or {}

-- ── Internal helpers ──────────────────────────────────────────────────────────

local function _getCharacterId(source)
    return ATC.Characters.GetSelectedId(source)
end

local function _buildPath(characterId, suffix)
    local path = '/api/v1/vitals/character/' .. characterId
    if suffix then path = path .. suffix end
    return path
end

-- ── Public server API ─────────────────────────────────────────────────────────

--- Get vitals for the player's selected character.
--- @param source number FiveM player source
--- @param callback function(ok, data|nil) data = AtcCharacterVitals
function ATC.Vitals.Get(source, callback)
    local characterId = _getCharacterId(source)
    if not characterId then
        ATC.Log.Warn('vitals', 'Get called with no character selected', { source = source })
        if callback then callback(false, nil) end
        return
    end

    ATC.HTTP.Get(_buildPath(characterId), function(ok, status, data, err)
        if not ok then
            ATC.Log.Error('vitals', 'Get API error', {
                source = source, status = status, err = err,
            })
            if callback then callback(false, nil) end
            return
        end
        if callback then callback(true, data) end
    end)
end

--- Patch one or multiple vitals for the player's selected character.
--- SERVER-SIDE ONLY — not callable via client events.
--- @param source number FiveM player source
--- @param patch table  Table with one or more vital fields (health, hunger, thirst, stamina, stress, armor)
--- @param callback function(ok, data|nil)
function ATC.Vitals.Patch(source, patch, callback)
    local characterId = _getCharacterId(source)
    if not characterId then
        ATC.Log.Warn('vitals', 'Patch called with no character selected', { source = source })
        if callback then callback(false, nil) end
        return
    end

    if type(patch) ~= 'table' then
        ATC.Log.Warn('vitals', 'Patch called with invalid patch', { source = source })
        if callback then callback(false, nil) end
        return
    end

    local VALID_VITAL_KEYS = { health = true, hunger = true, thirst = true, stamina = true, stress = true, armor = true }
    local hasValidKey = false
    for k, v in pairs(patch) do
        if VALID_VITAL_KEYS[k] and type(v) == 'number' then
            hasValidKey = true
            break
        end
    end
    if not hasValidKey then
        ATC.Log.Warn('vitals', 'Patch called with empty or invalid patch table', { source = source })
        if callback then callback(false, nil) end
        return
    end

    ATC.HTTP.Patch(_buildPath(characterId), patch, function(ok, status, data, err)
        if not ok then
            ATC.Log.Error('vitals', 'Patch API error', {
                source = source, status = status, err = err,
            })
            if callback then callback(false, nil) end
            return
        end

        ATC.Log.Info('vitals', 'Vitals patched', {
            source      = source,
            characterId = characterId,
        })

        -- Notify server-side plugins that vitals changed
        TriggerEvent(ATC.Events.VITALS.CHANGED, source, {
            characterId = characterId,
            vitals      = data,
        })

        if callback then callback(true, data) end
    end)
end

--- Mutate a single vital using set/increment/decrement with server-side clamping.
--- SERVER-SIDE ONLY — not callable via client events.
--- @param source number FiveM player source
--- @param vital string  Vital name: 'health'|'hunger'|'thirst'|'stamina'|'stress'|'armor'
--- @param mode string   'set'|'increment'|'decrement'
--- @param amount number Integer 0–100
--- @param callback function(ok, data|nil)
function ATC.Vitals.Mutate(source, vital, mode, amount, callback)
    local characterId = _getCharacterId(source)
    if not characterId then
        ATC.Log.Warn('vitals', 'Mutate called with no character selected', { source = source })
        if callback then callback(false, nil) end
        return
    end

    if type(amount) ~= 'number' or amount < 0 or amount > 100 or math.floor(amount) ~= amount then
        ATC.Log.Warn('vitals', 'Mutate called with invalid amount', { source = source, amount = amount })
        if callback then callback(false, nil) end
        return
    end

    local validVitals = { health = true, hunger = true, thirst = true, stamina = true, stress = true, armor = true }
    if not validVitals[vital] then
        ATC.Log.Warn('vitals', 'Mutate called with invalid vital', { source = source, vital = vital })
        if callback then callback(false, nil) end
        return
    end

    local validModes = { set = true, increment = true, decrement = true }
    if not validModes[mode] then
        ATC.Log.Warn('vitals', 'Mutate called with invalid mode', { source = source, mode = mode })
        if callback then callback(false, nil) end
        return
    end

    local payload = { vital = vital, mode = mode, amount = amount }

    ATC.HTTP.Post(_buildPath(characterId, '/mutate'), payload, function(ok, status, data, err)
        if not ok then
            ATC.Log.Error('vitals', 'Mutate API error', {
                source = source, status = status, err = err,
            })
            if callback then callback(false, nil) end
            return
        end

        ATC.Log.Info('vitals', 'Vital mutated', {
            source      = source,
            characterId = characterId,
            vital       = vital,
            mode        = mode,
            amount      = amount,
        })

        TriggerEvent(ATC.Events.VITALS.CHANGED, source, {
            characterId = characterId,
            vitals      = data,
        })

        if callback then callback(true, data) end
    end)
end

--- Sync vitals to the client (push current server state).
--- @param source number FiveM player source
function ATC.Vitals.Sync(source)
    ATC.Vitals.Get(source, function(ok, data)
        if not ok or not data then return end
        TriggerClientEvent(ATC.Events.VITALS.UPDATE, source, data)
    end)
end

-- ── Vitals request event (client → server, read-only) ────────────────────────
-- Rate-limited to 10 per 60 seconds. Client sends empty payload.
-- Server responds with atc:vitals:update on the requesting client.

ATC.Firewall.On(ATC.Events.VITALS.REQUEST, {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { max = 10, window = 60 },
}, function(src, _payload)
    local characterId = _getCharacterId(src)
    if not characterId then
        ATC.Log.Warn('vitals', 'Request event received but no character selected', { source = src })
        return
    end

    ATC.Vitals.Get(src, function(ok, data)
        if not ok or not data then
            TriggerClientEvent(ATC.Events.VITALS.UPDATE, src, { ok = false, error = 'vitals_fetch_failed' })
            return
        end
        TriggerClientEvent(ATC.Events.VITALS.UPDATE, src, data)
    end)
end)
