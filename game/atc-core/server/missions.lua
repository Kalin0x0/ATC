-- ATC Phase 47: Mission, Objective & Dynamic Scenario Runtime
-- Server-side SDK bridge — all calls go through the ATC API

ATC.Mission = ATC.Mission or {}

-- ── Missions ───────────────────────────────────────────────────────────────────

function ATC.Mission.Create(params, cb)
  ATC.SDK.Post('/api/v1/missions', params, cb)
end

function ATC.Mission.ListActive(cb)
  ATC.SDK.Get('/api/v1/missions', cb)
end

function ATC.Mission.Start(missionId, cb)
  ATC.SDK.Post('/api/v1/missions/' .. missionId .. '/start', {}, cb)
end

function ATC.Mission.Complete(missionId, cb)
  ATC.SDK.Post('/api/v1/missions/' .. missionId .. '/complete', {}, cb)
end

function ATC.Mission.Fail(missionId, cb)
  ATC.SDK.Post('/api/v1/missions/' .. missionId .. '/fail', {}, cb)
end

-- ── Objectives ─────────────────────────────────────────────────────────────────

function ATC.Mission.CreateObjective(params, cb)
  ATC.SDK.Post('/api/v1/missions/objectives', params, cb)
end

function ATC.Mission.CompleteObjective(objectiveId, cb)
  ATC.SDK.Post('/api/v1/missions/objectives/' .. objectiveId .. '/complete', {}, cb)
end

-- ── Progression ────────────────────────────────────────────────────────────────

function ATC.Mission.Progress(missionId, objectiveId, cb)
  ATC.SDK.Post('/api/v1/missions/progress', {
    missionId  = missionId,
    objectiveId = objectiveId,
  }, cb)
end

-- ── Assignments ────────────────────────────────────────────────────────────────

function ATC.Mission.Assign(params, cb)
  ATC.SDK.Post('/api/v1/missions/assignments', params, cb)
end

function ATC.Mission.ReleaseAssignment(missionId, assigneeId, cb)
  ATC.SDK.Post('/api/v1/missions/assignments/release', {
    missionId  = missionId,
    assigneeId = assigneeId,
  }, cb)
end

-- ── Scenarios ──────────────────────────────────────────────────────────────────

function ATC.Mission.RegisterScenario(params, cb)
  ATC.SDK.Post('/api/v1/missions/scenarios', params, cb)
end

-- ── Dynamic Events ─────────────────────────────────────────────────────────────

function ATC.Mission.CreateEvent(params, cb)
  ATC.SDK.Post('/api/v1/missions/events', params, cb)
end

function ATC.Mission.ListActiveEvents(cb)
  ATC.SDK.Get('/api/v1/missions/events', cb)
end

function ATC.Mission.ResolveEvent(eventId, cb)
  ATC.SDK.Post('/api/v1/missions/events/' .. eventId .. '/resolve', {}, cb)
end
