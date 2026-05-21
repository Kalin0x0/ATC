-- Phase 65: Universal Runtime Protocol, Inter-System Contracts & Runtime Federation Bridge
-- Server-side only. All protocol operations are server-authoritative.

local function checkRateLimit(source)
    if not source or source == 0 then return true end
    if not _G._protoRateLimits then _G._protoRateLimits = {} end
    local now = GetGameTimer()
    local key = tostring(source)
    if not _G._protoRateLimits[key] then
        _G._protoRateLimits[key] = { count = 0, window = now }
    end
    local entry = _G._protoRateLimits[key]
    if (now - entry.window) > 60000 then
        entry.count = 0
        entry.window = now
    end
    entry.count = entry.count + 1
    return entry.count <= 30
end

-- atc:protocol:register (Server-only)
AddEventHandler('atc:protocol:register', function(protocolType, protocolNonce, protocolData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        protocolType  = protocolType,
        ownerServerId = GetConvar('atc_server_id', 'default'),
        protocolNonce = protocolNonce,
        protocolData  = protocolData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/runtime-protocol/register',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('runtime_protocol', 'protocol register failed: ' .. tostring(status))
            else
                TriggerEvent('atc:protocol:registered', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:protocol:pause (Server-only)
AddEventHandler('atc:protocol:pause', function(id)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/runtime-protocol/' .. id .. '/pause',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('runtime_protocol', 'protocol pause failed: ' .. tostring(status))
            else
                TriggerEvent('atc:protocol:paused', json.decode(body))
            end
        end,
        'POST',
        json.encode({}),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:protocol:terminate (Server-only)
AddEventHandler('atc:protocol:terminate', function(id)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/runtime-protocol/' .. id .. '/terminate',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('runtime_protocol', 'protocol terminate failed: ' .. tostring(status))
            else
                TriggerEvent('atc:protocol:terminated', json.decode(body))
            end
        end,
        'POST',
        json.encode({}),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:contract:register (Server-only)
AddEventHandler('atc:contract:register', function(contractType, initiatorServerId, targetServerId, contractNonce, contractData, expiresAt)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        contractType      = contractType,
        initiatorServerId = initiatorServerId,
        targetServerId    = targetServerId,
        contractNonce     = contractNonce,
        contractData      = contractData or {},
    }
    if expiresAt then payload.expiresAt = expiresAt end
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/runtime-protocol/contracts/register',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('runtime_protocol', 'contract register failed: ' .. tostring(status))
            else
                TriggerEvent('atc:contract:registered', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:contract:activate (Server-only)
AddEventHandler('atc:contract:activate', function(id)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/runtime-protocol/contracts/' .. id .. '/activate',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('runtime_protocol', 'contract activate failed: ' .. tostring(status))
            else
                TriggerEvent('atc:contract:activated', json.decode(body))
            end
        end,
        'POST',
        json.encode({}),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:contract:revoke (Server-only)
AddEventHandler('atc:contract:revoke', function(id)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/runtime-protocol/contracts/' .. id .. '/revoke',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('runtime_protocol', 'contract revoke failed: ' .. tostring(status))
            else
                TriggerEvent('atc:contract:revoked', json.decode(body))
            end
        end,
        'POST',
        json.encode({}),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:registry:upsert (Server-only)
AddEventHandler('atc:registry:upsert', function(nodeId, endpointUrl, nodeType, endpointData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        nodeId      = nodeId,
        endpointUrl = endpointUrl,
        nodeType    = nodeType,
        endpointData = endpointData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/runtime-protocol/registry',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('runtime_protocol', 'registry upsert failed: ' .. tostring(status))
            else
                TriggerEvent('atc:registry:upserted', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:registry:deregister (Server-only)
AddEventHandler('atc:registry:deregister', function(nodeId)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/runtime-protocol/registry/' .. nodeId .. '/deregister',
        function(status, _body)
            if status ~= 204 then
                ATC.Log.Warn('runtime_protocol', 'registry deregister failed: ' .. tostring(status))
            else
                TriggerEvent('atc:registry:deregistered', { nodeId = nodeId })
            end
        end,
        'POST',
        json.encode({}),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:handshake:initiate (Server-only)
AddEventHandler('atc:handshake:initiate', function(handshakeType, initiatorServerId, remoteServerId, handshakeNonce, handshakeData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        handshakeType     = handshakeType,
        initiatorServerId = initiatorServerId,
        remoteServerId    = remoteServerId,
        handshakeNonce    = handshakeNonce,
        handshakeData     = handshakeData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/runtime-protocol/handshake',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('runtime_protocol', 'handshake initiate failed: ' .. tostring(status))
            else
                TriggerEvent('atc:handshake:initiated', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:handshake:acknowledge (Server-only)
AddEventHandler('atc:handshake:acknowledge', function(id)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/runtime-protocol/handshake/' .. id .. '/acknowledge',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('runtime_protocol', 'handshake acknowledge failed: ' .. tostring(status))
            else
                TriggerEvent('atc:handshake:acknowledged', json.decode(body))
            end
        end,
        'POST',
        json.encode({}),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:handshake:complete (Server-only)
AddEventHandler('atc:handshake:complete', function(id)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/runtime-protocol/handshake/' .. id .. '/complete',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('runtime_protocol', 'handshake complete failed: ' .. tostring(status))
            else
                TriggerEvent('atc:handshake:completed', json.decode(body))
            end
        end,
        'POST',
        json.encode({}),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:handshake:reject (Server-only)
AddEventHandler('atc:handshake:reject', function(id)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/runtime-protocol/handshake/' .. id .. '/reject',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('runtime_protocol', 'handshake reject failed: ' .. tostring(status))
            else
                TriggerEvent('atc:handshake:rejected', json.decode(body))
            end
        end,
        'POST',
        json.encode({}),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:bridge:upsert (Server-only)
AddEventHandler('atc:bridge:upsert', function(bridgeId, bridgeType, sourceSystemId, targetSystemId, bridgeData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        bridgeId       = bridgeId,
        bridgeType     = bridgeType,
        sourceSystemId = sourceSystemId,
        targetSystemId = targetSystemId,
        bridgeData     = bridgeData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/runtime-protocol/bridge',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('runtime_protocol', 'bridge upsert failed: ' .. tostring(status))
            else
                TriggerEvent('atc:bridge:upserted', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:bridge:fail (Server-only)
AddEventHandler('atc:bridge:fail', function(bridgeId)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/runtime-protocol/bridge/' .. bridgeId .. '/fail',
        function(status, _body)
            if status ~= 204 then
                ATC.Log.Warn('runtime_protocol', 'bridge fail failed: ' .. tostring(status))
            else
                TriggerEvent('atc:bridge:failed', { bridgeId = bridgeId })
            end
        end,
        'POST',
        json.encode({}),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:protocol:cleanup (Server-only, scheduled)
AddEventHandler('atc:protocol:cleanup', function(thresholdMs)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/runtime-protocol/cleanup',
        function(status, _body)
            if status ~= 200 then
                ATC.Log.Warn('runtime_protocol', 'cleanup failed: ' .. tostring(status))
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
        TriggerEvent('atc:protocol:cleanup', 300000)
    end
end)
