-- ATC Core — Inventory Manager
-- Server-side only. Wraps inventory API calls.
-- CLIENTS CANNOT ADD, REMOVE, OR MOVE ITEMS DIRECTLY.
-- All mutations go through server-side Lua; plugins call ATC.Inventory.Add/Remove/Move.
-- The only client-initiated event is atc:inventory:request (read-only).

ATC = ATC or {}
ATC.Inventory = ATC.Inventory or {}

-- ── Internal helpers ──────────────────────────────────────────────────────────

local function _getCharacterId(source)
    return ATC.Characters.GetSelectedId(source)
end

local function _makeIdempotencyKey(op, source, characterId)
    return ('atc:%s:%d:%s:%d:%d'):format(op, source, characterId, os.time(), math.random(1, 999999999))
end

local function _buildPath(characterId, action)
    if action then
        return '/api/v1/inventory/character/' .. characterId .. '/' .. action
    end
    return '/api/v1/inventory/character/' .. characterId
end

-- ── Public server API ─────────────────────────────────────────────────────────

--- Get the full inventory for a player's selected character.
--- @param source number FiveM player source
--- @param callback function(ok, data|nil) data = { characterId, slots, weight }
function ATC.Inventory.Get(source, callback)
    local characterId = _getCharacterId(source)
    if not characterId then
        ATC.Log.Warn('inventory', 'Get called with no character selected', { source = source })
        callback(false, nil)
        return
    end

    ATC.HTTP.Get(_buildPath(characterId, nil), function(ok, status, data, err)
        if not ok then
            ATC.Log.Error('inventory', 'Get API error', {
                source = source, status = status, err = err,
            })
            callback(false, nil)
            return
        end
        callback(true, data)
    end)
end

--- Check if a player's selected character has at least `quantity` of an item.
--- @param source number FiveM player source
--- @param itemId string Item definition ID (e.g. 'water_bottle')
--- @param quantity number Minimum quantity required (default 1)
--- @param callback function(ok, hasItem boolean)
function ATC.Inventory.HasItem(source, itemId, quantity, callback)
    if type(quantity) ~= 'number' or quantity < 1 then
        quantity = 1
    end
    ATC.Inventory.Get(source, function(ok, data)
        if not ok or not data then
            callback(false, false)
            return
        end
        local total = 0
        if type(data.slots) == 'table' then
            for _, slot in ipairs(data.slots) do
                if slot.itemId == itemId then
                    total = total + (slot.quantity or 0)
                end
            end
        end
        callback(true, total >= quantity)
    end)
end

--- Add an item to the player's selected character inventory.
--- SERVER-SIDE ONLY — not callable via client events.
--- @param source number FiveM player source
--- @param itemId string Item definition ID
--- @param quantity number Positive integer
--- @param reason string Audit reason
--- @param callback function(ok, data|nil) data = AtcInventoryMutationResponse
function ATC.Inventory.Add(source, itemId, quantity, reason, callback)
    local characterId = _getCharacterId(source)
    if not characterId then
        ATC.Log.Warn('inventory', 'Add called with no character selected', { source = source })
        callback(false, nil)
        return
    end

    if type(quantity) ~= 'number' or quantity < 1 or math.floor(quantity) ~= quantity then
        ATC.Log.Warn('inventory', 'Add called with invalid quantity', { source = source, quantity = quantity })
        callback(false, nil)
        return
    end

    if type(itemId) ~= 'string' or #itemId < 2 or #itemId > 64 then
        ATC.Log.Warn('inventory', 'Add called with invalid itemId', { source = source, itemId = itemId })
        callback(false, nil)
        return
    end

    local idempotencyKey = _makeIdempotencyKey('add', source, characterId)
    local payload = {
        itemId         = itemId,
        quantity       = quantity,
        reason         = reason or 'system',
        source         = 'gameplay',
        idempotencyKey = idempotencyKey,
    }

    ATC.HTTP.Post(_buildPath(characterId, 'add'), payload, function(ok, status, data, err)
        if not ok then
            ATC.Log.Error('inventory', 'Add API error', {
                source = source, status = status, err = err,
            })
            callback(false, nil)
            return
        end

        ATC.Log.Info('inventory', 'Item added', {
            source      = source,
            characterId = characterId,
            itemId      = itemId,
            quantity    = quantity,
        })

        TriggerEvent(ATC.Events.INVENTORY.ITEM_CHANGED, source, {
            characterId = characterId,
            type        = 'add',
            itemId      = itemId,
            quantity    = quantity,
            slot        = data and data.slot,
        })

        callback(true, data)
    end)
end

--- Remove an item from the player's selected character inventory.
--- SERVER-SIDE ONLY — not callable via client events.
--- @param source number FiveM player source
--- @param itemId string Item definition ID
--- @param quantity number Positive integer
--- @param reason string Audit reason
--- @param callback function(ok, data|nil) data = AtcInventoryMutationResponse
function ATC.Inventory.Remove(source, itemId, quantity, reason, callback)
    local characterId = _getCharacterId(source)
    if not characterId then
        ATC.Log.Warn('inventory', 'Remove called with no character selected', { source = source })
        callback(false, nil)
        return
    end

    if type(quantity) ~= 'number' or quantity < 1 or math.floor(quantity) ~= quantity then
        ATC.Log.Warn('inventory', 'Remove called with invalid quantity', { source = source, quantity = quantity })
        callback(false, nil)
        return
    end

    if type(itemId) ~= 'string' or #itemId < 2 or #itemId > 64 then
        ATC.Log.Warn('inventory', 'Remove called with invalid itemId', { source = source, itemId = itemId })
        callback(false, nil)
        return
    end

    local idempotencyKey = _makeIdempotencyKey('remove', source, characterId)
    local payload = {
        itemId         = itemId,
        quantity       = quantity,
        reason         = reason or 'system',
        source         = 'gameplay',
        idempotencyKey = idempotencyKey,
    }

    ATC.HTTP.Post(_buildPath(characterId, 'remove'), payload, function(ok, status, data, err)
        if not ok then
            ATC.Log.Error('inventory', 'Remove API error', {
                source = source, status = status, err = err,
                insufficientQuantity = (status == 422),
            })
            callback(false, nil)
            return
        end

        ATC.Log.Info('inventory', 'Item removed', {
            source      = source,
            characterId = characterId,
            itemId      = itemId,
            quantity    = quantity,
        })

        TriggerEvent(ATC.Events.INVENTORY.ITEM_CHANGED, source, {
            characterId = characterId,
            type        = 'remove',
            itemId      = itemId,
            quantity    = quantity,
            slot        = data and data.slot,
        })

        callback(true, data)
    end)
end

--- Move an item between slots in the player's selected character inventory.
--- SERVER-SIDE ONLY.
--- @param source number FiveM player source
--- @param fromSlot number Source slot number (1-120)
--- @param toSlot number Destination slot number (1-120)
--- @param callback function(ok, data|nil) data = AtcInventoryMutationResponse
function ATC.Inventory.Move(source, fromSlot, toSlot, callback)
    local characterId = _getCharacterId(source)
    if not characterId then
        ATC.Log.Warn('inventory', 'Move called with no character selected', { source = source })
        callback(false, nil)
        return
    end

    if type(fromSlot) ~= 'number' or type(toSlot) ~= 'number' then
        ATC.Log.Warn('inventory', 'Move called with non-numeric slots', { source = source })
        callback(false, nil)
        return
    end

    if fromSlot == toSlot then
        ATC.Log.Warn('inventory', 'Move called with identical slots', { source = source, slot = fromSlot })
        callback(false, nil)
        return
    end

    if fromSlot < 1 or fromSlot > 120 or toSlot < 1 or toSlot > 120 then
        ATC.Log.Warn('inventory', 'Move called with out-of-range slot (absolute max 120)', { source = source, fromSlot = fromSlot, toSlot = toSlot })
        callback(false, nil)
        return
    end

    local idempotencyKey = _makeIdempotencyKey('move', source, characterId)
    local payload = {
        fromSlot       = fromSlot,
        toSlot         = toSlot,
        idempotencyKey = idempotencyKey,
    }

    ATC.HTTP.Post(_buildPath(characterId, 'move'), payload, function(ok, status, data, err)
        if not ok then
            ATC.Log.Error('inventory', 'Move API error', {
                source = source, status = status, err = err,
            })
            callback(false, nil)
            return
        end

        ATC.Log.Info('inventory', 'Item moved', {
            source      = source,
            characterId = characterId,
            fromSlot    = fromSlot,
            toSlot      = toSlot,
        })

        callback(true, data)
    end)
end

--- Get the weight summary for a player's selected character.
--- @param source number FiveM player source
--- @param callback function(ok, weightSummary|nil)
function ATC.Inventory.GetWeight(source, callback)
    ATC.Inventory.Get(source, function(ok, data)
        if not ok or not data then
            callback(false, nil)
            return
        end
        callback(true, data.weightSummary)
    end)
end

--- Get the capacity summary for a player's selected character.
--- @param source number FiveM player source
--- @param callback function(ok, capacitySummary|nil)
function ATC.Inventory.GetCapacity(source, callback)
    ATC.Inventory.Get(source, function(ok, data)
        if not ok or not data then
            callback(false, nil)
            return
        end
        callback(true, data.capacitySummary)
    end)
end

--- Check if a character has space to add `quantity` of an item with `weightGrams` each.
--- @param source number FiveM player source
--- @param weightGrams number Weight of each item unit in grams
--- @param quantity number Number of units to add (default 1)
--- @param callback function(ok, hasSpace boolean)
function ATC.Inventory.HasSpaceFor(source, weightGrams, quantity, callback)
    if type(quantity) ~= 'number' or quantity < 1 then quantity = 1 end
    if type(weightGrams) ~= 'number' or weightGrams < 0 then weightGrams = 0 end
    ATC.Inventory.Get(source, function(ok, data)
        if not ok or not data then
            callback(false, false)
            return
        end
        -- BUG-6-4: guard missing summary fields (API shape mismatch or nil response)
        if not data.weightSummary or not data.capacitySummary then
            ATC.Log.Warn('inventory', 'HasSpaceFor: missing summary fields in response', { source = source })
            callback(false, false)
            return
        end
        local ws = data.weightSummary
        local cs = data.capacitySummary
        local addedWeight = weightGrams * quantity
        local weightOk = (ws.remainingWeightGrams >= addedWeight)
        local slotOk = (cs.freeSlots > 0)
        callback(true, weightOk and slotOk)
    end)
end

--- Get per-character inventory settings (maxSlots, maxWeightGrams).
--- @param source number FiveM player source
--- @param callback function(ok, settings|nil)
function ATC.Inventory.GetSettings(source, callback)
    ATC.Inventory.Get(source, function(ok, data)
        if not ok or not data then
            callback(false, nil)
            return
        end
        callback(true, data.settings)
    end)
end

-- ── Item definition cache (Phase 7) ──────────────────────────────────────────
-- Server-side only. Clients CANNOT request item admin operations.
-- Cache is populated from GET /api/v1/items (active items only).

local _itemCache      = nil   -- map of itemId (string) → item definition (table)
local _cacheLoaded    = false
local _cacheLoadedAt  = 0
local ATC_ITEM_CACHE_TTL = 60 -- seconds
if ATC and ATC.Config and type(ATC.Config.ItemCacheTTL) == 'number' and ATC.Config.ItemCacheTTL > 0 then
    ATC_ITEM_CACHE_TTL = ATC.Config.ItemCacheTTL
end

local function _isCacheValid()
    return _cacheLoaded and (os.time() - _cacheLoadedAt) < ATC_ITEM_CACHE_TTL
end

local function _loadItemCache(callback)
    ATC.HTTP.Get('/api/v1/items', function(ok, status, data, err)
        if not ok or type(data) ~= 'table' then
            ATC.Log.Warn('inventory', 'Item cache load failed', { status = status, err = err })
            if callback then callback(false, nil) end
            return
        end
        _itemCache = {}
        for _, item in ipairs(data) do
            if type(item) == 'table' and type(item.id) == 'string' then
                _itemCache[item.id] = item
            end
        end
        _cacheLoaded   = true
        _cacheLoadedAt = os.time()
        ATC.Log.Info('inventory', 'Item cache loaded', { count = #data })
        if callback then callback(true, _itemCache) end
    end)
end

--- Get a single item definition by ID (served from cache; fetches if stale).
--- @param itemId string Item definition ID
--- @param callback function(ok boolean, item table|nil)
function ATC.Inventory.GetItemDefinition(itemId, callback)
    if type(itemId) ~= 'string' or #itemId < 2 then
        callback(false, nil)
        return
    end
    if _isCacheValid() then
        local item = _itemCache[itemId]
        callback(item ~= nil, item or nil)
        return
    end
    _loadItemCache(function(ok)
        if not ok then callback(false, nil); return end
        local item = _itemCache[itemId]
        callback(item ~= nil, item or nil)
    end)
end

--- List all cached active item definitions (array).
--- @param callback function(ok boolean, items table[]|nil)
function ATC.Inventory.ListItemDefinitions(callback)
    local function _buildList(cache)
        local items = {}
        for _, item in pairs(cache) do
            table.insert(items, item)
        end
        return items
    end
    if _isCacheValid() then
        callback(true, _buildList(_itemCache))
        return
    end
    _loadItemCache(function(ok, cache)
        if not ok then callback(false, nil); return end
        callback(true, _buildList(cache))
    end)
end

--- Force-refresh the item cache from the API.
--- @param callback function(ok boolean, items table[]|nil) optional
function ATC.Inventory.RefreshItemCache(callback)
    _cacheLoaded = false
    _loadItemCache(function(ok, cache)
        if not callback then return end
        if not ok then callback(false, nil); return end
        local items = {}
        for _, item in pairs(cache) do
            table.insert(items, item)
        end
        callback(true, items)
    end)
end

-- ── Inventory request event (client → server, read-only) ─────────────────────
-- Rate-limited to 5 per 30 seconds. Client sends {} or nil.
-- Server responds with atc:inventory:update on the requesting client.

ATC.Firewall.On(ATC.Events.INVENTORY.REQUEST, {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { max = 5, window = 30 },
}, function(src, _payload)
    ATC.Inventory.Get(src, function(ok, data)
        if not ok or not data then
            TriggerClientEvent(ATC.Events.INVENTORY.UPDATE, src, {
                ok    = false,
                error = 'inventory_fetch_failed',
            })
            return
        end
        TriggerClientEvent(ATC.Events.INVENTORY.UPDATE, src, {
            ok              = true,
            characterId     = data.characterId,
            slots           = data.slots,
            settings        = data.settings,
            weightSummary   = data.weightSummary,
            capacitySummary = data.capacitySummary,
        })
    end)
end)
