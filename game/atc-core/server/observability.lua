-- Phase 56: Distributed Observability, Telemetry & Runtime Tracing Bridge
-- Server-side only. All trace/metric data is server-authoritative.

local RATE_LIMIT_WINDOW = 60000
local RATE_LIMIT_MAX    = 60
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

-- atc:observability:trace:start (Server-only)
-- Starts a distributed trace for a game operation
AddEventHandler('atc:observability:trace:start', function(traceType, sourceNode, traceNonce, data)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        traceType    = traceType,
        sourceNode   = sourceNode or 'fivem-server',
        ownerServerId = GetConvar('atc_server_id', 'default'),
        traceNonce   = traceNonce,
        traceData    = data or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/observability/traces/start',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('observability', 'trace start failed: ' .. tostring(status))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:observability:metric:record (Rate-limited, Client → Server)
-- Records a runtime metric from a client source
RegisterNetEvent('atc:observability:metric:record')
AddEventHandler('atc:observability:metric:record', function(metricType, value, entityId)
    local source = source
    if not checkRateLimit(source) then return end

    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        metricType    = metricType,
        ownerServerId = GetConvar('atc_server_id', 'default'),
        value         = tonumber(value) or 0,
        entityId      = entityId,
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/observability/metrics/record',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('observability', 'metric record failed: ' .. tostring(status))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:observability:correlation:create (Server-only)
-- Records a failure correlation event
AddEventHandler('atc:observability:correlation:create', function(failureType, sourceNode, correlationData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        failureType   = failureType,
        sourceNode    = sourceNode or 'fivem-server',
        ownerServerId = GetConvar('atc_server_id', 'default'),
        correlationData = correlationData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/observability/correlation/create',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('observability', 'correlation create failed: ' .. tostring(status))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:observability:cleanup (Scheduler)
-- Purges stale traces and expired trace states
AddEventHandler('atc:observability:cleanup', function(thresholdMs)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/observability/cleanup',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('observability', 'cleanup failed: ' .. tostring(status))
            end
        end,
        'POST',
        json.encode({ thresholdMs = thresholdMs or 300000 }),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)
