-- ATC World Runtime Bridge — entity registration, scene sync, persistent scenes, cleanup
-- Server-authoritative: entity spawn nonces prevent duplicates. No client position trusted.
-- Scene ownership acquired/released server-side only.

local API_BASE  = ATC.Config.ApiBase  or 'http://localhost:3000'
local API_TOKEN = ATC.Config.ApiToken or ''

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

ATC.World = {}

--- Register a world entity with the runtime.
--- spawnNonce must be unique per owner — duplicate nonces are rejected (409).
--- @param source          number   owning player (nil for server-spawned entities)
--- @param params          table    { entityType, model, x, y, z, heading, spawnNonce, networkId?, sceneId? }
--- @param cb              function callback(status, entity)
function ATC.World.RegisterEntity(source, params, cb)
  local ownerPrincipalId = nil
  if source and source > 0 then
    ownerPrincipalId = ATC.Accounts.GetPrincipalId(source)
  end
  params = params or {}
  apiPost('/api/v1/world/entities', {
    entityType        = params.entityType  or 'object',
    ownerPrincipalId  = ownerPrincipalId,
    networkId         = tonumber(params.networkId),
    model             = params.model       or '',
    x                 = tonumber(params.x)       or 0.0,
    y                 = tonumber(params.y)       or 0.0,
    z                 = tonumber(params.z)       or 0.0,
    heading           = tonumber(params.heading) or 0.0,
    spawnNonce        = params.spawnNonce  or '',
    sceneId           = params.sceneId,
  }, cb)
end

--- Mark an entity as despawned.
--- @param entityId        string
--- @param cb              function callback(status, entity)
function ATC.World.DespawnEntity(entityId, cb)
  apiPost('/api/v1/world/entities/' .. entityId .. '/despawn', {}, cb)
end

--- Reconcile an entity's position (server-authoritative update).
--- Only called from trusted server code — never from client position directly.
--- @param entityId        string
--- @param coords          vector3  server-verified position
--- @param heading         number
--- @param networkId       number   optional
--- @param cb              function callback(status, entity)
function ATC.World.ReconcileEntity(entityId, coords, heading, networkId, cb)
  if type(coords) ~= 'table' then
    if cb then cb(400, nil) end
    return
  end
  apiPost('/api/v1/world/entities/' .. entityId .. '/reconcile', {
    x         = tonumber(coords.x)  or 0.0,
    y         = tonumber(coords.y)  or 0.0,
    z         = tonumber(coords.z)  or 0.0,
    heading   = tonumber(heading)   or 0.0,
    networkId = tonumber(networkId),
  }, cb)
end

--- List all active scenes.
--- @param cb              function callback(status, scenes)
function ATC.World.ListScenes(cb)
  apiGet('/api/v1/world/scenes', cb)
end

--- Create a new runtime scene.
--- @param source          number   scene creator
--- @param sceneId         string   unique scene identifier
--- @param label           string
--- @param replicationNode string   optional node ID for distributed sync
--- @param cb              function callback(status, scene)
function ATC.World.CreateScene(source, sceneId, label, replicationNode, cb)
  local principalId = source and source > 0 and ATC.Accounts.GetPrincipalId(source) or 'server'
  apiPost('/api/v1/world/scenes', {
    sceneId              = sceneId,
    creatorPrincipalId   = principalId,
    label                = label         or sceneId,
    replicationNode      = replicationNode,
  }, cb)
end

--- Destroy a scene and release all its entity ownerships.
--- @param sceneId         string
--- @param cb              function callback(status, scene)
function ATC.World.DestroyScene(sceneId, cb)
  apiPost('/api/v1/world/scenes/' .. sceneId .. '/destroy', {}, cb)
end

--- Persist a scene to the database for restoration after server restart.
--- @param params          table    { sceneId, sceneType, worldRegion?, data, expiresInSeconds? }
--- @param cb              function callback(status, persistentScene)
function ATC.World.PersistScene(params, cb)
  params = params or {}
  apiPost('/api/v1/world/scenes/persist', {
    sceneId          = params.sceneId,
    sceneType        = params.sceneType        or 'other',
    worldRegion      = params.worldRegion,
    data             = type(params.data) == 'table' and params.data or {},
    expiresInSeconds = tonumber(params.expiresInSeconds),
  }, cb)
end

--- Restore a previously persisted scene.
--- @param sceneId         string
--- @param cb              function callback(status, persistentScene)
function ATC.World.RestoreScene(sceneId, cb)
  apiPost('/api/v1/world/scenes/' .. sceneId .. '/restore', {}, cb)
end

--- Schedule a runtime cleanup task.
--- @param params          table    { targetType, targetId, cleanupReason, nodeId? }
--- @param cb              function callback(status, cleanup)
function ATC.World.ScheduleCleanup(params, cb)
  params = params or {}
  apiPost('/api/v1/world/cleanup', {
    targetType    = params.targetType   or 'entity',
    targetId      = params.targetId     or '',
    cleanupReason = params.cleanupReason or 'manual',
    nodeId        = params.nodeId,
  }, cb)
end

--- Trigger processing of all pending cleanup tasks.
--- Typically called on resource start or scheduled interval.
--- @param cb              function callback(status, { processed })
function ATC.World.ProcessCleanups(cb)
  apiPost('/api/v1/world/cleanup/process', {}, cb)
end

-- ── Server Events ─────────────────────────────────────────────────────────────

--- Client requests entity registration (after spawning a networked entity).
AddEventHandler('atc:world:entity:register:request', function(params)
  local source = source
  if type(params) ~= 'table' then return end
  -- Sanitize coordinates — never trust raw client values
  local safeParams = {
    entityType  = type(params.entityType) == 'string' and params.entityType or 'object',
    model       = type(params.model)      == 'string' and params.model      or '',
    x           = tonumber(params.x)       or 0.0,
    y           = tonumber(params.y)       or 0.0,
    z           = tonumber(params.z)       or 0.0,
    heading     = tonumber(params.heading) or 0.0,
    spawnNonce  = type(params.spawnNonce)  == 'string' and params.spawnNonce or '',
    networkId   = tonumber(params.networkId),
    sceneId     = type(params.sceneId)     == 'string' and params.sceneId or nil,
  }
  if safeParams.spawnNonce == '' or safeParams.model == '' then return end
  ATC.World.RegisterEntity(source, safeParams, function(status, data)
    TriggerClientEvent('atc:world:entity:register:response', source, status, data)
  end)
end)

--- Client requests entity despawn (on entity delete/cleanup).
AddEventHandler('atc:world:entity:despawn:request', function(entityId)
  local source = source
  if type(entityId) ~= 'string' then return end
  ATC.World.DespawnEntity(entityId, function(status, data)
    TriggerClientEvent('atc:world:entity:despawn:response', source, status, data)
  end)
end)

--- Server-side: process stale cleanup on resource start.
AddEventHandler('onResourceStart', function(resourceName)
  if resourceName ~= GetCurrentResourceName() then return end
  -- Small delay to allow API to be ready
  SetTimeout(5000, function()
    ATC.World.ProcessCleanups(function(status, data)
      if status == 200 and data then
        ATC.Logger.Info('World cleanup processed ' .. (data.processed or 0) .. ' pending tasks on start')
      end
    end)
  end)
end)
