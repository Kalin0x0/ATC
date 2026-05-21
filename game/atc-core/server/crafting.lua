-- ATC Phase 42: Crafting, Manufacturing & Production Runtime
-- Server-side SDK bridge — all calls go through the ATC API

ATC.Crafting = ATC.Crafting or {}

-- ── Register crafting recipe ───────────────────────────────────────────────────

function ATC.Crafting.RegisterRecipe(params, cb)
  ATC.SDK.Post('/api/v1/crafting/recipes', params, cb)
end

-- ── List active recipes ────────────────────────────────────────────────────────

function ATC.Crafting.ListRecipes(cb)
  ATC.SDK.Get('/api/v1/crafting/recipes', cb)
end

-- ── Acquire blueprint ──────────────────────────────────────────────────────────

function ATC.Crafting.AcquireBlueprint(principalId, recipeId, source, cb)
  ATC.SDK.Post('/api/v1/crafting/blueprints', {
    principalId = principalId,
    recipeId    = recipeId,
    source      = source or 'unknown',
  }, cb)
end

-- ── List blueprints for principal ──────────────────────────────────────────────

function ATC.Crafting.ListBlueprints(principalId, cb)
  ATC.SDK.Get('/api/v1/crafting/blueprints/' .. principalId, cb)
end

-- ── Register manufacturing station ────────────────────────────────────────────

function ATC.Crafting.RegisterStation(stationId, stationType, cb)
  ATC.SDK.Post('/api/v1/crafting/stations', {
    stationId   = stationId,
    stationType = stationType,
  }, cb)
end

-- ── Start production job ───────────────────────────────────────────────────────

function ATC.Crafting.StartJob(params, cb)
  ATC.SDK.Post('/api/v1/crafting/jobs', params, cb)
end

-- ── Get production job ─────────────────────────────────────────────────────────

function ATC.Crafting.GetJob(jobId, cb)
  ATC.SDK.Get('/api/v1/crafting/jobs/' .. jobId, cb)
end

-- ── Complete production job ────────────────────────────────────────────────────

function ATC.Crafting.CompleteJob(jobId, quantityProduced, cb)
  ATC.SDK.Post('/api/v1/crafting/jobs/' .. jobId .. '/complete', {
    jobId            = jobId,
    quantityProduced = quantityProduced,
  }, cb)
end

-- ── Fail production job ────────────────────────────────────────────────────────

function ATC.Crafting.FailJob(jobId, reason, cb)
  ATC.SDK.Post('/api/v1/crafting/jobs/' .. jobId .. '/fail', {
    jobId  = jobId,
    reason = reason or 'unknown failure',
  }, cb)
end

-- ── Cancel production job ──────────────────────────────────────────────────────

function ATC.Crafting.CancelJob(jobId, cancelledBy, cb)
  ATC.SDK.Post('/api/v1/crafting/jobs/' .. jobId .. '/cancel', {
    jobId       = jobId,
    cancelledBy = cancelledBy,
  }, cb)
end

-- ── List active jobs for station ───────────────────────────────────────────────

function ATC.Crafting.ListStationJobs(stationId, cb)
  ATC.SDK.Get('/api/v1/crafting/stations/' .. stationId .. '/jobs', cb)
end
