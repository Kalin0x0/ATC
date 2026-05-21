-- ATC Massive Persistent World Orchestration Bridge
-- Phase 52

ATC.WorldOrchestrator = {}

-- ── World Regions ────────────────────────────────────────────────────────────

function ATC.WorldOrchestrator.UpsertRegion(regionId, regionType, ownerServerId, boundsData, capacityLimit)
  return ATC.SDK.HTTP.Post('/api/v1/orchestrator/regions/upsert', {
    regionId      = regionId,
    regionType    = regionType,
    ownerServerId = ownerServerId,
    boundsData    = boundsData or {},
    capacityLimit = capacityLimit,
  })
end

function ATC.WorldOrchestrator.ListActiveRegions()
  return ATC.SDK.HTTP.Get('/api/v1/orchestrator/regions/active')
end

function ATC.WorldOrchestrator.TransferRegion(regionId, fromServerId, toServerId)
  return ATC.SDK.HTTP.Post('/api/v1/orchestrator/regions/transfer', {
    regionId     = regionId,
    fromServerId = fromServerId,
    toServerId   = toServerId,
  })
end

function ATC.WorldOrchestrator.DeactivateRegion(regionId)
  return ATC.SDK.HTTP.Delete('/api/v1/orchestrator/regions/' .. regionId)
end

function ATC.WorldOrchestrator.RecoverRegion(regionId)
  return ATC.SDK.HTTP.Post('/api/v1/orchestrator/regions/recover', {
    regionId = regionId,
  })
end

-- ── Shards ───────────────────────────────────────────────────────────────────

function ATC.WorldOrchestrator.AllocateShard(shardId, shardType, ownerServerId, regionId, capacityLimit)
  return ATC.SDK.HTTP.Post('/api/v1/orchestrator/shards/allocate', {
    shardId       = shardId,
    shardType     = shardType,
    ownerServerId = ownerServerId,
    regionId      = regionId,
    capacityLimit = capacityLimit,
  })
end

function ATC.WorldOrchestrator.ListActiveShards()
  return ATC.SDK.HTTP.Get('/api/v1/orchestrator/shards/active')
end

function ATC.WorldOrchestrator.TransferShard(shardId, fromServerId, toServerId)
  return ATC.SDK.HTTP.Post('/api/v1/orchestrator/shards/transfer', {
    shardId      = shardId,
    fromServerId = fromServerId,
    toServerId   = toServerId,
  })
end

function ATC.WorldOrchestrator.CleanupStaleShards(thresholdMs)
  return ATC.SDK.HTTP.Post('/api/v1/orchestrator/shards/cleanup', {
    thresholdMs = thresholdMs or 60000,
  })
end

-- ── Regional Simulations ─────────────────────────────────────────────────────

function ATC.WorldOrchestrator.UpsertSimulation(regionId, simulationType, ownerServerId, simulationData)
  return ATC.SDK.HTTP.Post('/api/v1/orchestrator/simulations/upsert', {
    regionId       = regionId,
    simulationType = simulationType,
    ownerServerId  = ownerServerId,
    simulationData = simulationData or {},
  })
end

function ATC.WorldOrchestrator.ListActiveSimulations()
  return ATC.SDK.HTTP.Get('/api/v1/orchestrator/simulations/active')
end

function ATC.WorldOrchestrator.StopSimulation(regionId)
  return ATC.SDK.HTTP.Delete('/api/v1/orchestrator/simulations/' .. regionId)
end

-- ── Rebalancing ──────────────────────────────────────────────────────────────

function ATC.WorldOrchestrator.Rebalance(regionId, thresholdPercent)
  return ATC.SDK.HTTP.Post('/api/v1/orchestrator/rebalance', {
    regionId         = regionId,
    thresholdPercent = thresholdPercent or 80,
  })
end

-- ── World Recovery ───────────────────────────────────────────────────────────

function ATC.WorldOrchestrator.Recover(shardId, regionId)
  return ATC.SDK.HTTP.Post('/api/v1/orchestrator/recovery', {
    shardId  = shardId,
    regionId = regionId,
  })
end
