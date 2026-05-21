-- Phase 54: Persistent Narrative, Campaign & World Event Runtime bridge
-- Campaign/narrative state is server-authoritative. Clients receive events only.

-- Start a campaign (server-side trigger, e.g. from mission start)
AddEventHandler('atc:narrative:campaign:start', function(payload)
    if not payload or not payload.campaignId or not payload.campaignType then return end

    local ok, err = ATC.SDK.HTTP.Post('/api/v1/narrative/campaigns/start', {
        campaignId    = payload.campaignId,
        campaignType  = payload.campaignType,
        ownerServerId = ATC.SDK.Server.GetId(),
        regionId      = payload.regionId,
        campaignNonce = payload.campaignNonce,
        campaignData  = payload.campaignData or {},
    })

    if not ok then
        ATC.SDK.Log.Error('narrative', 'Failed to start campaign', { err = err })
    end
end)

-- Complete a campaign
AddEventHandler('atc:narrative:campaign:complete', function(id)
    if not id or type(id) ~= 'string' then return end
    ATC.SDK.HTTP.Post('/api/v1/narrative/campaigns/' .. id .. '/complete', {})
end)

-- Fail a campaign
AddEventHandler('atc:narrative:campaign:fail', function(id)
    if not id or type(id) ~= 'string' then return end
    ATC.SDK.HTTP.Post('/api/v1/narrative/campaigns/' .. id .. '/fail', {})
end)

-- Trigger a world event
AddEventHandler('atc:narrative:world_event:trigger', function(payload)
    if not payload or not payload.eventId or not payload.eventType then return end

    ATC.SDK.HTTP.Post('/api/v1/narrative/world-events/trigger', {
        eventId          = payload.eventId,
        eventType        = payload.eventType,
        ownerServerId    = ATC.SDK.Server.GetId(),
        regionId         = payload.regionId,
        triggerCondition = payload.triggerCondition,
        eventData        = payload.eventData or {},
        expiresAt        = payload.expiresAt,
    })
end)

-- Complete a world event
AddEventHandler('atc:narrative:world_event:complete', function(id)
    if not id or type(id) ~= 'string' then return end
    ATC.SDK.HTTP.Post('/api/v1/narrative/world-events/' .. id .. '/complete', {})
end)

-- Start a narrative session (cutscene, dialogue, mission)
AddEventHandler('atc:narrative:session:start', function(payload)
    if not payload or not payload.sessionId or not payload.entityId or not payload.narrativeType then return end

    ATC.SDK.HTTP.Post('/api/v1/narrative/sessions/start', {
        sessionId     = payload.sessionId,
        entityId      = payload.entityId,
        campaignId    = payload.campaignId,
        narrativeType = payload.narrativeType,
        ownerServerId = ATC.SDK.Server.GetId(),
        narrativeData = payload.narrativeData or {},
    })
end)

-- Complete a narrative session
AddEventHandler('atc:narrative:session:complete', function(id)
    if not id or type(id) ~= 'string' then return end
    ATC.SDK.HTTP.Post('/api/v1/narrative/sessions/' .. id .. '/complete', {})
end)

-- Skip a narrative session
AddEventHandler('atc:narrative:session:skip', function(id)
    if not id or type(id) ~= 'string' then return end
    ATC.SDK.HTTP.Post('/api/v1/narrative/sessions/' .. id .. '/skip', {})
end)

-- Set a dynamic story state (branch choice, flag, variable)
AddEventHandler('atc:narrative:story_state:set', function(payload)
    if not payload or not payload.entityId or not payload.branchKey or not payload.stateType then return end

    ATC.SDK.HTTP.Post('/api/v1/narrative/story-state/set', {
        entityId      = payload.entityId,
        branchKey     = payload.branchKey,
        stateType     = payload.stateType,
        storyData     = payload.storyData or {},
        ownerServerId = ATC.SDK.Server.GetId(),
    })
end)

-- Cleanup stale narrative sessions (called by scheduler)
AddEventHandler('atc:narrative:cleanup', function(thresholdMs)
    ATC.SDK.HTTP.Post('/api/v1/narrative/cleanup', {
        thresholdMs = thresholdMs or 60000,
    })
end)

ATC.SDK.Log.Info('narrative', 'Phase 54 narrative runtime bridge loaded')
