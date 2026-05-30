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

-- ── Smuggling ─────────────────────────────────────────────────────────────────

local _smugRuns = {}  -- source → { itemType, startTime, destination }

ATC.Firewall.On('atc:criminal:smuggle:start', {clientAllowed=true,requireSession=true,rateLimit={window=60000,max=1}}, function(src, payload)
    if _smugRuns[src] then TriggerClientEvent('atc:criminal:smuggle:response', src, {success=false,reason='already_running'}); return end
    local itemType   = type(payload)=='table' and tostring(payload.itemType or 'drugs'):sub(1,32) or 'drugs'
    local destId     = type(payload)=='table' and tostring(payload.destination or 'port'):sub(1,32) or 'port'
    _smugRuns[src]   = { itemType=itemType, destination=destId, startTime=os.time() }
    TriggerClientEvent('atc:criminal:smuggle:response', src, { success=true, itemType=itemType, destination=destId, timeLimit=600 })
    -- Police alert after 2 min
    SetTimeout(120000, function()
        if _smugRuns[src] then
            TriggerEvent('atc:dispatch:call:new', { type='police', priority='medium', message='Suspected smuggling activity', source=src, coords=GetEntityCoords(GetPlayerPed(src)) })
        end
    end)
end)

ATC.Firewall.On('atc:criminal:smuggle:complete', {clientAllowed=true,requireSession=true,rateLimit={window=30000,max=2}}, function(src, payload)
    if not _smugRuns[src] then return end
    local run = _smugRuns[src]
    _smugRuns[src] = nil
    local elapsed = os.time() - run.startTime
    local payout  = math.max(1000, 5000 - elapsed * 5)
    if ATC.EconomyPlugin then ATC.EconomyPlugin.Pay(src, payout, 'smuggle_'..run.itemType) end
    TriggerClientEvent('atc:criminal:smuggle:payout', src, { amount=payout, itemType=run.itemType })
end)

-- ── Black Market ──────────────────────────────────────────────────────────────

local BLACK_MARKET_ITEMS = {
    { id='illegal_weapon', name='Illegal Weapon', price=15000 },
    { id='fake_id',        name='Fake ID',        price=5000  },
    { id='drugs_bulk',     name='Bulk Drugs',     price=8000  },
    { id='stolen_goods',   name='Stolen Goods',   price=3000  },
}

ATC.Firewall.On('atc:criminal:blackmarket:catalog', {clientAllowed=true,requireSession=true,rateLimit={window=5000,max=5}}, function(src)
    TriggerClientEvent('atc:criminal:blackmarket:catalog:response', src, { items=BLACK_MARKET_ITEMS })
end)

-- ── Gang Info Request ─────────────────────────────────────────────────────────

ATC.Firewall.On('atc:gang:info:request', {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { window = 5000, max = 3 }
}, function(src)
    local principalId = ATC.Accounts.GetPrincipalId(src)
    if not principalId then return end
    ATC.HTTP.Get('/api/v1/criminal/gangs/member/' .. principalId, function(ok, _, data)
        TriggerClientEvent('atc:gang:info:response', src, ok and data or nil)
    end)
end)
