-- Phase 61: Autonomous Economy Regulation, Resource Balancing & Systemic Stabilization Bridge
-- Server-side only. All economy regulation is server-authoritative.

-- atc:economy:regulation:create (Server-only)
-- Creates an economy regulation rule
AddEventHandler('atc:economy:regulation:create', function(regulationType, regionId, regulationNonce, regulationData, expiresAt)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        regulationType  = regulationType,
        ownerServerId   = GetConvar('atc_server_id', 'default'),
        regulationNonce = regulationNonce,
        regionId        = regionId,
        regulationData  = regulationData or {},
        expiresAt       = expiresAt,
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/economy-regulation/regulations/create',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('economy_regulation', 'regulation create failed: ' .. tostring(status))
            else
                TriggerEvent('atc:economy:regulation:created', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:economy:regulation:suspend (Server-only)
-- Suspends an active regulation
AddEventHandler('atc:economy:regulation:suspend', function(regulationId)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/economy-regulation/regulations/' .. regulationId .. '/suspend',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('economy_regulation', 'regulation suspend failed: ' .. tostring(status))
            else
                TriggerEvent('atc:economy:regulation:suspended', json.decode(body))
            end
        end,
        'POST',
        '{}',
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:economy:balancing:start (Server-only)
-- Starts a resource balancing operation
AddEventHandler('atc:economy:balancing:start', function(balancingType, targetRegionId, balancingNonce, balancingData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        balancingType   = balancingType,
        ownerServerId   = GetConvar('atc_server_id', 'default'),
        balancingNonce  = balancingNonce,
        targetRegionId  = targetRegionId,
        balancingData   = balancingData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/economy-regulation/balancing/start',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('economy_regulation', 'balancing start failed: ' .. tostring(status))
            else
                TriggerEvent('atc:economy:balancing:started', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:economy:balancing:complete (Server-only)
AddEventHandler('atc:economy:balancing:complete', function(balancingId)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/economy-regulation/balancing/' .. balancingId .. '/complete',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('economy_regulation', 'balancing complete failed: ' .. tostring(status))
            end
        end,
        'POST',
        '{}',
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:economy:balancing:fail (Server-only)
AddEventHandler('atc:economy:balancing:fail', function(balancingId)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/economy-regulation/balancing/' .. balancingId .. '/fail',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('economy_regulation', 'balancing fail failed: ' .. tostring(status))
            end
        end,
        'POST',
        '{}',
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:economy:inflation:upsert (Server-only)
-- Upserts inflation data for a region
AddEventHandler('atc:economy:inflation:upsert', function(regionId, inflationRate, inflationData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        regionId      = regionId,
        inflationRate = tonumber(inflationRate) or 0,
        ownerServerId = GetConvar('atc_server_id', 'default'),
        inflationData = inflationData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/economy-regulation/inflation',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('economy_regulation', 'inflation upsert failed: ' .. tostring(status))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:economy:tax:upsert (Server-only)
-- Upserts tax rate data for a region
AddEventHandler('atc:economy:tax:upsert', function(regionId, taxRate, taxType, taxData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        regionId      = regionId,
        taxRate       = tonumber(taxRate) or 0,
        taxType       = taxType,
        ownerServerId = GetConvar('atc_server_id', 'default'),
        taxData       = taxData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/economy-regulation/tax',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('economy_regulation', 'tax upsert failed: ' .. tostring(status))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:economy:stabilize:start (Server-only)
-- Starts a market stabilization operation
AddEventHandler('atc:economy:stabilize:start', function(stabilizationType, regionId, stabilizationNonce, stabilizationData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        stabilizationType  = stabilizationType,
        ownerServerId      = GetConvar('atc_server_id', 'default'),
        stabilizationNonce = stabilizationNonce,
        regionId           = regionId,
        stabilizationData  = stabilizationData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/economy-regulation/stabilize',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('economy_regulation', 'stabilize start failed: ' .. tostring(status))
            else
                TriggerEvent('atc:economy:stabilization:started', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:economy:stabilization:complete (Server-only)
AddEventHandler('atc:economy:stabilization:complete', function(stabilizationId)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/economy-regulation/stabilizations/' .. stabilizationId .. '/complete',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('economy_regulation', 'stabilization complete failed: ' .. tostring(status))
            end
        end,
        'POST',
        '{}',
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:economy:stabilization:fail (Server-only)
AddEventHandler('atc:economy:stabilization:fail', function(stabilizationId)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/economy-regulation/stabilizations/' .. stabilizationId .. '/fail',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('economy_regulation', 'stabilization fail failed: ' .. tostring(status))
            end
        end,
        'POST',
        '{}',
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:economy:regulation:cleanup (Scheduler)
-- Purges stale regulations, balancings, and stabilizations
AddEventHandler('atc:economy:regulation:cleanup', function(thresholdMs)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/economy-regulation/cleanup',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('economy_regulation', 'cleanup failed: ' .. tostring(status))
            end
        end,
        'POST',
        json.encode({ thresholdMs = thresholdMs or 300000 }),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)
