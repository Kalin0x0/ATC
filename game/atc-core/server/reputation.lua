-- ATC Phase 48: Reputation, Diplomacy & Social Influence Runtime
-- Server-side SDK bridge — all calls go through the ATC API

ATC.Reputation = ATC.Reputation or {}

-- ── Reputation ─────────────────────────────────────────────────────────────────

function ATC.Reputation.Adjust(principalId, factionId, delta, reason, actorId, cb)
  ATC.SDK.Post('/api/v1/reputation/adjust', {
    principalId = principalId,
    factionId   = factionId,
    delta       = delta,
    reason      = reason,
    actorId     = actorId,
  }, cb)
end

function ATC.Reputation.Upsert(principalId, factionId, reputationScore, tier, cb)
  ATC.SDK.Post('/api/v1/reputation/upsert', {
    principalId     = principalId,
    factionId       = factionId,
    reputationScore = reputationScore,
    tier            = tier,
  }, cb)
end

function ATC.Reputation.Get(principalId, factionId, cb)
  ATC.SDK.Get('/api/v1/reputation/' .. principalId .. '/' .. factionId, cb)
end

-- ── Diplomacy ──────────────────────────────────────────────────────────────────

function ATC.Reputation.SetDiplomacy(factionAId, factionBId, status, relationScore, cb)
  ATC.SDK.Post('/api/v1/reputation/diplomacy', {
    factionAId    = factionAId,
    factionBId    = factionBId,
    status        = status,
    relationScore = relationScore,
  }, cb)
end

function ATC.Reputation.GetDiplomacy(factionAId, factionBId, cb)
  ATC.SDK.Get('/api/v1/reputation/diplomacy/' .. factionAId .. '/' .. factionBId, cb)
end

-- ── Social Standing ────────────────────────────────────────────────────────────

function ATC.Reputation.AdjustStanding(principalId, delta, reason, cb)
  ATC.SDK.Post('/api/v1/reputation/standing/adjust', {
    principalId = principalId,
    delta       = delta,
    reason      = reason,
  }, cb)
end

function ATC.Reputation.UpsertStanding(principalId, standingScore, tier, cb)
  ATC.SDK.Post('/api/v1/reputation/standing/upsert', {
    principalId   = principalId,
    standingScore = standingScore,
    tier          = tier,
  }, cb)
end

function ATC.Reputation.GetStanding(principalId, cb)
  ATC.SDK.Get('/api/v1/reputation/standing/' .. principalId, cb)
end

-- ── Decay ──────────────────────────────────────────────────────────────────────

function ATC.Reputation.ScheduleDecay(params, cb)
  ATC.SDK.Post('/api/v1/reputation/decay/schedule', params, cb)
end

function ATC.Reputation.ApplyDecay(cb)
  ATC.SDK.Post('/api/v1/reputation/decay/apply', {}, cb)
end

-- ── Influence History ──────────────────────────────────────────────────────────

function ATC.Reputation.RecordInfluence(params, cb)
  ATC.SDK.Post('/api/v1/reputation/influence', params, cb)
end

function ATC.Reputation.GetInfluenceHistory(principalId, cb)
  ATC.SDK.Get('/api/v1/reputation/influence/' .. principalId, cb)
end
