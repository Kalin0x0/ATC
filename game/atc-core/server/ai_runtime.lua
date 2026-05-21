-- ATC Phase 49: Advanced AI Tactical & Autonomous Response Runtime
-- Server-side SDK bridge — all calls go through the ATC API

ATC.AI = ATC.AI or {}

-- ── AI Entities ────────────────────────────────────────────────────────────────

function ATC.AI.RegisterEntity(params, cb)
  ATC.SDK.Post('/api/v1/ai/entities', params, cb)
end

function ATC.AI.ListActiveEntities(cb)
  ATC.SDK.Get('/api/v1/ai/entities', cb)
end

function ATC.AI.UpdateEntityState(entityId, aiState, cb)
  ATC.SDK.Post('/api/v1/ai/entities/state', {
    entityId = entityId,
    aiState  = aiState,
  }, cb)
end

function ATC.AI.RecoverEntity(entityId, cb)
  ATC.SDK.Post('/api/v1/ai/entities/recover', {
    entityId = entityId,
  }, cb)
end

function ATC.AI.Cleanup(thresholdMs, cb)
  ATC.SDK.Post('/api/v1/ai/cleanup', {
    thresholdMs = thresholdMs,
  }, cb)
end

-- ── Patrols ────────────────────────────────────────────────────────────────────

function ATC.AI.StartPatrol(params, cb)
  ATC.SDK.Post('/api/v1/ai/patrols', params, cb)
end

function ATC.AI.ListActivePatrols(cb)
  ATC.SDK.Get('/api/v1/ai/patrols', cb)
end

function ATC.AI.CompletePatrol(patrolId, cb)
  ATC.SDK.Post('/api/v1/ai/patrols/' .. patrolId .. '/complete', {}, cb)
end

-- ── Threat Assessment ──────────────────────────────────────────────────────────

function ATC.AI.AssessThreat(params, cb)
  ATC.SDK.Post('/api/v1/ai/threats', params, cb)
end

function ATC.AI.ListActiveThreats(cb)
  ATC.SDK.Get('/api/v1/ai/threats', cb)
end

-- ── Reinforcements ─────────────────────────────────────────────────────────────

function ATC.AI.RequestReinforcement(params, cb)
  ATC.SDK.Post('/api/v1/ai/reinforcements', params, cb)
end

function ATC.AI.ListActiveReinforcements(cb)
  ATC.SDK.Get('/api/v1/ai/reinforcements', cb)
end

function ATC.AI.UpdateReinforcementStatus(reinforcementId, status, cb)
  ATC.SDK.Post('/api/v1/ai/reinforcements/' .. reinforcementId .. '/status', {
    status = status,
  }, cb)
end

-- ── Tactical Responses ─────────────────────────────────────────────────────────

function ATC.AI.ActivateResponse(params, cb)
  ATC.SDK.Post('/api/v1/ai/responses', params, cb)
end

function ATC.AI.ListResponsesByEntity(entityId, cb)
  ATC.SDK.Get('/api/v1/ai/responses/' .. entityId, cb)
end
