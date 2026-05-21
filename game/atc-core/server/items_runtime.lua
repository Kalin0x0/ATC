-- ATC Core — Item Runtime
-- Server-side only. Handles usable item requests from clients.
-- CLIENT SENDS: slot number only.
-- SERVER RESOLVES: characterId, validates, calls API, emits result.
-- Clients have NO authority over item use, cooldowns, or effects.

ATC = ATC or {}
ATC.Items = ATC.Items or {}

-- ── Internal helpers ──────────────────────────────────────────────────────────

local function _getCharacterId(source)
    return ATC.Characters.GetSelectedId(source)
end

local function _buildUsePath(characterId)
    return '/api/v1/inventory/character/' .. characterId .. '/use'
end

local function _makeIdempotencyKey(source, characterId, slot)
    return ('atc:use:%d:%s:%d:%d:%d'):format(
        source, characterId, slot, os.time(), math.random(1, 999999999)
    )
end

-- ── Public server API ─────────────────────────────────────────────────────────

--- Use an item from a player's selected character inventory.
--- SERVER-SIDE ONLY — the client sends only the slot number.
--- @param source number FiveM player source
--- @param slot number Inventory slot (1-120)
--- @param callback function(ok, data|nil) data = AtcItemUseResponse
function ATC.Items.Use(source, slot, callback)
    if type(slot) ~= 'number' or slot < 1 or slot > 120 or math.floor(slot) ~= slot then
        ATC.Log.Warn('items_runtime', 'Use called with invalid slot', { source = source, slot = slot })
        if callback then callback(false, nil) end
        return
    end

    local characterId = _getCharacterId(source)
    if not characterId then
        ATC.Log.Warn('items_runtime', 'Use called with no character selected', { source = source })
        if callback then callback(false, nil) end
        return
    end

    local idempotencyKey = _makeIdempotencyKey(source, characterId, slot)
    local payload = {
        slot           = slot,
        idempotencyKey = idempotencyKey,
    }

    ATC.HTTP.Post(_buildUsePath(characterId), payload, function(ok, status, data, err)
        if not ok then
            -- Map API status codes to meaningful Lua events
            if status == 409 then
                -- Cooldown active
                TriggerClientEvent(ATC.Events.ITEM.COOLDOWN, source, {
                    slot            = slot,
                    cooldownExpiresAt = data and data.cooldownExpiresAt or nil,
                })
                if callback then callback(false, nil) end
                return
            end

            ATC.Log.Error('items_runtime', 'Use API error', {
                source = source, status = status, err = err,
            })
            if callback then callback(false, nil) end
            return
        end

        local itemId = data and data.itemId or 'unknown'

        ATC.Log.Info('items_runtime', 'Item used', {
            source      = source,
            characterId = characterId,
            slot        = slot,
            itemId      = itemId,
        })

        -- Notify the using client
        TriggerClientEvent(ATC.Events.ITEM.USED, source, {
            slot              = slot,
            itemId            = itemId,
            consumed          = data and data.consumed or 0,
            remainingQuantity = data and data.remainingQuantity or 0,
            durability        = data and data.durability or nil,
            cooldownExpiresAt = data and data.cooldownExpiresAt or nil,
        })

        -- Notify plugins when durability reaches zero for the first time this use.
        -- Guard idempotent replays: the BROKEN event already fired on the original use.
        if data and data.durability ~= nil and data.durability == 0 and not data.idempotent then
            TriggerEvent(ATC.Events.ITEM.BROKEN, source, {
                characterId = characterId,
                slot        = slot,
                itemId      = itemId,
            })
        end

        if callback then callback(true, data) end
    end)
end

-- ── Client event handler (Firewall-protected) ─────────────────────────────────
-- Rate-limited to 10 per 30 seconds to prevent spam.
-- Client sends: { slot = number }
-- Server resolves all other context.

ATC.Firewall.On(ATC.Events.ITEM.USE, {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { max = 10, window = 30 },
}, function(src, payload)
    local slot = payload and payload.slot
    if type(slot) ~= 'number' then
        ATC.Log.Warn('items_runtime', 'Item use event received invalid payload', { source = src })
        return
    end

    ATC.Items.Use(src, slot, nil)
end)
