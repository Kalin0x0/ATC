-- ATC Property Runtime Bridge — housing lifecycle, access control, stash storage, garage
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

local function apiGet(path, cb)
  PerformHttpRequest(API_BASE .. path, function(status, text)
    if cb then cb(status, text and json.decode(text)) end
  end, 'GET', '', {
    ['Authorization'] = 'Bearer ' .. API_TOKEN,
  })
end

-- ── Public SDK ────────────────────────────────────────────────────────────────

ATC.Properties = {}

--- Enter a property interior.
--- Records occupancy server-side; does NOT trust client position.
--- @param source      number   FiveM player server id
--- @param propertyId  string
--- @param cb          function callback(status, data)
function ATC.Properties.Enter(source, propertyId, cb)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then
    if cb then cb(403, nil) end
    return
  end
  -- Occupancy tracking is via interior-state service; POST a synthetic enter event
  apiPost('/api/v1/properties/' .. propertyId .. '/enter', {
    principalId = principalId,
  }, cb)
end

--- Exit a property interior.
--- @param source      number
--- @param propertyId  string
--- @param cb          function callback(status, data)
function ATC.Properties.Exit(source, propertyId, cb)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then
    if cb then cb(403, nil) end
    return
  end
  apiPost('/api/v1/properties/' .. propertyId .. '/exit', {
    principalId = principalId,
  }, cb)
end

--- Lock a property.
--- @param source      number
--- @param propertyId  string
--- @param cb          function callback(status, property)
function ATC.Properties.Lock(source, propertyId, cb)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then
    if cb then cb(403, nil) end
    return
  end
  apiPost('/api/v1/properties/' .. propertyId .. '/lock', {
    principalId = principalId,
  }, cb)
end

--- Unlock a property.
--- @param source      number
--- @param propertyId  string
--- @param cb          function callback(status, property)
function ATC.Properties.Unlock(source, propertyId, cb)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then
    if cb then cb(403, nil) end
    return
  end
  apiPost('/api/v1/properties/' .. propertyId .. '/unlock', {
    principalId = principalId,
  }, cb)
end

--- Breach a property (law enforcement or EMS emergency override).
--- @param source      number   FiveM player server id of the breaching officer/medic
--- @param propertyId  string
--- @param params      table    accessType ('emergency_law'|'emergency_ems'), reason, agencyId
--- @param cb          function callback(status, property)
function ATC.Properties.Breach(source, propertyId, params, cb)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then
    if cb then cb(403, nil) end
    return
  end
  params = params or {}
  params.breachingPrincipalId = principalId
  if not params.accessType then params.accessType = 'emergency_law' end
  if not params.reason then params.reason = 'Emergency access' end
  apiPost('/api/v1/properties/' .. propertyId .. '/breach', params, cb)
end

--- Deposit an item into a property stash.
--- @param source      number
--- @param propertyId  string
--- @param stashId     string   stash identifier within the property
--- @param itemName    string
--- @param quantity    number
--- @param metadata    table    optional item metadata
--- @param cb          function callback(status, item)
function ATC.Properties.DepositItem(source, propertyId, stashId, itemName, quantity, metadata, cb)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then
    if cb then cb(403, nil) end
    return
  end
  apiPost('/api/v1/properties/' .. propertyId .. '/storage/deposit', {
    stashId             = stashId,
    itemName            = itemName,
    quantity            = tonumber(quantity) or 1,
    metadata            = type(metadata) == 'table' and metadata or nil,
    addedByPrincipalId  = principalId,
  }, cb)
end

--- Withdraw an item from a property stash.
--- @param source      number
--- @param propertyId  string
--- @param stashId     string
--- @param itemName    string
--- @param quantity    number
--- @param cb          function callback(status, data)
function ATC.Properties.WithdrawItem(source, propertyId, stashId, itemName, quantity, cb)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then
    if cb then cb(403, nil) end
    return
  end
  apiPost('/api/v1/properties/' .. propertyId .. '/storage/withdraw', {
    stashId               = stashId,
    itemName              = itemName,
    quantity              = tonumber(quantity) or 1,
    removedByPrincipalId  = principalId,
  }, cb)
end

--- Get stash contents for a property storage container.
--- @param propertyId  string
--- @param stashId     string
--- @param cb          function callback(status, {stashId, contents, capacity})
function ATC.Properties.GetStorage(propertyId, stashId, cb)
  apiGet('/api/v1/properties/' .. propertyId .. '/storage/' .. stashId, cb)
end

--- Retrieve a vehicle from a property-linked garage.
--- @param source      number   FiveM player server id of the retrieving principal
--- @param propertyId  string
--- @param vehicleId   string
--- @param garageId    string
--- @param coords      vector3  spawn position
--- @param heading     number
--- @param cb          function callback(status, vehicleWithRuntime)
function ATC.Properties.RetrieveVehicle(source, propertyId, vehicleId, garageId, coords, heading, cb)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then
    if cb then cb(403, nil) end
    return
  end
  if type(coords) ~= 'table' then
    if cb then cb(400, nil) end
    return
  end
  apiPost('/api/v1/properties/' .. propertyId .. '/garage/retrieve', {
    vehicleId              = vehicleId,
    garageId               = garageId,
    retrievedByPrincipalId = principalId,
    x       = tonumber(coords.x) or 0.0,
    y       = tonumber(coords.y) or 0.0,
    z       = tonumber(coords.z) or 0.0,
    heading = tonumber(heading)  or 0.0,
  }, cb)
end

-- ── Server Events ─────────────────────────────────────────────────────────────

--- Client requests to enter a property.
AddEventHandler('atc:property:enter:request', function(propertyId)
  local source = source
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then return end
  apiPost('/api/v1/properties/' .. propertyId .. '/enter', {
    principalId = principalId,
  }, function(status, data)
    TriggerClientEvent('atc:property:enter:response', source, status, data)
  end)
end)

--- Client requests to exit a property.
AddEventHandler('atc:property:exit:request', function(propertyId)
  local source = source
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then return end
  apiPost('/api/v1/properties/' .. propertyId .. '/exit', {
    principalId = principalId,
  }, function(status, data)
    TriggerClientEvent('atc:property:exit:response', source, status, data)
  end)
end)

--- Client requests to lock/unlock their property.
AddEventHandler('atc:property:lock:request', function(propertyId, shouldLock)
  local source = source
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then return end
  local endpoint = shouldLock and 'lock' or 'unlock'
  apiPost('/api/v1/properties/' .. propertyId .. '/' .. endpoint, {
    principalId = principalId,
  }, function(status, data)
    TriggerClientEvent('atc:property:lock:response', source, status, data)
  end)
end)
