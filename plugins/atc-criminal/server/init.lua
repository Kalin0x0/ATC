-- ============================================================
-- ATC Criminal — Server Init
-- Plugin: atc-criminal v0.1.0
-- ============================================================

ATC         = ATC or {}
ATC.Criminal = {}

-- Active robberies indexed by locationId
local _robberies = {}

-- ── Store Robbery ─────────────────────────────────────────────────────────────

ATC.Firewall.On('atc:criminal:robbery:start', {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { window = 60000, max = 2 }
}, function(src, payload)
    local locationId = type(payload) == 'table' and tostring(payload.locationId or ''):sub(1, 64) or ''
    if locationId == '' then return end

    if _robberies[locationId] then
        TriggerClientEvent('atc:criminal:robbery:response', src, {
            success = false,
            reason  = 'already_active'
        })
        return
    end

    local principalId = ATC.Accounts.GetPrincipalId(src)
    if not principalId then return end

    _robberies[locationId] = {
        principalId = principalId,
        startTime   = os.time(),
        src         = src
    }

    -- Alert police via dispatch
    TriggerEvent('atc:dispatch:call:new', {
        type    = 'police',
        priority = 'high',
        message  = 'Robbery in progress at ' .. locationId,
        source   = src,
        coords   = GetEntityCoords(GetPlayerPed(src))
    })

    TriggerClientEvent('atc:criminal:robbery:response', src, {
        success    = true,
        locationId = locationId
    })

    -- Auto-expire after 5 minutes
    SetTimeout(300000, function()
        _robberies[locationId] = nil
    end)
end)

ATC.Firewall.On('atc:criminal:robbery:complete', {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { window = 60000, max = 2 }
}, function(src, payload)
    local locationId = type(payload) == 'table' and tostring(payload.locationId or '') or ''
    local rob = _robberies[locationId]
    if not rob or rob.src ~= src then return end

    _robberies[locationId] = nil

    local payout = math.random(2000, 8000)

    if ATC.EconomyPlugin then
        ATC.EconomyPlugin.Pay(src, payout, 'robbery_' .. locationId)
    end

    TriggerClientEvent('atc:criminal:robbery:payout', src, {
        amount     = payout,
        locationId = locationId
    })
end)

-- ── Drug Crafting ─────────────────────────────────────────────────────────────

ATC.Firewall.On('atc:criminal:drug:craft', {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { window = 30000, max = 3 }
}, function(src, payload)
    local drugType = type(payload) == 'table' and tostring(payload.drugType or ''):sub(1, 32) or ''
    if drugType == '' then return end

    local characterId = ATC.Sessions.GetCharacterId(src)
    if not characterId then return end

    ATC.HTTP.Post('/api/v1/crafting/craft', {
        characterId = characterId,
        recipeId    = 'drug_' .. drugType
    }, function(ok, _, data)
        TriggerClientEvent('atc:criminal:drug:crafted', src, {
            success  = ok,
            drugType = drugType,
            data     = data
        })
    end)
end)
