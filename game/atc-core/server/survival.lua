-- ATC Phase 41: Survival, Needs & Environmental Runtime
-- Server-side SDK bridge — all calls go through the ATC API

ATC.Survival = ATC.Survival or {}

-- ── Survival Tick ──────────────────────────────────────────────────────────────

function ATC.Survival.Tick(playerId, ownerServerId, params, cb)
  ATC.SDK.Post('/api/v1/survival/tick', {
    playerId       = playerId,
    ownerServerId  = ownerServerId,
    bodyTemp       = params.bodyTemp or 37.0,
    hydrationLevel = params.hydrationLevel or 100.0,
    fatigueLevel   = params.fatigueLevel or 0.0,
    survivalStatus = params.survivalStatus or 'normal',
    tempTrend      = params.tempTrend,
    depletionRate  = params.depletionRate,
    restDebt       = params.restDebt,
    exposureZone   = params.exposureZone,
  }, cb)
end

-- ── Get survival state ─────────────────────────────────────────────────────────

function ATC.Survival.GetState(playerId, cb)
  ATC.SDK.Get('/api/v1/survival/players/' .. playerId, cb)
end

-- ── Apply penalty ──────────────────────────────────────────────────────────────

function ATC.Survival.ApplyPenalty(playerId, penaltyFlag, reason, cb)
  ATC.SDK.Post('/api/v1/survival/penalty', {
    playerId    = playerId,
    penaltyFlag = penaltyFlag,
    reason      = reason or 'unspecified',
  }, cb)
end

-- ── Reconcile stale survival states ───────────────────────────────────────────

function ATC.Survival.Reconcile(activePlayerIds, cb)
  ATC.SDK.Post('/api/v1/survival/reconcile', {
    activePlayerIds = activePlayerIds,
  }, cb)
end

-- ── Record drink ───────────────────────────────────────────────────────────────

function ATC.Survival.RecordDrink(playerId, amount, cb)
  ATC.SDK.Post('/api/v1/survival/hydration/drink', {
    playerId = playerId,
    amount   = amount,
  }, cb)
end

-- ── Record rest ────────────────────────────────────────────────────────────────

function ATC.Survival.RecordRest(playerId, recoveryAmount, cb)
  ATC.SDK.Post('/api/v1/survival/fatigue/rest', {
    playerId       = playerId,
    recoveryAmount = recoveryAmount,
  }, cb)
end

-- ── Create environmental hazard ────────────────────────────────────────────────

function ATC.Survival.CreateHazard(hazardId, hazardType, zoneId, severity, ownerServerId, cb)
  ATC.SDK.Post('/api/v1/survival/hazards', {
    hazardId      = hazardId,
    hazardType    = hazardType,
    zoneId        = zoneId,
    severity      = severity,
    ownerServerId = ownerServerId,
  }, cb)
end

-- ── Deactivate hazard ──────────────────────────────────────────────────────────

function ATC.Survival.DeactivateHazard(hazardId, cb)
  ATC.SDK.Post('/api/v1/survival/hazards/' .. hazardId .. '/deactivate', {}, cb)
end

-- ── List active hazards ────────────────────────────────────────────────────────

function ATC.Survival.GetActiveHazards(cb)
  ATC.SDK.Get('/api/v1/survival/hazards', cb)
end

-- ── Record exposure ────────────────────────────────────────────────────────────

function ATC.Survival.RecordExposure(playerId, hazardId, exposureType, severity, cb)
  ATC.SDK.Post('/api/v1/survival/exposure', {
    playerId     = playerId,
    hazardId     = hazardId,
    exposureType = exposureType,
    severity     = severity,
  }, cb)
end

-- ── Auto-tick thread ───────────────────────────────────────────────────────────
-- Sends survival ticks for all connected players every 30 seconds

CreateThread(function()
  while true do
    Wait(30000)
    local players = GetPlayers()
    local serverId = GetConvar('atc_server_id', 'default')
    for _, playerSrc in ipairs(players) do
      local playerId = ATC.SDK.Player.GetId(playerSrc)
      if playerId then
        ATC.Survival.Tick(playerId, serverId, {
          bodyTemp       = 37.0,
          hydrationLevel = 100.0,
          fatigueLevel   = 0.0,
          survivalStatus = 'normal',
        })
      end
    end
  end
end)
