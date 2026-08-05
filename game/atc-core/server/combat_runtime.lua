-- Phase 53: Advanced Combat, Ballistics & Tactical Simulation bridge
-- All writes are server-authoritative. Client events carry only session/entity IDs.
--
-- Endpoints live under /api/v1/combat-simulation/, served by combatSimulationService.
-- The neighbouring /api/v1/combat/ namespace is a DIFFERENT subsystem — weapons,
-- injuries and combatRuntimeService — so posting there reaches the wrong service.
-- This bridge used to call /api/v1/combat/: five of its six calls 404'd, and the
-- sixth silently resolved to the other subsystem's session handler.

local RATE_LIMIT = 60  -- max requests per minute per source
local API        = '/api/v1/combat-simulation'

-- Start combat simulation session (server-to-server internal trigger)
AddEventHandler('atc:combat:simulation:start', function(payload)
    if not payload or not payload.sessionId or not payload.entityId then return end

    -- sessionNonce is required by startCombatSimulationSchema. Callers do not
    -- reliably supply one, and a missing nonce fails validation before the
    -- request reaches the service — so mint one here when it is absent.
    local nonce = payload.sessionNonce
    if type(nonce) ~= 'string' or nonce == '' then
        nonce = ATC.SDK.Id.Generate('combat')
    end

    local ok, err = ATC.SDK.HTTP.Post(API .. '/sessions/start', {
        sessionId     = payload.sessionId,
        combatType    = payload.combatType or 'pvp',
        entityId      = payload.entityId,
        targetId      = payload.targetId,
        ownerServerId = ATC.SDK.Server.GetId(),
        regionId      = payload.regionId,
        sessionNonce  = nonce,
        -- Optional in the schema. Passed through only when the caller set it;
        -- an empty Lua table would serialise ambiguously.
        combatData    = payload.combatData,
    })

    if not ok then
        ATC.SDK.Log.Error('combat_runtime', 'Failed to start combat simulation', { err = err })
    end
end)

-- End combat simulation session
-- reason is optional and forwarded when given; a value is always sent so the
-- request body is a non-empty JSON object, which the schema requires.
AddEventHandler('atc:combat:simulation:end', function(id, reason)
    if not id or type(id) ~= 'string' then return end

    local why = (type(reason) == 'string' and reason ~= '' and reason) or 'session_ended'
    if #why > 256 then why = why:sub(1, 256) end

    local ok, err = ATC.SDK.HTTP.Post(API .. '/sessions/' .. id .. '/end', { reason = why })
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

    -- trajectoryData, impactData, velocity and penetrationDepth are deliberately
    -- not forwarded: they are optional in the schema, and taking them from the
    -- client would be trusting client-reported ballistics. The server records
    -- only the identifiers, and the API validates ballisticType against its enum.
    ATC.SDK.HTTP.Post(API .. '/ballistics/record', {
        sessionId     = payload.sessionId,
        entityId      = tostring(source),
        ballisticType = payload.ballisticType,
        ownerServerId = ATC.SDK.Server.GetId(),
    })
end)

-- Apply suppression to an entity (server-side only)
AddEventHandler('atc:combat:suppression:apply', function(payload)
    if not payload or not payload.entityId or not payload.suppressionType then return end

    ATC.SDK.HTTP.Post(API .. '/suppression/apply', {
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
    ATC.SDK.HTTP.Delete(API .. '/suppression/' .. entityId)
end)

-- Cleanup stale combat sessions (called by scheduler)
-- cleanupCombatSchema enforces an integer of at least 1000, so a smaller or
-- non-numeric threshold is raised to the schema's own default rather than
-- being sent and rejected.
AddEventHandler('atc:combat:simulation:cleanup', function(thresholdMs)
    local threshold = math.floor(tonumber(thresholdMs) or 60000)
    if threshold < 1000 then threshold = 60000 end

    ATC.SDK.HTTP.Post(API .. '/cleanup', { thresholdMs = threshold })
end)

ATC.SDK.Log.Info('combat_runtime', 'Phase 53 combat simulation bridge loaded')
