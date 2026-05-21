-- Phase 59: Federation, Multi-Region & Inter-Cluster Runtime Bridge
-- Server-side only. All federation operations are server-authoritative.

local RATE_LIMIT_WINDOW = 60000
local RATE_LIMIT_MAX    = 30
local _rateBucket       = {}

local function checkRateLimit(source)
    local now = GetGameTimer()
    if not _rateBucket[source] then
        _rateBucket[source] = { count = 0, windowStart = now }
    end
    local bucket = _rateBucket[source]
    if now - bucket.windowStart > RATE_LIMIT_WINDOW then
        bucket.count = 0
        bucket.windowStart = now
    end
    bucket.count = bucket.count + 1
    return bucket.count <= RATE_LIMIT_MAX
end

-- atc:federation:node:register (Server-only)
-- Registers a federation node for this server
AddEventHandler('atc:federation:node:register', function(nodeType, nodeNonce, regionId, address, nodeData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        nodeType      = nodeType,
        ownerServerId = GetConvar('atc_server_id', 'default'),
        nodeNonce     = nodeNonce,
        regionId      = regionId,
        address       = address,
        nodeData      = nodeData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/federation/nodes/register',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('federation', 'node register failed: ' .. tostring(status))
            else
                TriggerEvent('atc:federation:node:registered', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:federation:node:deregister (Server-only)
-- Deregisters a federation node
AddEventHandler('atc:federation:node:deregister', function(nodeId)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/federation/nodes/' .. nodeId .. '/deregister',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('federation', 'node deregister failed: ' .. tostring(status))
            end
        end,
        'POST',
        '{}',
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:federation:region:sync (Server-only)
-- Synchronizes region runtime state across the federation
AddEventHandler('atc:federation:region:sync', function(regionId, syncNonce, regionData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        regionId      = regionId,
        ownerServerId = GetConvar('atc_server_id', 'default'),
        syncNonce     = syncNonce,
        regionData    = regionData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/federation/sync',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('federation', 'region sync failed: ' .. tostring(status))
            else
                TriggerEvent('atc:federation:region:synced', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:federation:region:deactivate (Server-only)
-- Deactivates a region in the federation
AddEventHandler('atc:federation:region:deactivate', function(regionId)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/federation/regions/' .. regionId .. '/deactivate',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('federation', 'region deactivate failed: ' .. tostring(status))
            end
        end,
        'POST',
        '{}',
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:federation:route:create (Server-only)
-- Creates an inter-cluster route
AddEventHandler('atc:federation:route:create', function(sourceClusterId, targetClusterId, routeNonce, routeData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        sourceClusterId = sourceClusterId,
        targetClusterId = targetClusterId,
        ownerServerId   = GetConvar('atc_server_id', 'default'),
        routeNonce      = routeNonce,
        routeData       = routeData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/federation/routes/create',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('federation', 'route create failed: ' .. tostring(status))
            else
                TriggerEvent('atc:federation:route:created', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:federation:route:complete (Server-only)
AddEventHandler('atc:federation:route:complete', function(routeId)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/federation/routes/' .. routeId .. '/complete',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('federation', 'route complete failed: ' .. tostring(status))
            end
        end,
        'POST',
        '{}',
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:federation:route:fail (Server-only)
AddEventHandler('atc:federation:route:fail', function(routeId)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/federation/routes/' .. routeId .. '/fail',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('federation', 'route fail failed: ' .. tostring(status))
            end
        end,
        'POST',
        '{}',
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:federation:ownership:claim (Server-only)
-- Claims federation ownership of an entity for this cluster
AddEventHandler('atc:federation:ownership:claim', function(entityId, claimNonce, ownershipData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        entityId      = entityId,
        clusterId     = GetConvar('atc_cluster_id', 'default'),
        ownerServerId = GetConvar('atc_server_id', 'default'),
        claimNonce    = claimNonce,
        ownershipData = ownershipData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/federation/ownership/claim',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('federation', 'ownership claim failed: ' .. tostring(status))
            else
                TriggerEvent('atc:federation:ownership:claimed', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:federation:ownership:transfer (Server-only)
-- Transfers federation ownership of an entity to a new cluster
AddEventHandler('atc:federation:ownership:transfer', function(entityId, newClusterId)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        entityId     = entityId,
        newClusterId = newClusterId,
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/federation/transfer',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('federation', 'ownership transfer failed: ' .. tostring(status))
            else
                TriggerEvent('atc:federation:ownership:transferred', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:federation:ownership:release (Server-only)
AddEventHandler('atc:federation:ownership:release', function(entityId)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/federation/ownership/' .. entityId .. '/release',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('federation', 'ownership release failed: ' .. tostring(status))
            end
        end,
        'POST',
        '{}',
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:federation:consistency:start (Server-only)
-- Starts a regional consistency check
AddEventHandler('atc:federation:consistency:start', function(checkType, regionId, checkNonce, checkData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        checkType     = checkType,
        regionId      = regionId,
        ownerServerId = GetConvar('atc_server_id', 'default'),
        checkNonce    = checkNonce,
        checkData     = checkData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/federation/consistency/start',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('federation', 'consistency start failed: ' .. tostring(status))
            else
                TriggerEvent('atc:federation:consistency:started', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:federation:consistency:complete (Server-only)
AddEventHandler('atc:federation:consistency:complete', function(checkId)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/federation/consistency/' .. checkId .. '/complete',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('federation', 'consistency complete failed: ' .. tostring(status))
            end
        end,
        'POST',
        '{}',
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:federation:consistency:fail (Server-only)
AddEventHandler('atc:federation:consistency:fail', function(checkId)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/federation/consistency/' .. checkId .. '/fail',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('federation', 'consistency fail failed: ' .. tostring(status))
            end
        end,
        'POST',
        '{}',
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:federation:cleanup (Scheduler)
-- Purges stale nodes, routes, and consistency checks
AddEventHandler('atc:federation:cleanup', function(thresholdMs)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/federation/cleanup',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('federation', 'cleanup failed: ' .. tostring(status))
            end
        end,
        'POST',
        json.encode({ thresholdMs = thresholdMs or 300000 }),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)
