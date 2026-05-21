-- ATC Phase 45: Communication, Radio & Signal Runtime
-- Server-side SDK bridge — all calls go through the ATC API

ATC.Comms = ATC.Comms or {}

-- ── Radio Channels ─────────────────────────────────────────────────────────────

function ATC.Comms.CreateChannel(params, cb)
  ATC.SDK.Post('/api/v1/comms/channels', params, cb)
end

function ATC.Comms.ListChannels(cb)
  ATC.SDK.Get('/api/v1/comms/channels', cb)
end

function ATC.Comms.JoinChannel(channelId, principalId, role, cb)
  ATC.SDK.Post('/api/v1/comms/channels/' .. channelId .. '/join', {
    principalId = principalId,
    role = role or 'listener',
  }, cb)
end

function ATC.Comms.LeaveChannel(channelId, principalId, cb)
  ATC.SDK.Post('/api/v1/comms/channels/' .. channelId .. '/leave', {
    principalId = principalId,
  }, cb)
end

function ATC.Comms.JamChannel(channelId, cb)
  ATC.SDK.Post('/api/v1/comms/channels/' .. channelId .. '/jam', {}, cb)
end

function ATC.Comms.RestoreChannel(channelId, cb)
  ATC.SDK.Post('/api/v1/comms/channels/' .. channelId .. '/restore', {}, cb)
end

-- ── Signals ────────────────────────────────────────────────────────────────────

function ATC.Comms.UpsertSignal(params, cb)
  ATC.SDK.Post('/api/v1/comms/signals', params, cb)
end

function ATC.Comms.ListActiveSignals(cb)
  ATC.SDK.Get('/api/v1/comms/signals', cb)
end

function ATC.Comms.ReconcileSignals(thresholdMs, cb)
  ATC.SDK.Post('/api/v1/comms/signals/reconcile', { thresholdMs = thresholdMs or 30000 }, cb)
end

-- ── Emergency Broadcasts ───────────────────────────────────────────────────────

function ATC.Comms.Broadcast(params, cb)
  ATC.SDK.Post('/api/v1/comms/broadcasts', params, cb)
end

function ATC.Comms.ListActiveBroadcasts(cb)
  ATC.SDK.Get('/api/v1/comms/broadcasts', cb)
end

function ATC.Comms.CancelBroadcast(broadcastId, cb)
  ATC.SDK.Post('/api/v1/comms/broadcasts/' .. broadcastId .. '/cancel', {}, cb)
end

-- ── Encryption ─────────────────────────────────────────────────────────────────

function ATC.Comms.SetEncryption(channelId, encryptionKeyHash, cb)
  ATC.SDK.Post('/api/v1/comms/channels/' .. channelId .. '/encryption', {
    encryptionKeyHash = encryptionKeyHash,
  }, cb)
end
