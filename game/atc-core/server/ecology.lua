-- Phase 63: Deep Simulation Ecology, Resource Evolution & Environmental Persistence Bridge
-- Server-side only. All ecology operations are server-authoritative.

local function checkRateLimit(source)
    if not source or source == 0 then return true end
    if not _G._ecoRateLimits then _G._ecoRateLimits = {} end
    local now = GetGameTimer()
    local key = tostring(source)
    if not _G._ecoRateLimits[key] then
        _G._ecoRateLimits[key] = { count = 0, window = now }
    end
    local entry = _G._ecoRateLimits[key]
    if (now - entry.window) > 60000 then
        entry.count = 0
        entry.window = now
    end
    entry.count = entry.count + 1
    return entry.count <= 30
end

-- atc:ecology:create (Server-only)
AddEventHandler('atc:ecology:create', function(ecologyType, regionId, ecologyNonce, ecologyData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        ecologyType   = ecologyType,
        ownerServerId = GetConvar('atc_server_id', 'default'),
        regionId      = regionId,
        ecologyNonce  = ecologyNonce,
        ecologyData   = ecologyData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/ecology/create',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('ecology', 'ecology create failed: ' .. tostring(status))
            else
                TriggerEvent('atc:ecology:created', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:ecology:degrade (Server-only)
AddEventHandler('atc:ecology:degrade', function(id)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/ecology/' .. id .. '/degrade',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('ecology', 'ecology degrade failed: ' .. tostring(status))
            else
                TriggerEvent('atc:ecology:degraded', json.decode(body))
            end
        end,
        'POST',
        json.encode({}),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:ecology:evolution:start (Server-only)
AddEventHandler('atc:ecology:evolution:start', function(evolutionType, regionId, evolutionNonce, evolutionData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        evolutionType  = evolutionType,
        ownerServerId  = GetConvar('atc_server_id', 'default'),
        regionId       = regionId,
        evolutionNonce = evolutionNonce,
        evolutionData  = evolutionData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/ecology/evolution/start',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('ecology', 'evolution start failed: ' .. tostring(status))
            else
                TriggerEvent('atc:ecology:evolution:started', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:ecology:evolution:complete (Server-only)
AddEventHandler('atc:ecology:evolution:complete', function(id)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/ecology/evolution/' .. id .. '/complete',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('ecology', 'evolution complete failed: ' .. tostring(status))
            else
                TriggerEvent('atc:ecology:evolution:completed', json.decode(body))
            end
        end,
        'POST',
        json.encode({}),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:ecology:regeneration:start (Server-only)
AddEventHandler('atc:ecology:regeneration:start', function(resourceType, regionId, regenerationNonce, regenerationData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        resourceType      = resourceType,
        ownerServerId     = GetConvar('atc_server_id', 'default'),
        regionId          = regionId,
        regenerationNonce = regenerationNonce,
        regenerationData  = regenerationData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/ecology/regeneration/start',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('ecology', 'regeneration start failed: ' .. tostring(status))
            else
                TriggerEvent('atc:ecology:regeneration:started', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:ecology:regeneration:complete (Server-only)
AddEventHandler('atc:ecology:regeneration:complete', function(id)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/ecology/regeneration/' .. id .. '/complete',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('ecology', 'regeneration complete failed: ' .. tostring(status))
            else
                TriggerEvent('atc:ecology:regeneration:completed', json.decode(body))
            end
        end,
        'POST',
        json.encode({}),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:ecology:climate:upsert (Server-only)
AddEventHandler('atc:ecology:climate:upsert', function(regionId, climateType, temperature, humidity, climateData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        regionId      = regionId,
        climateType   = climateType,
        ownerServerId = GetConvar('atc_server_id', 'default'),
        temperature   = temperature,
        humidity      = humidity,
        climateData   = climateData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/ecology/climate',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('ecology', 'climate upsert failed: ' .. tostring(status))
            else
                TriggerEvent('atc:ecology:climate:updated', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:ecology:wildlife:upsert (Server-only)
AddEventHandler('atc:ecology:wildlife:upsert', function(zoneId, wildlifeType, population, wildlifeData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        zoneId        = zoneId,
        wildlifeType  = wildlifeType,
        ownerServerId = GetConvar('atc_server_id', 'default'),
        population    = population,
        wildlifeData  = wildlifeData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/ecology/wildlife',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('ecology', 'wildlife upsert failed: ' .. tostring(status))
            else
                TriggerEvent('atc:ecology:wildlife:updated', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:ecology:cleanup (Server-only, scheduled)
AddEventHandler('atc:ecology:cleanup', function(thresholdMs)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/ecology/cleanup',
        function(status, _body)
            if status ~= 200 then
                ATC.Log.Warn('ecology', 'cleanup failed: ' .. tostring(status))
            end
        end,
        'POST',
        json.encode({ thresholdMs = thresholdMs or 300000 }),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- Scheduled cleanup every 5 minutes
CreateThread(function()
    while true do
        Wait(300000)
        TriggerEvent('atc:ecology:cleanup', 300000)
    end
end)
