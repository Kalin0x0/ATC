-- Phase 64: Meta-Orchestration, Runtime Self-Healing & Autonomous Infrastructure Coordination Bridge
-- Server-side only. All meta-runtime operations are server-authoritative.

local function checkRateLimit(source)
    if not source or source == 0 then return true end
    if not _G._metaRateLimits then _G._metaRateLimits = {} end
    local now = GetGameTimer()
    local key = tostring(source)
    if not _G._metaRateLimits[key] then
        _G._metaRateLimits[key] = { count = 0, window = now }
    end
    local entry = _G._metaRateLimits[key]
    if (now - entry.window) > 60000 then
        entry.count = 0
        entry.window = now
    end
    entry.count = entry.count + 1
    return entry.count <= 30
end

-- atc:meta:register (Server-only)
AddEventHandler('atc:meta:register', function(metaType, metaNonce, metaData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        metaType      = metaType,
        ownerServerId = GetConvar('atc_server_id', 'default'),
        metaNonce     = metaNonce,
        metaData      = metaData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/meta-runtime/register',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('meta_runtime', 'meta register failed: ' .. tostring(status))
            else
                TriggerEvent('atc:meta:registered', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:meta:pause (Server-only)
AddEventHandler('atc:meta:pause', function(id)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/meta-runtime/' .. id .. '/pause',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('meta_runtime', 'meta pause failed: ' .. tostring(status))
            else
                TriggerEvent('atc:meta:paused', json.decode(body))
            end
        end,
        'POST',
        json.encode({}),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:meta:terminate (Server-only)
AddEventHandler('atc:meta:terminate', function(id)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/meta-runtime/' .. id .. '/terminate',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('meta_runtime', 'meta terminate failed: ' .. tostring(status))
            else
                TriggerEvent('atc:meta:terminated', json.decode(body))
            end
        end,
        'POST',
        json.encode({}),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:meta:healing:start (Server-only)
AddEventHandler('atc:meta:healing:start', function(healingType, targetNode, healingNonce, healingData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        healingType   = healingType,
        ownerServerId = GetConvar('atc_server_id', 'default'),
        targetNode    = targetNode,
        healingNonce  = healingNonce,
        healingData   = healingData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/meta-runtime/healing/start',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('meta_runtime', 'healing start failed: ' .. tostring(status))
            else
                TriggerEvent('atc:meta:healing:started', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:meta:healing:complete (Server-only)
AddEventHandler('atc:meta:healing:complete', function(id)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/meta-runtime/healing/' .. id .. '/complete',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('meta_runtime', 'healing complete failed: ' .. tostring(status))
            else
                TriggerEvent('atc:meta:healing:completed', json.decode(body))
            end
        end,
        'POST',
        json.encode({}),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:meta:repair:start (Server-only)
AddEventHandler('atc:meta:repair:start', function(repairType, targetNode, repairNonce, repairData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        repairType    = repairType,
        ownerServerId = GetConvar('atc_server_id', 'default'),
        targetNode    = targetNode,
        repairNonce   = repairNonce,
        repairData    = repairData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/meta-runtime/repair/start',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('meta_runtime', 'repair start failed: ' .. tostring(status))
            else
                TriggerEvent('atc:meta:repair:started', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:meta:repair:complete (Server-only)
AddEventHandler('atc:meta:repair:complete', function(id)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/meta-runtime/repair/' .. id .. '/complete',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('meta_runtime', 'repair complete failed: ' .. tostring(status))
            else
                TriggerEvent('atc:meta:repair:completed', json.decode(body))
            end
        end,
        'POST',
        json.encode({}),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:meta:allocation:upsert (Server-only)
AddEventHandler('atc:meta:allocation:upsert', function(entityId, allocationType, allocationData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        entityId        = entityId,
        allocationType  = allocationType,
        ownerServerId   = GetConvar('atc_server_id', 'default'),
        allocationData  = allocationData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/meta-runtime/allocations',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('meta_runtime', 'allocation upsert failed: ' .. tostring(status))
            else
                TriggerEvent('atc:meta:allocated', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:meta:coordination:upsert (Server-only)
AddEventHandler('atc:meta:coordination:upsert', function(nodeId, coordinationType, coordinationData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        nodeId            = nodeId,
        coordinationType  = coordinationType,
        ownerServerId     = GetConvar('atc_server_id', 'default'),
        coordinationData  = coordinationData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/meta-runtime/coordination',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('meta_runtime', 'coordination upsert failed: ' .. tostring(status))
            else
                TriggerEvent('atc:meta:coordination:updated', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:meta:coordination:fail (Server-only)
AddEventHandler('atc:meta:coordination:fail', function(nodeId)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/meta-runtime/coordination/' .. nodeId .. '/fail',
        function(status, _body)
            if status ~= 200 then
                ATC.Log.Warn('meta_runtime', 'node fail failed: ' .. tostring(status))
            else
                TriggerEvent('atc:meta:node:failed', { nodeId = nodeId })
            end
        end,
        'POST',
        json.encode({}),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:meta:cleanup (Server-only, scheduled)
AddEventHandler('atc:meta:cleanup', function(thresholdMs)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/meta-runtime/cleanup',
        function(status, _body)
            if status ~= 200 then
                ATC.Log.Warn('meta_runtime', 'cleanup failed: ' .. tostring(status))
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
        TriggerEvent('atc:meta:cleanup', 300000)
    end
end)
