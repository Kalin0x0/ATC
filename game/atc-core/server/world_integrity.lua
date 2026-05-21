-- Phase 67: Final Distributed Consistency, Runtime Locking & Deterministic World Integrity Bridge
-- Server-side only. All world integrity operations are server-authoritative.

local function checkRateLimit(source)
    if not source or source == 0 then return true end
    if not _G._integrityRateLimits then _G._integrityRateLimits = {} end
    local now = GetGameTimer()
    local key = tostring(source)
    if not _G._integrityRateLimits[key] then
        _G._integrityRateLimits[key] = { count = 0, window = now }
    end
    local entry = _G._integrityRateLimits[key]
    if (now - entry.window) > 60000 then
        entry.count = 0
        entry.window = now
    end
    entry.count = entry.count + 1
    return entry.count <= 30
end

-- atc:integrity:create (Server-only)
AddEventHandler('atc:integrity:create', function(integrityType, integrityNonce, integrityData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        integrityType  = integrityType,
        ownerServerId  = GetConvar('atc_server_id', 'default'),
        integrityNonce = integrityNonce,
        integrityData  = integrityData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/world-integrity',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('world_integrity', 'integrity create failed: ' .. tostring(status))
            else
                TriggerEvent('atc:integrity:created', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:integrity:verify (Server-only)
AddEventHandler('atc:integrity:verify', function(id, worldHash)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {}
    if worldHash then payload.worldHash = worldHash end
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/world-integrity/' .. id .. '/verify',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('world_integrity', 'integrity verify failed: ' .. tostring(status))
            else
                TriggerEvent('atc:integrity:verified', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:integrity:fail (Server-only)
AddEventHandler('atc:integrity:fail', function(id)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/world-integrity/' .. id .. '/fail',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('world_integrity', 'integrity fail failed: ' .. tostring(status))
            else
                TriggerEvent('atc:integrity:failed', json.decode(body))
            end
        end,
        'POST',
        json.encode({}),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:integrity:corrupt (Server-only)
AddEventHandler('atc:integrity:corrupt', function(id)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/world-integrity/' .. id .. '/corrupt',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('world_integrity', 'integrity corrupt mark failed: ' .. tostring(status))
            else
                TriggerEvent('atc:integrity:corrupted', json.decode(body))
            end
        end,
        'POST',
        json.encode({}),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:lock:acquire (Server-only)
AddEventHandler('atc:lock:acquire', function(resourceKey, lockType, lockNonce, expiresAt, lockData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        resourceKey   = resourceKey,
        lockType      = lockType,
        ownerServerId = GetConvar('atc_server_id', 'default'),
        lockNonce     = lockNonce,
        lockData      = lockData or {},
    }
    if expiresAt then payload.expiresAt = expiresAt end
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/world-integrity/lock',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('world_integrity', 'lock acquire failed: ' .. tostring(status))
            else
                TriggerEvent('atc:lock:acquired', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:lock:release (Server-only)
AddEventHandler('atc:lock:release', function(resourceKey)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/world-integrity/lock/' .. resourceKey .. '/release',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('world_integrity', 'lock release failed: ' .. tostring(status))
            else
                TriggerEvent('atc:lock:released', json.decode(body))
            end
        end,
        'POST',
        json.encode({}),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:consistency:upsert (Server-only)
AddEventHandler('atc:consistency:upsert', function(nodeId, consistencyType, consistencyData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        nodeId           = nodeId,
        consistencyType  = consistencyType,
        ownerServerId    = GetConvar('atc_server_id', 'default'),
        consistencyData  = consistencyData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/world-integrity/consistency',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('world_integrity', 'consistency upsert failed: ' .. tostring(status))
            else
                TriggerEvent('atc:consistency:upserted', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:consistency:diverge (Server-only)
AddEventHandler('atc:consistency:diverge', function(nodeId)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/world-integrity/consistency/' .. nodeId .. '/diverge',
        function(status, _body)
            if status ~= 204 then
                ATC.Log.Warn('world_integrity', 'consistency diverge failed: ' .. tostring(status))
            else
                TriggerEvent('atc:consistency:diverged', { nodeId = nodeId })
            end
        end,
        'POST',
        json.encode({}),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:validation:start (Server-only)
AddEventHandler('atc:validation:start', function(validationType, validationNonce, targetId, validationData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        validationType  = validationType,
        ownerServerId   = GetConvar('atc_server_id', 'default'),
        validationNonce = validationNonce,
        validationData  = validationData or {},
    }
    if targetId then payload.targetId = targetId end
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/world-integrity/validation',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('world_integrity', 'validation start failed: ' .. tostring(status))
            else
                TriggerEvent('atc:validation:started', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:validation:pass (Server-only)
AddEventHandler('atc:validation:pass', function(id)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/world-integrity/validation/' .. id .. '/pass',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('world_integrity', 'validation pass failed: ' .. tostring(status))
            else
                TriggerEvent('atc:validation:passed', json.decode(body))
            end
        end,
        'POST',
        json.encode({}),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:validation:fail (Server-only)
AddEventHandler('atc:validation:fail', function(id)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/world-integrity/validation/' .. id .. '/fail',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('world_integrity', 'validation fail failed: ' .. tostring(status))
            else
                TriggerEvent('atc:validation:failed', json.decode(body))
            end
        end,
        'POST',
        json.encode({}),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:reconcile:start (Server-only)
AddEventHandler('atc:reconcile:start', function(reconciliationType, reconciliationNonce, reconciliationData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        reconciliationType  = reconciliationType,
        ownerServerId       = GetConvar('atc_server_id', 'default'),
        reconciliationNonce = reconciliationNonce,
        reconciliationData  = reconciliationData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/world-integrity/reconcile',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('world_integrity', 'reconcile start failed: ' .. tostring(status))
            else
                TriggerEvent('atc:reconcile:started', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:reconcile:complete (Server-only)
AddEventHandler('atc:reconcile:complete', function(id)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/world-integrity/reconcile/' .. id .. '/complete',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('world_integrity', 'reconcile complete failed: ' .. tostring(status))
            else
                TriggerEvent('atc:reconcile:completed', json.decode(body))
            end
        end,
        'POST',
        json.encode({}),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:reconcile:fail (Server-only)
AddEventHandler('atc:reconcile:fail', function(id)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/world-integrity/reconcile/' .. id .. '/fail',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('world_integrity', 'reconcile fail failed: ' .. tostring(status))
            else
                TriggerEvent('atc:reconcile:failed', json.decode(body))
            end
        end,
        'POST',
        json.encode({}),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:integrity:cleanup (Server-only, scheduled)
AddEventHandler('atc:integrity:cleanup', function(thresholdMs)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/world-integrity/cleanup',
        function(status, _body)
            if status ~= 200 then
                ATC.Log.Warn('world_integrity', 'cleanup failed: ' .. tostring(status))
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
        TriggerEvent('atc:integrity:cleanup', 300000)
    end
end)
