-- ATC Vehicle Runtime Bridge — vehicle lifecycle, garage, impound, fleet
-- All principal IDs resolved server-side; no client value trusted.

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

local function apiPatch(path, body, cb)
  PerformHttpRequest(API_BASE .. path, function(status, text)
    if cb then cb(status, text and json.decode(text)) end
  end, 'PATCH', json.encode(body), {
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

local function apiDelete(path, body, cb)
  PerformHttpRequest(API_BASE .. path, function(status, text)
    if cb then cb(status, text and json.decode(text)) end
  end, 'DELETE', json.encode(body), {
    ['Content-Type']  = 'application/json',
    ['Authorization'] = 'Bearer ' .. API_TOKEN,
  })
end

-- ── Public SDK ───────────────────────────────────────────────────────────────

ATC.Vehicles = {}

--- Register a new vehicle into the system.
--- @param source  number   FiveM player server id of the registering principal
--- @param params  table    plate, vin, model, category, ownerId, organizationId, garageId
--- @param cb      function callback(status, vehicle)
function ATC.Vehicles.Register(source, params, cb)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then
    if cb then cb(403, nil) end
    return
  end
  params.principalId = principalId
  apiPost('/api/v1/vehicles', params, cb)
end

--- Get a vehicle with its current runtime state.
--- @param source     number   FiveM player server id
--- @param vehicleId  string
--- @param cb         function callback(status, vehicleWithRuntime)
function ATC.Vehicles.Get(source, vehicleId, cb)
  apiGet('/api/v1/vehicles/' .. vehicleId, cb)
end

--- Spawn a vehicle directly (not from garage).
--- @param source     number   FiveM player server id of the spawning principal
--- @param vehicleId  string
--- @param coords     vector3  spawn position
--- @param heading    number
--- @param cb         function callback(status, vehicleWithRuntime)
function ATC.Vehicles.Spawn(source, vehicleId, coords, heading, cb)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then
    if cb then cb(403, nil) end
    return
  end
  apiPost('/api/v1/vehicles/' .. vehicleId .. '/spawn', {
    spawnedByPrincipalId = principalId,
    x       = coords.x,
    y       = coords.y,
    z       = coords.z,
    heading = heading or 0.0,
  }, cb)
end

--- Retrieve a vehicle from a garage.
--- @param source     number   FiveM player server id of the retrieving principal
--- @param vehicleId  string
--- @param garageId   string
--- @param coords     vector3  spawn position after retrieval
--- @param heading    number
--- @param cb         function callback(status, vehicleWithRuntime)
function ATC.Vehicles.Retrieve(source, vehicleId, garageId, coords, heading, cb)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then
    if cb then cb(403, nil) end
    return
  end
  apiPost('/api/v1/vehicles/' .. vehicleId .. '/retrieve', {
    garageId               = garageId,
    retrievedByPrincipalId = principalId,
    x       = coords.x,
    y       = coords.y,
    z       = coords.z,
    heading = heading or 0.0,
  }, cb)
end

--- Store a vehicle in a garage.
--- @param source     number   FiveM player server id of the storing principal
--- @param vehicleId  string
--- @param garageId   string
--- @param snapshot   table    optional: fuel, bodyHealth, engineHealth, lastX/Y/Z/Heading
--- @param cb         function callback(status, vehicle)
function ATC.Vehicles.Store(source, vehicleId, garageId, snapshot, cb)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then
    if cb then cb(403, nil) end
    return
  end
  snapshot = snapshot or {}
  snapshot.garageId            = garageId
  snapshot.storedByPrincipalId = principalId
  apiPost('/api/v1/vehicles/' .. vehicleId .. '/store', snapshot, cb)
end

--- Impound a vehicle.
--- @param source     number   FiveM player server id of the impounding officer
--- @param vehicleId  string
--- @param params     table    reason, agencyId, locationId, evidenceHold, fee, notes
--- @param cb         function callback(status, vehicle)
function ATC.Vehicles.Impound(source, vehicleId, params, cb)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then
    if cb then cb(403, nil) end
    return
  end
  params = params or {}
  params.impoundedByPrincipalId = principalId
  apiPost('/api/v1/vehicles/' .. vehicleId .. '/impound', params, cb)
end

--- Release a vehicle from impound.
--- @param source     number   FiveM player server id of the releasing principal
--- @param vehicleId  string
--- @param params     table    optional: garageId, notes
--- @param cb         function callback(status, vehicle)
function ATC.Vehicles.Release(source, vehicleId, params, cb)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then
    if cb then cb(403, nil) end
    return
  end
  params = params or {}
  params.releasedByPrincipalId = principalId
  apiPost('/api/v1/vehicles/' .. vehicleId .. '/release', params, cb)
end

--- Sync vehicle runtime state from the game server.
--- @param vehicleId  string
--- @param state      table    x, y, z, heading, fuel, bodyHealth, engineHealth, isLocked, isEngineOn, netId, serverHandle, mileageDelta
--- @param cb         function callback(status, data)
function ATC.Vehicles.SyncRuntime(vehicleId, state, cb)
  apiPatch('/api/v1/vehicles/' .. vehicleId .. '/runtime', state, cb)
end

--- List all garages with vehicle counts.
--- @param cb  function callback(status, garages)
function ATC.Vehicles.ListGarages(cb)
  apiGet('/api/v1/garages', cb)
end

--- List active vehicles in a garage.
--- @param garageId  string
--- @param cb        function callback(status, records)
function ATC.Vehicles.ListGarageVehicles(garageId, cb)
  apiGet('/api/v1/garages/' .. garageId .. '/vehicles', cb)
end

--- Assign a vehicle to an organization or principal.
--- @param source  number   FiveM player server id of the assigning principal
--- @param params  table    vehicleId, organizationId or principalId, role, expiresInSeconds
--- @param cb      function callback(status, assignment)
function ATC.Vehicles.FleetAssign(source, params, cb)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then
    if cb then cb(403, nil) end
    return
  end
  params.assignedByPrincipalId = principalId
  apiPost('/api/v1/fleet/assign', params, cb)
end

--- Unassign a fleet assignment.
--- @param source        number   FiveM player server id of the unassigning principal
--- @param assignmentId  string
--- @param cb            function callback(status, assignment)
function ATC.Vehicles.FleetUnassign(source, assignmentId, cb)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then
    if cb then cb(403, nil) end
    return
  end
  apiDelete('/api/v1/fleet/assignments/' .. assignmentId, {
    unassignedByPrincipalId = principalId,
  }, cb)
end

-- ── Server Events ─────────────────────────────────────────────────────────────

--- Client requests to store their vehicle in a garage.
AddEventHandler('atc:vehicle:store:request', function(vehicleId, garageId, snapshot)
  local source = source
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then return end
  snapshot = type(snapshot) == 'table' and snapshot or {}
  snapshot.garageId            = garageId
  snapshot.storedByPrincipalId = principalId
  apiPost('/api/v1/vehicles/' .. vehicleId .. '/store', snapshot, function(status, data)
    TriggerClientEvent('atc:vehicle:store:response', source, status, data)
  end)
end)

--- Client requests to retrieve their vehicle from a garage.
AddEventHandler('atc:vehicle:retrieve:request', function(vehicleId, garageId, coords, heading)
  local source = source
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then return end
  if type(coords) ~= 'table' then return end
  apiPost('/api/v1/vehicles/' .. vehicleId .. '/retrieve', {
    garageId               = garageId,
    retrievedByPrincipalId = principalId,
    x       = coords.x or 0.0,
    y       = coords.y or 0.0,
    z       = coords.z or 0.0,
    heading = heading or 0.0,
  }, function(status, data)
    TriggerClientEvent('atc:vehicle:retrieve:response', source, status, data)
  end)
end)

--- Periodic runtime sync from FiveM resource (server-side entity updates).
AddEventHandler('atc:vehicle:runtime:sync', function(vehicleId, state)
  if type(state) ~= 'table' then return end
  -- Sanitize numeric fields — never trust raw client floats for critical fields
  local sanitized = {
    x             = tonumber(state.x) or 0.0,
    y             = tonumber(state.y) or 0.0,
    z             = tonumber(state.z) or 0.0,
    heading       = tonumber(state.heading) or 0.0,
    fuel          = tonumber(state.fuel),
    bodyHealth    = tonumber(state.bodyHealth),
    engineHealth  = tonumber(state.engineHealth),
    isLocked      = state.isLocked == true,
    isEngineOn    = state.isEngineOn == true,
    netId         = type(state.netId) == 'number' and state.netId or nil,
    serverHandle  = type(state.serverHandle) == 'number' and state.serverHandle or nil,
    mileageDelta  = tonumber(state.mileageDelta),
  }
  apiPatch('/api/v1/vehicles/' .. vehicleId .. '/runtime', sanitized, nil)
end)
