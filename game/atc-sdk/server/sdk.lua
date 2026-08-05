-- game/atc-sdk/server/sdk.lua
-- ATC SDK — server-side helpers for external plugins.
-- External plugins MUST use these helpers instead of calling ATC internals
-- directly; this ensures forward-compatibility as the internal API evolves.

ATC_SDK.Server = {}

-- The wallet and inventory endpoints require an idempotencyKey so a retried
-- request cannot double-credit or double-grant. One per call.
local _seq = 0
local function _idempotencyKey(prefix)
    _seq = _seq + 1
    if _seq > 0xFFFFFF then _seq = 1 end
    return ('%s-%x-%x-%04x'):format(prefix or 'sdk', os.time(), _seq, math.random(0, 0xFFFF))
end

-- ─── Player / Session ─────────────────────────────────────────────────────────

--- Return the raw ATC session object for a connected player.
--- @param source number  FiveM player server ID
--- @return table|nil     Session table or nil if not found
function ATC_SDK.Server.GetPlayer(source)
    return ATC.Sessions.Get(source)
end

--- Return the character UUID for a connected player's active character.
--- @param source number
--- @return string|nil
function ATC_SDK.Server.GetCharacterId(source)
    return ATC.Sessions.GetCharacterId(source)
end

--- Return the account principal UUID tied to a connected player.
--- @param source number
--- @return string|nil
function ATC_SDK.Server.GetPrincipalId(source)
    return ATC.Accounts.GetPrincipalId(source)
end

-- ─── Economy ──────────────────────────────────────────────────────────────────

--- Credit the player's wallet via the ATC economy API.
--- Fires ECONOMY.BALANCE_UPDATE on the client on success.
--- @param source  number
--- @param amount  number
--- @param reason  string   Audit label (e.g. 'shop_purchase')
--- @param cb      function|nil  cb(success: boolean, data: table|nil)
function ATC_SDK.Server.AddMoney(source, amount, reason, cb)
    -- Wallets are keyed by characterId, not principalId.
    local characterId = ATC.Sessions.GetCharacterId(source)
    if not characterId then
        ATC.Log.Warn('atc-sdk', 'AddMoney — no characterId for source', { source = source })
        if cb then cb(false, nil) end
        return
    end

    -- walletCreditSchema takes a positive integer in minor units.
    local amt = math.floor(tonumber(amount) or 0)
    if amt <= 0 then
        ATC.Log.Warn('atc-sdk', 'AddMoney — amount must be a positive integer', { source = source, amount = amount })
        if cb then cb(false, nil) end
        return
    end

    ATC.HTTP.Post('/api/v1/wallets/character/' .. characterId .. '/credit', {
        account        = 'cash',
        amount         = amt,
        currency       = 'ATC',
        reason         = reason or 'plugin',
        source         = 'gameplay',
        idempotencyKey = _idempotencyKey('credit'),
    }, function(ok, _status, data)
        if ok then
            TriggerClientEvent(ATC.Events.ECONOMY.BALANCE_UPDATE, source, data)
        end
        if cb then cb(ok, data) end
    end)
end

--- Debit the player's wallet via the ATC economy API.
--- Fires ECONOMY.BALANCE_UPDATE on the client on success.
--- @param source  number
--- @param amount  number
--- @param reason  string
--- @param cb      function|nil  cb(success: boolean, data: table|nil)
function ATC_SDK.Server.RemoveMoney(source, amount, reason, cb)
    local characterId = ATC.Sessions.GetCharacterId(source)
    if not characterId then
        ATC.Log.Warn('atc-sdk', 'RemoveMoney — no characterId for source', { source = source })
        if cb then cb(false, nil) end
        return
    end

    local amt = math.floor(tonumber(amount) or 0)
    if amt <= 0 then
        ATC.Log.Warn('atc-sdk', 'RemoveMoney — amount must be a positive integer', { source = source, amount = amount })
        if cb then cb(false, nil) end
        return
    end

    ATC.HTTP.Post('/api/v1/wallets/character/' .. characterId .. '/debit', {
        account        = 'cash',
        amount         = amt,
        currency       = 'ATC',
        reason         = reason or 'plugin',
        source         = 'gameplay',
        idempotencyKey = _idempotencyKey('debit'),
    }, function(ok, _status, data)
        if ok then
            TriggerClientEvent(ATC.Events.ECONOMY.BALANCE_UPDATE, source, data)
        end
        if cb then cb(ok, data) end
    end)
end

-- ─── Inventory ────────────────────────────────────────────────────────────────

--- Add an item to the player's active character inventory.
--- @param source    number
--- @param itemName  string
--- @param quantity  number
--- @param metadata  table|nil  Free-form item metadata
--- @param cb        function|nil  cb(success: boolean, data: table|nil)
function ATC_SDK.Server.AddItem(source, itemName, quantity, metadata, cb)
    local characterId = ATC.Sessions.GetCharacterId(source)
    if not characterId then
        ATC.Log.Warn('atc-sdk', 'AddItem — no characterId for source', { source = source })
        if cb then cb(false, nil) end
        return
    end

    -- characterId goes in the path; the body uses itemId, and reason/source/
    -- idempotencyKey are required by inventoryAddSchema.
    ATC.HTTP.Post('/api/v1/inventory/character/' .. characterId .. '/add', {
        itemId         = itemName,
        quantity       = math.max(1, math.floor(tonumber(quantity) or 1)),
        reason         = 'plugin',
        source         = 'gameplay',
        idempotencyKey = _idempotencyKey('add'),
        metadata       = metadata,
    }, function(ok, _status, data)
        if cb then cb(ok, data) end
    end)
end

--- Remove an item from the player's active character inventory.
--- @param source    number
--- @param itemName  string
--- @param quantity  number
--- @param cb        function|nil  cb(success: boolean, data: table|nil)
function ATC_SDK.Server.RemoveItem(source, itemName, quantity, cb)
    local characterId = ATC.Sessions.GetCharacterId(source)
    if not characterId then
        ATC.Log.Warn('atc-sdk', 'RemoveItem — no characterId for source', { source = source })
        if cb then cb(false, nil) end
        return
    end

    ATC.HTTP.Post('/api/v1/inventory/character/' .. characterId .. '/remove', {
        itemId         = itemName,
        quantity       = math.max(1, math.floor(tonumber(quantity) or 1)),
        reason         = 'plugin',
        source         = 'gameplay',
        idempotencyKey = _idempotencyKey('remove'),
    }, function(ok, _status, data)
        if cb then cb(ok, data) end
    end)
end

-- ─── UI / Notifications ───────────────────────────────────────────────────────

--- Send an ATC NUI toast notification to a specific player.
--- @param source   number
--- @param message  string
--- @param level    string  'info' | 'success' | 'warning' | 'error'
--- @param duration number  Milliseconds (default 5000)
function ATC_SDK.Server.Notify(source, message, level, duration)
    TriggerClientEvent('atc:notify:show', source, {
        message  = message  or '',
        level    = level    or 'info',
        duration = duration or 5000,
    })
end
