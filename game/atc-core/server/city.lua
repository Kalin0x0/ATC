-- ATC City Runtime Bridge
-- Infrastructure, utility grids, traffic signals, environment, resource consumption.
-- City simulation state is server-authoritative.

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

local function apiPatch(path, body, cb)
  PerformHttpRequest(API_BASE .. path, function(status, text)
    if cb then cb(status, text and json.decode(text)) end
  end, 'PATCH', json.encode(body), {
    ['Content-Type']  = 'application/json',
    ['Authorization'] = 'Bearer ' .. API_TOKEN,
  })
end

-- ── Public SDK ────────────────────────────────────────────────────────────────

ATC.City = {}

--- Register an infrastructure node (upsert).
--- @param nodeId             string
--- @param nodeName           string
--- @param infrastructureType string  'power_station'|'water_treatment'|'gas_main'|'telecom_hub'|'road_segment'|'bridge'|'tunnel'|'sewage'|'other'
--- @param cb                 function|nil callback(status, node)
function ATC.City.RegisterInfrastructure(nodeId, nodeName, infrastructureType, cb)
  apiPost('/api/v1/city/infrastructure', {
    nodeId             = nodeId,
    nodeName           = nodeName,
    infrastructureType = infrastructureType,
  }, cb)
end

--- Get an infrastructure node by nodeId.
--- @param nodeId string
--- @param cb     function callback(status, node)
function ATC.City.GetInfrastructure(nodeId, cb)
  apiGet('/api/v1/city/infrastructure/' .. nodeId, cb)
end

--- Report an infrastructure failure.
--- @param nodeId       string
--- @param failureType  string  'power_outage'|'water_leak'|'gas_leak'|'road_damage'|'bridge_failure'|'telecom_outage'|'other'
--- @param severity     string  'low'|'medium'|'high'|'critical'
--- @param failureNonce string  idempotency key
--- @param description  string|nil
--- @param cb           function|nil callback(status, failure)
function ATC.City.ReportFailure(nodeId, failureType, severity, failureNonce, description, cb)
  apiPost('/api/v1/city/failures', {
    nodeId       = nodeId,
    failureType  = failureType,
    severity     = severity,
    failureNonce = failureNonce,
    description  = description,
  }, cb)
end

--- Resolve an infrastructure failure.
--- @param failureId  string
--- @param resolvedBy string  principalId
--- @param cb         function|nil callback(status, failure)
function ATC.City.ResolveFailure(failureId, resolvedBy, cb)
  apiPost('/api/v1/city/failures/' .. failureId .. '/resolve', {
    failureId  = failureId,
    resolvedBy = resolvedBy,
  }, cb)
end

--- List all active infrastructure failures.
--- @param cb function callback(status, failures)
function ATC.City.ListActiveFailures(cb)
  apiGet('/api/v1/city/failures/active', cb)
end

--- Update a traffic signal state.
--- @param signalId   string
--- @param signalName string
--- @param state      string  'green'|'yellow'|'red'|'flashing'|'offline'
--- @param changedBy  string|nil  principalId
--- @param cb         function|nil callback(status, signal)
function ATC.City.UpdateTrafficSignal(signalId, signalName, state, changedBy, cb)
  apiPost('/api/v1/city/traffic-signals', {
    signalId   = signalId,
    signalName = signalName,
    state      = state,
    changedBy  = changedBy,
  }, cb)
end

--- Get a traffic signal by signalId.
--- @param signalId string
--- @param cb       function callback(status, signal)
function ATC.City.GetTrafficSignal(signalId, cb)
  apiGet('/api/v1/city/traffic-signals/' .. signalId, cb)
end

--- Update the environment for a region.
--- @param regionId string
--- @param params   table  { weather?, timeOfDay?, temperature?, windSpeed?, visibility?, isEmergencyWeather?, activeEventId? }
--- @param cb       function|nil callback(status, environment)
function ATC.City.UpdateEnvironment(regionId, params, cb)
  local body = params or {}
  body.regionId = regionId
  apiPost('/api/v1/city/environment', body, cb)
end

--- Get the environment state for a region.
--- @param regionId string
--- @param cb       function callback(status, environment)
function ATC.City.GetEnvironment(regionId, cb)
  apiGet('/api/v1/city/environment/' .. regionId, cb)
end

--- Record resource consumption against a utility grid.
--- @param gridId       string
--- @param resourceType string  'power_kwh'|'water_liters'|'gas_m3'|'bandwidth_mb'
--- @param amount       number
--- @param consumerId   string|nil
--- @param periodLabel  string|nil
--- @param cb           function|nil callback(status, record)
function ATC.City.RecordConsumption(gridId, resourceType, amount, consumerId, periodLabel, cb)
  apiPost('/api/v1/city/consumption', {
    gridId       = gridId,
    resourceType = resourceType,
    amount       = amount,
    consumerId   = consumerId,
    periodLabel  = periodLabel,
  }, cb)
end

--- Report a utility grid outage.
--- @param gridId        string
--- @param gridName      string
--- @param utilityType   string  'power'|'water'|'gas'|'telecom'|'sewage'
--- @param outageNonce   string  idempotency key
--- @param reason        string
--- @param affectedZones table|nil  list of zone ids
--- @param cb            function|nil callback(status, grid)
function ATC.City.ReportUtilityOutage(gridId, gridName, utilityType, outageNonce, reason, affectedZones, cb)
  apiPost('/api/v1/city/utility-grids/outage', {
    gridId        = gridId,
    gridName      = gridName,
    utilityType   = utilityType,
    outageNonce   = outageNonce,
    reason        = reason,
    affectedZones = affectedZones or {},
  }, cb)
end

--- Restore a utility grid after an outage.
--- @param gridId                string
--- @param restoredByPrincipalId string
--- @param cb                    function|nil callback(status, grid)
function ATC.City.RestoreUtilityGrid(gridId, restoredByPrincipalId, cb)
  apiPost('/api/v1/city/utility-grids/' .. gridId .. '/restore', {
    restoredByPrincipalId = restoredByPrincipalId,
  }, cb)
end

--- Get a utility grid by gridId.
--- @param gridId string
--- @param cb     function callback(status, grid)
function ATC.City.GetUtilityGrid(gridId, cb)
  apiGet('/api/v1/city/utility-grids/' .. gridId, cb)
end
