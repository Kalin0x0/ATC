-- ATC Cross-Node Migration & Runtime Reconciliation Bridge
-- Phase 51

ATC.Reconciliation = {}

-- ── Runtime Migrations ───────────────────────────────────────────────────────

function ATC.Reconciliation.StartMigration(migrationNonce, entityId, fromServerId, toServerId, migrationData)
  return ATC.SDK.HTTP.Post('/api/v1/reconciliation/migrations/start', {
    migrationNonce = migrationNonce,
    entityId       = entityId,
    fromServerId   = fromServerId,
    toServerId     = toServerId,
    migrationData  = migrationData or {},
  })
end

function ATC.Reconciliation.CompleteMigration(migrationId)
  return ATC.SDK.HTTP.Post('/api/v1/reconciliation/migrations/' .. migrationId .. '/complete', {})
end

function ATC.Reconciliation.FailMigration(migrationId, reason)
  return ATC.SDK.HTTP.Post('/api/v1/reconciliation/migrations/' .. migrationId .. '/fail', {
    reason = reason,
  })
end

function ATC.Reconciliation.GetMigration(migrationId)
  return ATC.SDK.HTTP.Get('/api/v1/reconciliation/migrations/' .. migrationId)
end

-- ── Node Transfers ───────────────────────────────────────────────────────────

function ATC.Reconciliation.InitiateTransfer(entityId, fromServerId, toServerId, transferData)
  return ATC.SDK.HTTP.Post('/api/v1/reconciliation/transfers/initiate', {
    entityId     = entityId,
    fromServerId = fromServerId,
    toServerId   = toServerId,
    transferData = transferData or {},
  })
end

function ATC.Reconciliation.CompleteTransfer(transferId)
  return ATC.SDK.HTTP.Post('/api/v1/reconciliation/transfers/' .. transferId .. '/complete', {})
end

function ATC.Reconciliation.FailTransfer(transferId)
  return ATC.SDK.HTTP.Post('/api/v1/reconciliation/transfers/' .. transferId .. '/fail', {})
end

-- ── Reconciliation ───────────────────────────────────────────────────────────

function ATC.Reconciliation.Run(reconciliationType, regionId, serverId, reconciliationId)
  return ATC.SDK.HTTP.Post('/api/v1/reconciliation/run', {
    reconciliationType = reconciliationType,
    regionId           = regionId,
    serverId           = serverId,
    reconciliationId   = reconciliationId,
  })
end

-- ── Snapshot Replay ──────────────────────────────────────────────────────────

function ATC.Reconciliation.ReplayCheckpoint(entityId, snapshotId)
  return ATC.SDK.HTTP.Post('/api/v1/reconciliation/snapshots/replay', {
    entityId   = entityId,
    snapshotId = snapshotId,
  })
end

function ATC.Reconciliation.ListPendingReplays()
  return ATC.SDK.HTTP.Get('/api/v1/reconciliation/snapshots/pending')
end

-- ── Runtime Recovery ─────────────────────────────────────────────────────────

function ATC.Reconciliation.StartRecovery(entityId, recoveryType, targetServerId)
  return ATC.SDK.HTTP.Post('/api/v1/reconciliation/recovery/start', {
    entityId       = entityId,
    recoveryType   = recoveryType,
    targetServerId = targetServerId,
  })
end

-- ── Consistency Check ────────────────────────────────────────────────────────

function ATC.Reconciliation.CheckConsistency()
  return ATC.SDK.HTTP.Get('/api/v1/reconciliation/consistency/check')
end
