-- Phase 55: Runtime Recovery, Failover & Chaos Resilience bridge
-- All resilience operations are internal server-to-server only. No client events.

-- Initiate a failover between servers
AddEventHandler('atc:resilience:failover:initiate', function(payload)
    if not payload or not payload.failoverId or not payload.failoverType then return end

    local ok, err = ATC.SDK.HTTP.Post('/api/v1/resilience/failover/initiate', {
        failoverId      = payload.failoverId,
        failoverType    = payload.failoverType,
        sourceServerId  = payload.sourceServerId or ATC.SDK.Server.GetId(),
        targetServerId  = payload.targetServerId,
        failoverNonce   = payload.failoverNonce,
        failoverData    = payload.failoverData or {},
    })

    if not ok then
        ATC.SDK.Log.Error('runtime_resilience', 'Failover initiation failed', { err = err })
    end
end)

-- Complete a failover
AddEventHandler('atc:resilience:failover:complete', function(id)
    if not id or type(id) ~= 'string' then return end
    ATC.SDK.HTTP.Post('/api/v1/resilience/failover/' .. id .. '/complete', {})
end)

-- Mark a failover as failed
AddEventHandler('atc:resilience:failover:fail', function(id)
    if not id or type(id) ~= 'string' then return end
    ATC.SDK.HTTP.Post('/api/v1/resilience/failover/' .. id .. '/fail', {})
end)

-- Initiate a recovery operation
AddEventHandler('atc:resilience:recovery:initiate', function(payload)
    if not payload or not payload.operationId or not payload.operationType then return end

    ATC.SDK.HTTP.Post('/api/v1/resilience/recovery/initiate', {
        operationId   = payload.operationId,
        operationType = payload.operationType,
        entityId      = payload.entityId,
        ownerServerId = ATC.SDK.Server.GetId(),
        recoveryData  = payload.recoveryData or {},
    })
end)

-- Complete a recovery operation
AddEventHandler('atc:resilience:recovery:complete', function(id)
    if not id or type(id) ~= 'string' then return end
    ATC.SDK.HTTP.Post('/api/v1/resilience/recovery/' .. id .. '/complete', {})
end)

-- Create a recovery snapshot
AddEventHandler('atc:resilience:snapshot:create', function(payload)
    if not payload or not payload.entityId or not payload.snapshotType then return end

    ATC.SDK.HTTP.Post('/api/v1/resilience/snapshots/create', {
        entityId       = payload.entityId,
        snapshotType   = payload.snapshotType,
        ownerServerId  = ATC.SDK.Server.GetId(),
        snapshotData   = payload.snapshotData or {},
        sequenceNumber = payload.sequenceNumber or 0,
    })
end)

-- Restore a snapshot
AddEventHandler('atc:resilience:snapshot:restore', function(id)
    if not id or type(id) ~= 'string' then return end

    local ok, err = ATC.SDK.HTTP.Post('/api/v1/resilience/snapshots/' .. id .. '/restore', {})
    if not ok then
        ATC.SDK.Log.Error('runtime_resilience', 'Snapshot restore failed', { id = id, err = err })
    end
end)

-- Update health score for a resilience record
AddEventHandler('atc:resilience:health:update', function(payload)
    if not payload or not payload.recordId or not payload.healthScore then return end

    ATC.SDK.HTTP.Post('/api/v1/resilience/health/upsert', {
        recordId       = payload.recordId,
        resilienceType = payload.resilienceType or 'server',
        ownerServerId  = ATC.SDK.Server.GetId(),
        healthScore    = payload.healthScore,
        resilienceData = payload.resilienceData or {},
    })
end)

-- Start a chaos test (authorized internal test environments only)
AddEventHandler('atc:resilience:chaos:start', function(payload)
    if not payload or not payload.testId or not payload.testType then return end

    ATC.SDK.HTTP.Post('/api/v1/resilience/chaos/start', {
        testId         = payload.testId,
        testType       = payload.testType,
        targetServerId = payload.targetServerId,
        chaosData      = payload.chaosData or {},
    })
end)

-- Complete or abort a chaos test
AddEventHandler('atc:resilience:chaos:complete', function(id)
    if not id or type(id) ~= 'string' then return end
    ATC.SDK.HTTP.Post('/api/v1/resilience/chaos/' .. id .. '/complete', {})
end)

AddEventHandler('atc:resilience:chaos:abort', function(id)
    if not id or type(id) ~= 'string' then return end
    ATC.SDK.HTTP.Post('/api/v1/resilience/chaos/' .. id .. '/abort', {})
end)

-- Cleanup stale failover records (called by scheduler)
AddEventHandler('atc:resilience:cleanup', function(thresholdMs)
    ATC.SDK.HTTP.Post('/api/v1/resilience/cleanup', {
        thresholdMs = thresholdMs or 60000,
    })
end)

ATC.SDK.Log.Info('runtime_resilience', 'Phase 55 runtime resilience bridge loaded')
