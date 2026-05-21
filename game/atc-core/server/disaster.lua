-- ATC Phase 46: Disaster, Crisis & Emergency Management Runtime
-- Server-side SDK bridge — all calls go through the ATC API

ATC.Disaster = ATC.Disaster or {}

-- ── Disaster Events ────────────────────────────────────────────────────────────

function ATC.Disaster.DeclareDisaster(params, cb)
  ATC.SDK.Post('/api/v1/disaster/events', params, cb)
end

function ATC.Disaster.ListActiveDisasters(cb)
  ATC.SDK.Get('/api/v1/disaster/events', cb)
end

function ATC.Disaster.EscalateDisaster(disasterId, cb)
  ATC.SDK.Post('/api/v1/disaster/events/' .. disasterId .. '/escalate', {}, cb)
end

function ATC.Disaster.ContainDisaster(disasterId, cb)
  ATC.SDK.Post('/api/v1/disaster/events/' .. disasterId .. '/contain', {}, cb)
end

function ATC.Disaster.ResolveDisaster(disasterId, cb)
  ATC.SDK.Post('/api/v1/disaster/events/' .. disasterId .. '/resolve', {}, cb)
end

-- ── Hazard Zones ───────────────────────────────────────────────────────────────

function ATC.Disaster.PropagateHazard(params, cb)
  ATC.SDK.Post('/api/v1/disaster/hazards', params, cb)
end

function ATC.Disaster.ListActiveHazards(cb)
  ATC.SDK.Get('/api/v1/disaster/hazards', cb)
end

function ATC.Disaster.ClearHazardZone(zoneId, cb)
  ATC.SDK.Post('/api/v1/disaster/hazards/' .. zoneId .. '/clear', {}, cb)
end

-- ── Evacuations ────────────────────────────────────────────────────────────────

function ATC.Disaster.InitiateEvacuation(params, cb)
  ATC.SDK.Post('/api/v1/disaster/evacuations', params, cb)
end

function ATC.Disaster.UpdateEvacuationProgress(evacuationId, evacuatedCount, cb)
  ATC.SDK.Post('/api/v1/disaster/evacuations/' .. evacuationId .. '/progress', {
    evacuatedCount = evacuatedCount,
  }, cb)
end

function ATC.Disaster.CompleteEvacuation(evacuationId, cb)
  ATC.SDK.Post('/api/v1/disaster/evacuations/' .. evacuationId .. '/complete', {}, cb)
end

function ATC.Disaster.CancelEvacuation(evacuationId, cb)
  ATC.SDK.Post('/api/v1/disaster/evacuations/' .. evacuationId .. '/cancel', {}, cb)
end

-- ── Emergency Response ─────────────────────────────────────────────────────────

function ATC.Disaster.DispatchResponse(params, cb)
  ATC.SDK.Post('/api/v1/disaster/responses', params, cb)
end

function ATC.Disaster.ArriveOnScene(responseId, cb)
  ATC.SDK.Post('/api/v1/disaster/responses/' .. responseId .. '/arrive', {}, cb)
end

function ATC.Disaster.CompleteResponse(responseId, cb)
  ATC.SDK.Post('/api/v1/disaster/responses/' .. responseId .. '/complete', {}, cb)
end

function ATC.Disaster.WithdrawResponse(responseId, cb)
  ATC.SDK.Post('/api/v1/disaster/responses/' .. responseId .. '/withdraw', {}, cb)
end

-- ── Recovery ───────────────────────────────────────────────────────────────────

function ATC.Disaster.StartRecovery(params, cb)
  ATC.SDK.Post('/api/v1/disaster/recovery', params, cb)
end

function ATC.Disaster.UpdateRecoveryProgress(disasterId, progressPercent, cb)
  ATC.SDK.Post('/api/v1/disaster/recovery/' .. disasterId .. '/progress', {
    progressPercent = progressPercent,
  }, cb)
end
