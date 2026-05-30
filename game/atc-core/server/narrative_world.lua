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

    ATC.HTTP.Post('/api/v1/narrative/arcs', {
        arcId     = arcId,
        factionId = factionId,
        params    = params or {},
    }, function(ok, _, data)
        if not ok then
            ATC.Log.Warn('narrative_world', 'API arc registration failed', { arcId = arcId })
            return
        end

        ATC.Log.Info('narrative_world', 'Arc triggered', {
            arcId     = arcId,
            factionId = factionId,
        })

        -- Notify all online members of the relevant faction
        for _, pid in ipairs(GetPlayers()) do
            local src     = tonumber(pid)
            local session = ATC.Sessions and ATC.Sessions.Get(src)
            if session and session.factionId == factionId then
                TriggerClientEvent('atc:narrative:arc:start', src, data or {})
            end
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

    ATC.HTTP.Post('/api/v1/narrative/arcs/' .. arcId .. '/advance', {
        phase = arc.phase,
    }, function(ok, _, _data)
        if ok then
            ATC.Log.Info('narrative_world', 'Arc advanced', { arcId = arcId, phase = arc.phase })
        end
    end)
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
