-- ATC Core — Commerce Bridge
-- Server-side only. Wraps the commerce API.
-- CLIENTS CANNOT INITIATE PURCHASES DIRECTLY. All commerce must flow through
-- server-side Lua with full server-validated parameters.
-- idempotency keys are generated server-side to prevent client spoofing.

ATC = ATC or {}
ATC.Commerce = ATC.Commerce or {}

-- ── Internal helpers ──────────────────────────────────────────────────────────

local function _getCharacterId(source)
    return ATC.Characters.GetSelectedId(source)
end

local function _makeIdempotencyKey(op, characterId)
    return ('atc:commerce:%s:%s:%d:%d'):format(op, characterId, os.time(), math.random(1, 999999999))
end

-- ── Public server API ─────────────────────────────────────────────────────────

--- Purchase an item from a shop on behalf of the player's selected character.
--- All parameters except source are server-trusted — never accept these from client events.
--- @param source      number  FiveM player source
--- @param shopId      string  Shop ID
--- @param itemId      string  Item ID
--- @param quantity    number  Positive integer, 1-999
--- @param currency    string  Currency code
--- @param buyerAccountId string Financial account to debit
--- @param callback    function(ok, result|nil, errorCode|nil)
function ATC.Commerce.Purchase(source, shopId, itemId, quantity, currency, buyerAccountId, callback)
    local characterId = _getCharacterId(source)
    if not characterId then
        ATC.Log.Warn('commerce', 'Purchase called with no character selected', { source = source })
        callback(false, nil, 'NO_CHARACTER')
        return
    end

    if type(quantity) ~= 'number' or quantity < 1 or quantity > 999 or math.floor(quantity) ~= quantity then
        ATC.Log.Warn('commerce', 'Purchase called with invalid quantity', {
            source = source, characterId = characterId, quantity = quantity,
        })
        callback(false, nil, 'INVALID_QUANTITY')
        return
    end

    local idempotencyKey = _makeIdempotencyKey('purchase', characterId)

    ATC.HTTP.Post('/api/v1/commerce/purchase', {
        idempotencyKey  = idempotencyKey,
        characterId     = characterId,
        shopId          = shopId,
        itemId          = itemId,
        quantity        = quantity,
        currency        = currency,
        buyerAccountId  = buyerAccountId,
    }, function(ok, status, data, err)
        if not ok then
            ATC.Log.Error('commerce', 'Purchase API error', {
                source = source, characterId = characterId,
                shopId = shopId, itemId = itemId, status = status, err = err,
            })
            callback(false, nil, 'API_ERROR')
            return
        end
        if status == 201 then
            callback(true, data, nil)
        else
            local errorCode = data and data.error or 'UNKNOWN'
            ATC.Log.Warn('commerce', 'Purchase rejected', {
                source = source, characterId = characterId,
                shopId = shopId, status = status, error = errorCode,
            })
            callback(false, nil, errorCode)
        end
    end)
end

--- Sell an item to a shop on behalf of the player's selected character.
--- @param source         number  FiveM player source
--- @param shopId         string  Shop ID
--- @param itemId         string  Item ID
--- @param quantity       number  Positive integer, 1-999
--- @param currency       string  Currency code
--- @param sellerAccountId string Financial account to credit
--- @param callback       function(ok, result|nil, errorCode|nil)
function ATC.Commerce.Sell(source, shopId, itemId, quantity, currency, sellerAccountId, callback)
    local characterId = _getCharacterId(source)
    if not characterId then
        ATC.Log.Warn('commerce', 'Sell called with no character selected', { source = source })
        callback(false, nil, 'NO_CHARACTER')
        return
    end

    if type(quantity) ~= 'number' or quantity < 1 or quantity > 999 or math.floor(quantity) ~= quantity then
        ATC.Log.Warn('commerce', 'Sell called with invalid quantity', {
            source = source, characterId = characterId, quantity = quantity,
        })
        callback(false, nil, 'INVALID_QUANTITY')
        return
    end

    local idempotencyKey = _makeIdempotencyKey('sell', characterId)

    ATC.HTTP.Post('/api/v1/commerce/sell', {
        idempotencyKey   = idempotencyKey,
        characterId      = characterId,
        shopId           = shopId,
        itemId           = itemId,
        quantity         = quantity,
        currency         = currency,
        sellerAccountId  = sellerAccountId,
    }, function(ok, status, data, err)
        if not ok then
            ATC.Log.Error('commerce', 'Sell API error', {
                source = source, characterId = characterId,
                shopId = shopId, itemId = itemId, status = status, err = err,
            })
            callback(false, nil, 'API_ERROR')
            return
        end
        if status == 201 then
            callback(true, data, nil)
        else
            local errorCode = data and data.error or 'UNKNOWN'
            ATC.Log.Warn('commerce', 'Sell rejected', {
                source = source, characterId = characterId,
                shopId = shopId, status = status, error = errorCode,
            })
            callback(false, nil, errorCode)
        end
    end)
end

--- Fetch available items in a shop.
--- @param shopId   string  Shop ID
--- @param callback function(ok, items|nil)
function ATC.Commerce.GetShopItems(shopId, callback)
    ATC.HTTP.Get('/api/v1/commerce/shops/' .. shopId .. '/items', function(ok, status, data, err)
        if not ok or status ~= 200 then
            ATC.Log.Error('commerce', 'GetShopItems API error', {
                shopId = shopId, status = status, err = err,
            })
            callback(false, nil)
            return
        end
        callback(true, data and data.items or {})
    end)
end

--- Get a price preview without committing a purchase.
--- @param shopId   string  Shop ID
--- @param itemId   string  Item ID
--- @param quantity number  Quantity
--- @param callback function(ok, totals|nil)
function ATC.Commerce.PreviewPurchase(shopId, itemId, quantity, callback)
    local path = ('/api/v1/commerce/preview/purchase?shopId=%s&itemId=%s&quantity=%d'):format(
        shopId, itemId, quantity
    )
    ATC.HTTP.Get(path, function(ok, status, data, err)
        if not ok or status ~= 200 then
            ATC.Log.Error('commerce', 'PreviewPurchase API error', {
                shopId = shopId, itemId = itemId, status = status, err = err,
            })
            callback(false, nil)
            return
        end
        callback(true, data)
    end)
end

-- ── Server event handlers (plugins call Lua, not client events) ───────────────
-- NOTE: Never expose these as client-triggered events. Plugins must call
-- ATC.Commerce.Purchase / ATC.Commerce.Sell from server-side Lua directly.
