-- ============================================================
-- ATC Marketplace — server/init.lua (Phase 95)
-- Player-to-player listings: browse, list, buy
-- All inputs server-validated; economy settled via ATC API
-- ============================================================

-- ── Browse listings ───────────────────────────────────────────
-- Client requests active listing page; response forwarded to NUI.

ATC.Firewall.On('atc:marketplace:listings:get', {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { window = 5000, max = 5 },
}, function(src)
    ATC.HTTP.Get('/api/v1/market/listings?status=active', function(ok, _, data)
        TriggerClientEvent('atc:marketplace:listings:response', src,
            ok and data or { listings = {} })
    end)
end)

-- ── Create listing ────────────────────────────────────────────
-- Player posts an item for sale. Input is strictly validated
-- before it is forwarded to the API.

ATC.Firewall.On('atc:marketplace:listing:create', {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { window = 30000, max = 5 },
}, function(src, payload)
    local principalId = ATC.Accounts.GetPrincipalId(src)
    if not principalId then return end

    local itemName = type(payload) == 'table'
        and tostring(payload.itemName or ''):sub(1, 64) or ''
    local price    = tonumber(payload and payload.price)
    local qty      = tonumber(payload and payload.quantity)

    if itemName == '' or not price or price <= 0 or not qty or qty <= 0 then
        TriggerClientEvent('atc:marketplace:listing:created', src,
            { success = false, error = 'invalid_input' })
        return
    end

    ATC.HTTP.Post('/api/v1/market/listings', {
        sellerPrincipalId = principalId,
        itemName          = itemName,
        price             = math.min(price, 1000000),
        quantity          = math.min(qty, 99),
    }, function(ok, _, data)
        TriggerClientEvent('atc:marketplace:listing:created', src,
            { success = ok, listing = data })
    end)
end)

-- ── Buy listing ────────────────────────────────────────────────
-- Buyer submits a purchase; API handles fund transfer and item
-- delivery atomically. Success triggers a wallet balance push.

ATC.Firewall.On('atc:marketplace:buy', {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { window = 5000, max = 10 },
}, function(src, payload)
    local listingId   = type(payload) == 'table'
        and tostring(payload.listingId or '') or ''
    local principalId = ATC.Accounts.GetPrincipalId(src)

    if listingId == '' or not principalId then return end

    ATC.HTTP.Post('/api/v1/market/listings/' .. listingId .. '/buy', {
        buyerPrincipalId = principalId,
    }, function(ok, _, data)
        TriggerClientEvent('atc:marketplace:buy:response', src,
            { success = ok, data = data })

        if ok and data and data.wallet then
            TriggerClientEvent(ATC.Events.ECONOMY.BALANCE_UPDATE, src, data.wallet)
        end
    end)
end)
