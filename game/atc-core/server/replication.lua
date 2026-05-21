-- ATC Replication, Streaming & Spatial Ownership Runtime Bridge
-- Phase 50

ATC.Replication = {}

-- ── Spatial Nodes ────────────────────────────────────────────────────────────

function ATC.Replication.UpsertNode(nodeId, nodeType, ownerServerId, regionId, positionData)
  return ATC.SDK.HTTP.Post('/api/v1/replication/nodes/upsert', {
    nodeId        = nodeId,
    nodeType      = nodeType,
    ownerServerId = ownerServerId,
    regionId      = regionId,
    positionData  = positionData or {},
  })
end

function ATC.Replication.ListActiveNodes()
  return ATC.SDK.HTTP.Get('/api/v1/replication/nodes/active')
end

function ATC.Replication.CleanupStaleNodes(thresholdMs)
  return ATC.SDK.HTTP.Post('/api/v1/replication/nodes/cleanup', {
    thresholdMs = thresholdMs or 60000,
  })
end

-- ── Spatial Ownership ────────────────────────────────────────────────────────

function ATC.Replication.ClaimOwnership(entityId, entityType, ownerServerId, regionId)
  return ATC.SDK.HTTP.Post('/api/v1/replication/ownership/claim', {
    entityId      = entityId,
    entityType    = entityType,
    ownerServerId = ownerServerId,
    regionId      = regionId,
  })
end

function ATC.Replication.TransferOwnership(entityId, fromServerId, toServerId)
  return ATC.SDK.HTTP.Post('/api/v1/replication/ownership/transfer', {
    entityId     = entityId,
    fromServerId = fromServerId,
    toServerId   = toServerId,
  })
end

function ATC.Replication.GetOwnership(entityId)
  return ATC.SDK.HTTP.Get('/api/v1/replication/ownership/' .. entityId)
end

function ATC.Replication.ReleaseOwnership(entityId)
  return ATC.SDK.HTTP.Delete('/api/v1/replication/ownership/' .. entityId)
end

function ATC.Replication.CleanupStaleOwnership(thresholdMs)
  return ATC.SDK.HTTP.Post('/api/v1/replication/ownership/cleanup', {
    thresholdMs = thresholdMs or 60000,
  })
end

-- ── Streaming Runtime ────────────────────────────────────────────────────────

function ATC.Replication.UpdateStreamingState(entityId, streamingState, ownerServerId)
  return ATC.SDK.HTTP.Post('/api/v1/replication/streaming/upsert', {
    entityId       = entityId,
    streamingState = streamingState,
    ownerServerId  = ownerServerId,
  })
end

function ATC.Replication.GetStreamingState(entityId)
  return ATC.SDK.HTTP.Get('/api/v1/replication/streaming/' .. entityId)
end

function ATC.Replication.CleanupStaleStreaming(thresholdMs)
  return ATC.SDK.HTTP.Post('/api/v1/replication/streaming/cleanup', {
    thresholdMs = thresholdMs or 60000,
  })
end

-- ── Runtime Snapshots ────────────────────────────────────────────────────────

function ATC.Replication.CreateSnapshot(entityId, snapshotType, ownerServerId, snapshotData, sequenceNumber)
  return ATC.SDK.HTTP.Post('/api/v1/replication/snapshots/create', {
    entityId       = entityId,
    snapshotType   = snapshotType,
    ownerServerId  = ownerServerId,
    snapshotData   = snapshotData or {},
    sequenceNumber = sequenceNumber or 0,
  })
end

function ATC.Replication.ReplaySnapshot(snapshotId)
  return ATC.SDK.HTTP.Post('/api/v1/replication/snapshots/' .. snapshotId .. '/replay', {})
end

function ATC.Replication.ListSnapshotsByEntity(entityId)
  return ATC.SDK.HTTP.Get('/api/v1/replication/snapshots/entity/' .. entityId)
end

-- ── Interest Regions ─────────────────────────────────────────────────────────

function ATC.Replication.UpsertInterestRegion(regionId, regionType, ownerServerId, boundsData)
  return ATC.SDK.HTTP.Post('/api/v1/replication/interest-regions/upsert', {
    regionId      = regionId,
    regionType    = regionType,
    ownerServerId = ownerServerId,
    boundsData    = boundsData or {},
  })
end

function ATC.Replication.ListInterestRegions()
  return ATC.SDK.HTTP.Get('/api/v1/replication/interest-regions/active')
end

function ATC.Replication.DeactivateInterestRegion(regionId)
  return ATC.SDK.HTTP.Delete('/api/v1/replication/interest-regions/' .. regionId)
end
