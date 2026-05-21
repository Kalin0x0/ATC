-- Phase 57: Deployment, Cluster Orchestration & Runtime Lifecycle Bridge
-- Server-side only. All cluster operations are server-authoritative.

-- atc:cluster:node:register (Server-only)
-- Registers a cluster node with the runtime
AddEventHandler('atc:cluster:node:register', function(nodeType, nodeNonce, address, nodeData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        nodeType      = nodeType,
        ownerServerId = GetConvar('atc_server_id', 'default'),
        nodeNonce     = nodeNonce,
        address       = address,
        nodeData      = nodeData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/cluster/nodes/register',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('cluster', 'node register failed: ' .. tostring(status))
            else
                TriggerEvent('atc:cluster:node:registered', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:cluster:deployment:start (Server-only)
-- Starts a deployment operation for a target node
AddEventHandler('atc:cluster:deployment:start', function(deploymentType, targetNode, deploymentNonce, deploymentData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        deploymentType  = deploymentType,
        targetNode      = targetNode,
        ownerServerId   = GetConvar('atc_server_id', 'default'),
        deploymentNonce = deploymentNonce,
        deploymentData  = deploymentData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/cluster/deployments/start',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('cluster', 'deployment start failed: ' .. tostring(status))
            else
                TriggerEvent('atc:cluster:deployment:started', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:cluster:lifecycle:upsert (Server-only)
-- Upserts the lifecycle state for a node
AddEventHandler('atc:cluster:lifecycle:upsert', function(nodeId, lifecycleType, status, lifecycleData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        nodeId        = nodeId,
        lifecycleType = lifecycleType,
        ownerServerId = GetConvar('atc_server_id', 'default'),
        status        = status,
        lifecycleData = lifecycleData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/cluster/lifecycle/upsert',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('cluster', 'lifecycle upsert failed: ' .. tostring(status))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:cluster:allocation:allocate (Server-only)
-- Allocates an entity to a specific cluster node
AddEventHandler('atc:cluster:allocation:allocate', function(entityId, nodeId, allocationData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        entityId      = entityId,
        nodeId        = nodeId,
        ownerServerId = GetConvar('atc_server_id', 'default'),
        allocationData = allocationData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/cluster/allocation/allocate',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('cluster', 'allocation failed: ' .. tostring(status))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:cluster:cleanup (Scheduler)
-- Purges stale nodes, deployments and released allocations
AddEventHandler('atc:cluster:cleanup', function(thresholdMs)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/cluster/cleanup',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('cluster', 'cleanup failed: ' .. tostring(status))
            end
        end,
        'POST',
        json.encode({ thresholdMs = thresholdMs or 300000 }),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)
