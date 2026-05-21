-- ATC NPC & Dynamic Population Runtime Bridge
-- Spawn/despawn NPCs, record behaviors, update crowd density.
-- All population state is server-authoritative.

local API_BASE  = ATC.Config.ApiBase  or 'http://localhost:3000'
local API_TOKEN = ATC.Config.ApiToken or ''
local SERVER_ID = GetCurrentServerId() or 'server-1'

local function apiPost(path, body, cb)
  PerformHttpRequest(API_BASE .. path, function(status, text)
    if cb then cb(status, text and json.decode(text)) end
  end, 'POST', json.encode(body), {
    ['Content-Type']  = 'application/json',
    ['Authorization'] = 'Bearer ' .. API_TOKEN,
  })
end

local function apiGet(path, cb)
  PerformHttpRequest(API_BASE .. path, function(status, text)
    if cb then cb(status, text and json.decode(text)) end
  end, 'GET', '', {
    ['Authorization'] = 'Bearer ' .. API_TOKEN,
  })
end

-- ── Public SDK ────────────────────────────────────────────────────────────────

ATC.NPC = {}

--- Spawn a new NPC into the runtime.
--- @param zoneId      string
--- @param spawnNonce  string  idempotency key (use a UUID)
--- @param npcType     string  'civilian'|'pedestrian'|'ambient'|'scripted'|'emergency'
--- @param metadata    table|nil  arbitrary metadata
--- @param cb          function callback(status, npc)
function ATC.NPC.Spawn(zoneId, spawnNonce, npcType, metadata, cb)
  apiPost('/api/v1/npc/spawn', {
    zoneId        = zoneId,
    spawnNonce    = spawnNonce,
    npcType       = npcType or 'civilian',
    ownerServerId = SERVER_ID,
    metadata      = metadata or {},
  }, cb)
end

--- Despawn an NPC from the runtime.
--- @param npcId  string
--- @param reason string|nil  e.g. 'player_entered_zone', 'timeout'
--- @param cb     function callback(status)
function ATC.NPC.Despawn(npcId, reason, cb)
  apiPost('/api/v1/npc/despawn', {
    npcId         = npcId,
    reason        = reason or 'manual',
    ownerServerId = SERVER_ID,
  }, cb)
end

--- Send a heartbeat for an NPC to keep it alive.
--- @param npcId string
--- @param cb    function|nil callback(status)
function ATC.NPC.Heartbeat(npcId, cb)
  apiPost('/api/v1/npc/heartbeat', {
    npcId         = npcId,
    ownerServerId = SERVER_ID,
  }, cb)
end

--- Record an NPC behavior transition.
--- @param npcId    string
--- @param behavior string  e.g. 'idle', 'walking', 'fleeing', 'talking'
--- @param params   table|nil
--- @param cb       function|nil callback(status, record)
function ATC.NPC.RecordBehavior(npcId, behavior, params, cb)
  apiPost('/api/v1/npc/' .. npcId .. '/behavior', {
    npcId    = npcId,
    behavior = behavior,
    params   = params or {},
  }, cb)
end

--- Update crowd density for a zone.
--- @param zoneId         string
--- @param density        number  0.0–1.0
--- @param targetDensity  number|nil  0.0–1.0
--- @param activeNpcCount number|nil
--- @param cb             function|nil callback(status, crowd)
function ATC.NPC.UpdateCrowd(zoneId, density, targetDensity, activeNpcCount, cb)
  apiPost('/api/v1/npc/crowd', {
    zoneId         = zoneId,
    density        = density,
    targetDensity  = targetDensity or density,
    activeNpcCount = activeNpcCount or 0,
  }, cb)
end

--- Get crowd data for a zone.
--- @param zoneId string
--- @param cb     function callback(status, crowd)
function ATC.NPC.GetCrowd(zoneId, cb)
  apiGet('/api/v1/npc/crowd/' .. zoneId, cb)
end

--- Trigger stale NPC cleanup for this server.
--- @param cb function|nil callback(status, result)
function ATC.NPC.CleanupStale(cb)
  apiPost('/api/v1/npc/cleanup', {
    ownerServerId    = SERVER_ID,
    staleThresholdMs = 30000,
  }, cb)
end

-- ── Periodic heartbeat for all owned NPCs ─────────────────────────────────────

local ownedNpcs = {}

--- Register an NPC handle so the bridge sends automatic heartbeats.
--- @param npcId string
function ATC.NPC.TrackOwnership(npcId)
  ownedNpcs[npcId] = true
end

--- Unregister an NPC from automatic heartbeat tracking.
--- @param npcId string
function ATC.NPC.ReleaseOwnership(npcId)
  ownedNpcs[npcId] = nil
end

-- Heartbeat loop: every 10 seconds
CreateThread(function()
  while true do
    Wait(10000)
    for npcId, _ in pairs(ownedNpcs) do
      ATC.NPC.Heartbeat(npcId)
    end
  end
end)

-- Stale cleanup on resource start
AddEventHandler('onResourceStart', function(resourceName)
  if resourceName ~= GetCurrentResourceName() then return end
  Wait(5000)
  ATC.NPC.CleanupStale()
end)
