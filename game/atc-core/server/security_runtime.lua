-- Phase 60: Advanced Runtime Security, Intrusion Response & Autonomous Protection Bridge
-- Server-side only. All security decisions are server-authoritative.

local RATE_LIMIT_WINDOW = 60000
local RATE_LIMIT_MAX    = 20
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

-- atc:security:intrusion:detect (Server-only)
-- Records a detected intrusion event
AddEventHandler('atc:security:intrusion:detect', function(intrusionType, severity, entityId, sourceNode, intrusionNonce, intrusionData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        intrusionType  = intrusionType,
        severity       = severity,
        ownerServerId  = GetConvar('atc_server_id', 'default'),
        intrusionNonce = intrusionNonce,
        entityId       = entityId,
        sourceNode     = sourceNode or 'fivem-server',
        intrusionData  = intrusionData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/security-runtime/intrusions/detect',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('security_runtime', 'intrusion detect failed: ' .. tostring(status))
            else
                TriggerEvent('atc:security:intrusion:detected', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:security:intrusion:resolve (Server-only)
-- Resolves or marks an intrusion as a false positive
AddEventHandler('atc:security:intrusion:resolve', function(intrusionId)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/security-runtime/intrusions/' .. intrusionId .. '/resolve',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('security_runtime', 'intrusion resolve failed: ' .. tostring(status))
            end
        end,
        'POST',
        '{}',
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:security:threat:detect (Server-only)
-- Records a detected threat
AddEventHandler('atc:security:threat:detect', function(threatType, severity, entityId, threatNonce, threatData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        threatType    = threatType,
        severity      = severity,
        ownerServerId = GetConvar('atc_server_id', 'default'),
        threatNonce   = threatNonce,
        entityId      = entityId,
        threatData    = threatData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/security-runtime/threats/detect',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('security_runtime', 'threat detect failed: ' .. tostring(status))
            else
                TriggerEvent('atc:security:threat:detected', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:security:threat:mitigate (Server-only)
-- Mitigates an active threat
AddEventHandler('atc:security:threat:mitigate', function(threatId)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/security-runtime/threats/' .. threatId .. '/mitigate',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('security_runtime', 'threat mitigate failed: ' .. tostring(status))
            else
                TriggerEvent('atc:security:threat:mitigated', json.decode(body))
            end
        end,
        'POST',
        '{}',
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:security:isolate (Server-only)
-- Isolates an entity from runtime systems
AddEventHandler('atc:security:isolate', function(entityId, isolationType, isolationData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        entityId      = entityId,
        isolationType = isolationType,
        ownerServerId = GetConvar('atc_server_id', 'default'),
        isolationData = isolationData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/security-runtime/isolate',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('security_runtime', 'isolate failed: ' .. tostring(status))
            else
                TriggerEvent('atc:security:isolated', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:security:isolation:release (Server-only)
-- Releases an entity from isolation
AddEventHandler('atc:security:isolation:release', function(entityId)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/security-runtime/isolation/' .. entityId .. '/release',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('security_runtime', 'isolation release failed: ' .. tostring(status))
            end
        end,
        'POST',
        '{}',
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:security:escalation:create (Server-only)
-- Creates a security escalation
AddEventHandler('atc:security:escalation:create', function(escalationType, severity, entityId, escalationNonce, escalationData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        escalationType  = escalationType,
        severity        = severity,
        ownerServerId   = GetConvar('atc_server_id', 'default'),
        escalationNonce = escalationNonce,
        entityId        = entityId,
        escalationData  = escalationData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/security-runtime/escalations/create',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('security_runtime', 'escalation create failed: ' .. tostring(status))
            else
                TriggerEvent('atc:security:escalation:created', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:security:escalation:resolve (Server-only)
AddEventHandler('atc:security:escalation:resolve', function(escalationId)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/security-runtime/escalations/' .. escalationId .. '/resolve',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('security_runtime', 'escalation resolve failed: ' .. tostring(status))
            end
        end,
        'POST',
        '{}',
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:security:contain (Server-only)
-- Initiates threat containment
AddEventHandler('atc:security:contain', function(containmentType, threatId, containmentNonce, containmentData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        containmentType  = containmentType,
        threatId         = threatId,
        ownerServerId    = GetConvar('atc_server_id', 'default'),
        containmentNonce = containmentNonce,
        containmentData  = containmentData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/security-runtime/contain',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('security_runtime', 'contain failed: ' .. tostring(status))
            else
                TriggerEvent('atc:security:containment:created', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:security:containment:complete (Server-only)
AddEventHandler('atc:security:containment:complete', function(containmentId)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/security-runtime/containments/' .. containmentId .. '/complete',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('security_runtime', 'containment complete failed: ' .. tostring(status))
            end
        end,
        'POST',
        '{}',
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:security:containment:fail (Server-only)
AddEventHandler('atc:security:containment:fail', function(containmentId)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/security-runtime/containments/' .. containmentId .. '/fail',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('security_runtime', 'containment fail failed: ' .. tostring(status))
            end
        end,
        'POST',
        '{}',
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:security:report (Rate-limited, Client → Server)
-- Allows clients to report suspicious activity — server validates before acting
RegisterNetEvent('atc:security:report')
AddEventHandler('atc:security:report', function(reportType, targetEntity, reportData)
    local source = source
    if not checkRateLimit(source) then return end

    -- Sanitize and re-validate all client-supplied values server-side
    if type(reportType) ~= 'string' or #reportType > 64 then return end
    if targetEntity ~= nil and type(targetEntity) ~= 'string' then return end

    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        intrusionType  = 'player_report',
        severity       = 'low',
        ownerServerId  = GetConvar('atc_server_id', 'default'),
        intrusionNonce = tostring(source) .. '_' .. tostring(GetGameTimer()),
        entityId       = targetEntity,
        sourceNode     = 'client:' .. tostring(source),
        intrusionData  = { reportType = reportType, reportData = reportData or {} },
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/security-runtime/intrusions/detect',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('security_runtime', 'player report failed: ' .. tostring(status))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:security:runtime:cleanup (Scheduler)
-- Purges stale intrusions, threats, and containments
AddEventHandler('atc:security:runtime:cleanup', function(thresholdMs)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/security-runtime/cleanup',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('security_runtime', 'cleanup failed: ' .. tostring(status))
            end
        end,
        'POST',
        json.encode({ thresholdMs = thresholdMs or 300000 }),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)
