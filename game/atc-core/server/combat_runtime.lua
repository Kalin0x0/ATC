-- Phase 53: Advanced Combat, Ballistics & Tactical Simulation bridge
-- All writes are server-authoritative. Client events carry only session/entity IDs.

local RATE_LIMIT = 60  -- max requests per minute per source

-- Start combat simulation session (server-to-server internal trigger)
AddEventHandler('atc:combat:simulation:start', function(payload)
    if not payload or not payload.sessionId or not payload.entityId then return end

    local ok, err = ATC.SDK.HTTP.Post('/api/v1/combat/sessions/start', {
        sessionId     = payload.sessionId,
        combatType    = payload.combatType or 'pvp',
        entityId      = payload.entityId,
        targetId      = payload.targetId,
        ownerServerId = ATC.SDK.Server.GetId(),
        regionId      = payload.regionId,
        sessionNonce  = payload.sessionNonce,
        combatData    = payload.combatData or {},
    })

    if not ok then
        ATC.SDK.Log.Error('combat_runtime', 'Failed to start combat simulation', { err = err })
    end
end)

-- End combat simulation session
AddEventHandler('atc:combat:simulation:end', function(id)
    if not id or type(id) ~= 'string' then return end

    local ok, err = ATC.SDK.HTTP.Post('/api/v1/combat/sessions/' .. id .. '/end', {})
    if not ok then
        ATC.SDK.Log.Error('combat_runtime', 'Failed to end combat simulation', { id = id, err = err })
    end
end)

-- Record ballistic impact (client → server, rate-limited, no client data trusted)
RegisterServerEvent('atc:combat:ballistic:impact', true)
AddEventHandler('atc:combat:ballistic:impact', function(payload)
    local source = source
    if not ATC.SDK.RateLimit.Check(source, 'combat:ballistic', RATE_LIMIT) then return end
    if not payload or not payload.sessionId or not payload.ballisticType then return end

    ATC.SDK.HTTP.Post('/api/v1/combat/ballistics/record', {
        sessionId        = payload.sessionId,
        entityId         = tostring(source),
        ballisticType    = payload.ballisticType,
        trajectoryData   = {},
        impactData       = {},
        velocity         = nil,
        penetrationDepth = nil,
        ownerServerId    = ATC.SDK.Server.GetId(),
    })
end)

-- Apply suppression to an entity (server-side only)
AddEventHandler('atc:combat:suppression:apply', function(payload)
    if not payload or not payload.entityId or not payload.suppressionType then return end

    ATC.SDK.HTTP.Post('/api/v1/combat/suppression/apply', {
        entityId         = payload.entityId,
        suppressorId     = payload.suppressorId,
        suppressionType  = payload.suppressionType,
        suppressionLevel = payload.suppressionLevel or 50,
        ownerServerId    = ATC.SDK.Server.GetId(),
        regionId         = payload.regionId,
        expiresAt        = payload.expiresAt,
    })
end)

-- Clear suppression for an entity
AddEventHandler('atc:combat:suppression:clear', function(entityId)
    if not entityId or type(entityId) ~= 'string' then return end
    ATC.SDK.HTTP.Delete('/api/v1/combat/suppression/' .. entityId)
end)

-- Cleanup stale combat sessions (called by scheduler)
AddEventHandler('atc:combat:simulation:cleanup', function(thresholdMs)
    ATC.SDK.HTTP.Post('/api/v1/combat/cleanup', {
        thresholdMs = thresholdMs or 60000,
    })
end)

ATC.SDK.Log.Info('combat_runtime', 'Phase 53 combat simulation bridge loaded')
