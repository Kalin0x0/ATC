-- =============================================================================
-- ATC Narrative World — Phase 97
-- Story arcs, persistent consequences, and faction-driven narrative events.
-- =============================================================================

ATC                = ATC                or {}
ATC.NarrativeWorld = ATC.NarrativeWorld or {}

-- ---------------------------------------------------------------------------
-- In-memory arc registry
-- Key: arcId (string), Value: arc descriptor table
-- ---------------------------------------------------------------------------
local _activeArcs = {}

-- Set once the advance warning has been emitted, so a long-running arc does not
-- repeat the same line on every phase change.
local _warnedAdvance = false

-- ---------------------------------------------------------------------------
-- Notify every online member of a faction about an arc.
-- Pure server-side fan-out; kept out of any request callback so that whether
-- players are told does not depend on a call to the API succeeding.
-- ---------------------------------------------------------------------------
local function _notifyFaction(factionId, arc)
    for _, pid in ipairs(GetPlayers()) do
        local src     = tonumber(pid)
        local session = ATC.Sessions and ATC.Sessions.Get(src)
        if session and session.factionId == factionId then
            TriggerClientEvent('atc:narrative:arc:start', src, arc or {})
        end
    end
end

-- ---------------------------------------------------------------------------
-- ATC.NarrativeWorld.TriggerArc
-- Begins a new story arc for a faction.
-- No-op if arc is already running.
-- ---------------------------------------------------------------------------
function ATC.NarrativeWorld.TriggerArc(arcId, factionId, params)
    if _activeArcs[arcId] then
        ATC.Log.Debug('narrative_world', 'Arc already active, skip', { arcId = arcId })
        return
    end

    _activeArcs[arcId] = {
        arcId     = arcId,
        factionId = factionId,
        params    = params or {},
        startTime = os.time(),
        phase     = 1,
    }

    ATC.Log.Info('narrative_world', 'Arc triggered', {
        arcId     = arcId,
        factionId = factionId,
    })

    -- Notify faction members from the local registry, not from the API reply.
    -- This used to sit inside the request callback, so a failed call meant no
    -- member was ever told an arc had started — even though the arc is already
    -- live in _activeArcs by this point and the fan-out needs no API.
    _notifyFaction(factionId, _activeArcs[arcId])

    -- The API has no arcs endpoint; an arc is persisted as a faction campaign,
    -- which is what the campaignType enum's 'faction' value is for. factionId
    -- has no dedicated field, so it travels in campaignData alongside the
    -- caller's params.
    ATC.HTTP.Post('/api/v1/narrative/campaigns/start', {
        campaignId    = arcId,
        campaignType  = 'faction',
        ownerServerId = (ATC.SDK and ATC.SDK.Server and ATC.SDK.Server.GetId()) or ATC.Config.ServerId,
        campaignNonce = (ATC.SDK and ATC.SDK.Id and ATC.SDK.Id.Generate('arc')) or arcId,
        campaignData  = {
            factionId = factionId,
            params    = params or {},
        },
    }, function(ok, status, _data, err)
        if not ok then
            ATC.Log.Warn('narrative_world', 'Arc not persisted as campaign', {
                arcId = arcId, status = status, err = err,
            })
        end
    end)
end

-- ---------------------------------------------------------------------------
-- ATC.NarrativeWorld.AdvanceArc
-- Increments the phase counter and persists via API.
-- ---------------------------------------------------------------------------
function ATC.NarrativeWorld.AdvanceArc(arcId)
    local arc = _activeArcs[arcId]
    if not arc then
        ATC.Log.Warn('narrative_world', 'AdvanceArc: arc not found', { arcId = arcId })
        return
    end

    arc.phase = arc.phase + 1
    ATC.Log.Info('narrative_world', 'Arc advanced', { arcId = arcId, phase = arc.phase })

    -- The phase change is local only. Nothing the API serves can record it:
    -- campaigns support complete and fail but not advance, and
    -- POST /api/v1/narrative/progression/advance needs the id of a progression
    -- record, which no route can create — storyProgressionService.startProgression
    -- exists but is not exposed. The request that used to be here posted to
    -- /api/v1/narrative/arcs/{id}/advance, which does not exist.
    -- Warned once per boot; the arc itself keeps advancing in memory.
    if not _warnedAdvance then
        _warnedAdvance = true
        ATC.Log.Warn('narrative_world', 'Arc phases are not persisted: the API has no campaign-advance route, and story progressions cannot be created through it. Phase changes are kept in memory and lost on restart.')
    end
end

-- ---------------------------------------------------------------------------
-- ATC.NarrativeWorld.EndArc
-- Removes arc from the active registry. Does not fire API — caller may do so.
-- ---------------------------------------------------------------------------
function ATC.NarrativeWorld.EndArc(arcId)
    if not _activeArcs[arcId] then return end
    _activeArcs[arcId] = nil
    ATC.Log.Info('narrative_world', 'Arc ended', { arcId = arcId })
end

-- ---------------------------------------------------------------------------
-- ATC.NarrativeWorld.GetActiveArcs — read-only snapshot for diagnostics
-- ---------------------------------------------------------------------------
function ATC.NarrativeWorld.GetActiveArcs()
    local snapshot = {}
    for id, arc in pairs(_activeArcs) do
        snapshot[id] = {
            arcId     = arc.arcId,
            factionId = arc.factionId,
            phase     = arc.phase,
            startTime = arc.startTime,
        }
    end
    return snapshot
end

-- ---------------------------------------------------------------------------
-- Server event: push a narrative consequence to a specific principal's client.
-- Callers emit 'atc:narrative:consequence' server-side with (principalId, data).
-- ---------------------------------------------------------------------------
AddEventHandler('atc:narrative:consequence', function(principalId, consequence)
    if not principalId or not consequence then return end

    for _, pid in ipairs(GetPlayers()) do
        local src = tonumber(pid)
        if ATC.Accounts and ATC.Accounts.GetPrincipalId(src) == principalId then
            TriggerClientEvent('atc:narrative:consequence', src, consequence)
            ATC.Log.Debug('narrative_world', 'Consequence delivered', {
                principalId = principalId,
                type        = consequence.type or 'unknown',
            })
        end
    end
end)

-- ---------------------------------------------------------------------------
-- Expose arc count to observability
-- ---------------------------------------------------------------------------
CreateThread(function()
    while true do
        Wait(300000) -- every 5 minutes
        local count = 0
        for _ in pairs(_activeArcs) do count = count + 1 end
        ATC.Log.Debug('narrative_world', 'Active arc count', { count = count })
    end
end)
