-- Phase 66: Autonomous Runtime Evolution, Adaptive Optimization & Self-Tuning Infrastructure Bridge
-- Server-side only. All evolution operations are server-authoritative.

local function checkRateLimit(source)
    if not source or source == 0 then return true end
    if not _G._evoRateLimits then _G._evoRateLimits = {} end
    local now = GetGameTimer()
    local key = tostring(source)
    if not _G._evoRateLimits[key] then
        _G._evoRateLimits[key] = { count = 0, window = now }
    end
    local entry = _G._evoRateLimits[key]
    if (now - entry.window) > 60000 then
        entry.count = 0
        entry.window = now
    end
    entry.count = entry.count + 1
    return entry.count <= 30
end

-- atc:evolution:start (Server-only)
AddEventHandler('atc:evolution:start', function(evolutionType, evolutionNonce, evolutionData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        evolutionType = evolutionType,
        ownerServerId = GetConvar('atc_server_id', 'default'),
        evolutionNonce = evolutionNonce,
        evolutionData  = evolutionData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/evolution/start',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('evolution', 'evolution start failed: ' .. tostring(status))
            else
                TriggerEvent('atc:evolution:started', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:evolution:activate (Server-only)
AddEventHandler('atc:evolution:activate', function(id)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/evolution/' .. id .. '/activate',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('evolution', 'evolution activate failed: ' .. tostring(status))
            else
                TriggerEvent('atc:evolution:activated', json.decode(body))
            end
        end,
        'POST',
        json.encode({}),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:evolution:complete (Server-only)
AddEventHandler('atc:evolution:complete', function(id)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/evolution/' .. id .. '/complete',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('evolution', 'evolution complete failed: ' .. tostring(status))
            else
                TriggerEvent('atc:evolution:completed', json.decode(body))
            end
        end,
        'POST',
        json.encode({}),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:evolution:fail (Server-only)
AddEventHandler('atc:evolution:fail', function(id)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/evolution/' .. id .. '/fail',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('evolution', 'evolution fail failed: ' .. tostring(status))
            else
                TriggerEvent('atc:evolution:failed', json.decode(body))
            end
        end,
        'POST',
        json.encode({}),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:evolution:rollback (Server-only)
AddEventHandler('atc:evolution:rollback', function(id)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/evolution/' .. id .. '/rollback',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('evolution', 'evolution rollback failed: ' .. tostring(status))
            else
                TriggerEvent('atc:evolution:rolledback', json.decode(body))
            end
        end,
        'POST',
        json.encode({}),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:optimization:start (Server-only)
AddEventHandler('atc:optimization:start', function(optimizationType, targetNode, ownerServerId, optimizationNonce, optimizationData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        optimizationType  = optimizationType,
        targetNode        = targetNode,
        ownerServerId     = ownerServerId or GetConvar('atc_server_id', 'default'),
        optimizationNonce = optimizationNonce,
        optimizationData  = optimizationData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/evolution/optimize',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('evolution', 'optimization start failed: ' .. tostring(status))
            else
                TriggerEvent('atc:optimization:started', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:optimization:complete (Server-only)
AddEventHandler('atc:optimization:complete', function(id)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/evolution/optimize/' .. id .. '/complete',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('evolution', 'optimization complete failed: ' .. tostring(status))
            else
                TriggerEvent('atc:optimization:completed', json.decode(body))
            end
        end,
        'POST',
        json.encode({}),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:tuning:upsert (Server-only)
AddEventHandler('atc:tuning:upsert', function(entityId, tuningType, tuningData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        entityId     = entityId,
        tuningType   = tuningType,
        ownerServerId = GetConvar('atc_server_id', 'default'),
        tuningData   = tuningData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/evolution/tune',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('evolution', 'tuning upsert failed: ' .. tostring(status))
            else
                TriggerEvent('atc:tuning:upserted', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:autonomous:trigger (Server-only)
AddEventHandler('atc:autonomous:trigger', function(triggerType, triggerNonce, triggerData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        triggerType   = triggerType,
        ownerServerId = GetConvar('atc_server_id', 'default'),
        triggerNonce  = triggerNonce,
        triggerData   = triggerData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/evolution/autonomous/trigger',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('evolution', 'autonomous trigger failed: ' .. tostring(status))
            else
                TriggerEvent('atc:autonomous:triggered', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:autonomous:apply (Server-only)
AddEventHandler('atc:autonomous:apply', function(id)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/evolution/autonomous/' .. id .. '/apply',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('evolution', 'autonomous apply failed: ' .. tostring(status))
            else
                TriggerEvent('atc:autonomous:applied', json.decode(body))
            end
        end,
        'POST',
        json.encode({}),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:autonomous:revert (Server-only)
AddEventHandler('atc:autonomous:revert', function(id)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/evolution/autonomous/' .. id .. '/revert',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('evolution', 'autonomous revert failed: ' .. tostring(status))
            else
                TriggerEvent('atc:autonomous:reverted', json.decode(body))
            end
        end,
        'POST',
        json.encode({}),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:distopt:upsert (Server-only)
AddEventHandler('atc:distopt:upsert', function(nodeId, optType, ownerServerId, optData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        nodeId        = nodeId,
        optType       = optType,
        ownerServerId = ownerServerId or GetConvar('atc_server_id', 'default'),
        optData       = optData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/evolution/distributed-opt',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('evolution', 'distributed-opt upsert failed: ' .. tostring(status))
            else
                TriggerEvent('atc:distopt:upserted', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:distopt:fail (Server-only)
AddEventHandler('atc:distopt:fail', function(nodeId)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/evolution/distributed-opt/' .. nodeId .. '/fail',
        function(status, _body)
            if status ~= 204 then
                ATC.Log.Warn('evolution', 'distributed-opt fail failed: ' .. tostring(status))
            else
                TriggerEvent('atc:distopt:failed', { nodeId = nodeId })
            end
        end,
        'POST',
        json.encode({}),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:evolution:cleanup (Server-only, scheduled)
AddEventHandler('atc:evolution:cleanup', function(thresholdMs)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/evolution/cleanup',
        function(status, _body)
            if status ~= 200 then
                ATC.Log.Warn('evolution', 'cleanup failed: ' .. tostring(status))
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
        TriggerEvent('atc:evolution:cleanup', 300000)
    end
end)
