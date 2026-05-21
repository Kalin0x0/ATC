-- Phase 58: Global Persistence, Snapshot Compression & Long-Term State Recovery Bridge
-- Server-side only. All persistence operations are server-authoritative.

-- atc:persistence:snapshot:create (Server-only)
-- Creates a global snapshot
AddEventHandler('atc:persistence:snapshot:create', function(snapshotType, snapshotNonce, entityId, snapshotData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        snapshotType  = snapshotType,
        ownerServerId = GetConvar('atc_server_id', 'default'),
        snapshotNonce = snapshotNonce,
        entityId      = entityId,
        snapshotData  = snapshotData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/persistence/snapshots/create',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('persistence', 'snapshot create failed: ' .. tostring(status))
            else
                TriggerEvent('atc:persistence:snapshot:created', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:persistence:snapshot:complete (Server-only)
-- Marks a snapshot as completed
AddEventHandler('atc:persistence:snapshot:complete', function(snapshotId)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/persistence/snapshots/' .. snapshotId .. '/complete',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('persistence', 'snapshot complete failed: ' .. tostring(status))
            end
        end,
        'POST',
        '{}',
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:persistence:state:upsert (Server-only)
-- Upserts the persistence runtime state for an entity
AddEventHandler('atc:persistence:state:upsert', function(entityId, persistenceType, persistenceData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        entityId        = entityId,
        persistenceType = persistenceType,
        ownerServerId   = GetConvar('atc_server_id', 'default'),
        persistenceData = persistenceData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/persistence/state/upsert',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('persistence', 'state upsert failed: ' .. tostring(status))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:persistence:recovery:start (Server-only)
-- Initiates a long-term recovery operation
AddEventHandler('atc:persistence:recovery:start', function(recoveryType, recoveryNonce, entityId, recoveryData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        recoveryType  = recoveryType,
        ownerServerId = GetConvar('atc_server_id', 'default'),
        recoveryNonce = recoveryNonce,
        entityId      = entityId,
        recoveryData  = recoveryData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/persistence/recovery/start',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('persistence', 'recovery start failed: ' .. tostring(status))
            else
                TriggerEvent('atc:persistence:recovery:started', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:persistence:cleanup (Scheduler)
-- Purges stale snapshots, states, and recovery records
AddEventHandler('atc:persistence:cleanup', function(thresholdMs)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/persistence/cleanup',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('persistence', 'cleanup failed: ' .. tostring(status))
            end
        end,
        'POST',
        json.encode({ thresholdMs = thresholdMs or 300000 }),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)
