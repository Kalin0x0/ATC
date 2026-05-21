-- ATC Dispatch Bridge — server-authoritative dispatch & incident operations
-- All principal IDs resolved server-side; no client value trusted.

local API_BASE = ATC.Config.ApiBase or 'http://localhost:3000'
local API_TOKEN = ATC.Config.ApiToken or ''

local function apiPost(path, body)
  local payload = json.encode(body)
  local result = PerformHttpRequest(API_BASE .. path, function() end, 'POST', payload, {
    ['Content-Type'] = 'application/json',
    ['Authorization'] = 'Bearer ' .. API_TOKEN,
  })
  return result
end

local function apiGet(path)
  local result = PerformHttpRequest(API_BASE .. path, function() end, 'GET', '', {
    ['Authorization'] = 'Bearer ' .. API_TOKEN,
  })
  return result
end

local function apiPatch(path, body)
  local payload = json.encode(body)
  local result = PerformHttpRequest(API_BASE .. path, function() end, 'PATCH', payload, {
    ['Content-Type'] = 'application/json',
    ['Authorization'] = 'Bearer ' .. API_TOKEN,
  })
  return result
end

-- ── Public SDK ───────────────────────────────────────────────────────────────

ATC.Dispatch = {}

--- Create a dispatch call. Source is always 'officer' when called from game code.
--- @param source number  FiveM player server id
--- @param location string
--- @param priority string  'low'|'medium'|'high'|'critical'
--- @param description string
--- @param idempotencyKey string  caller-supplied dedup key
--- @return table|nil  dispatch call object
function ATC.Dispatch.CreateCall(source, location, priority, description, idempotencyKey)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then
    ATC.Log.Warn('dispatch', 'CreateCall: no principal for source ' .. tostring(source))
    return nil
  end

  local status, body = apiPost('/api/v1/dispatch/calls', {
    source           = 'officer',
    callerIdentifier = principalId,
    location         = location,
    priority         = priority,
    description      = description,
    idempotencyKey   = idempotencyKey,
  })

  if status ~= 201 then
    ATC.Log.Error('dispatch', 'CreateCall failed: HTTP ' .. tostring(status))
    return nil
  end

  return json.decode(body)
end

--- Create an incident record (server-side, no source player required).
--- @param agencyId string
--- @param priority string
--- @param title string
--- @param createdByPrincipalId string
--- @param callId string|nil
--- @param location string|nil
--- @return table|nil  incident object
function ATC.Dispatch.CreateIncident(agencyId, priority, title, createdByPrincipalId, callId, location)
  local status, body = apiPost('/api/v1/dispatch/incidents', {
    agencyId              = agencyId,
    priority              = priority,
    title                 = title,
    createdByPrincipalId  = createdByPrincipalId,
    callId                = callId,
    location              = location,
  })

  if status ~= 201 then
    ATC.Log.Error('dispatch', 'CreateIncident failed: HTTP ' .. tostring(status))
    return nil
  end

  return json.decode(body)
end

--- Assign a responder to an incident.
--- @param source number  FiveM player server id
--- @param incidentId string
--- @param agencyId string
--- @return table|nil  responder assignment object
function ATC.Dispatch.AssignResponder(source, incidentId, agencyId)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  local characterId = ATC.Characters.GetActiveCharacterId(source)
  if not principalId then
    ATC.Log.Warn('dispatch', 'AssignResponder: no principal for source ' .. tostring(source))
    return nil
  end

  local status, body = apiPost('/api/v1/dispatch/incidents/' .. incidentId .. '/responders', {
    principalId = principalId,
    characterId = characterId,
    agencyId    = agencyId,
  })

  if status ~= 201 then
    ATC.Log.Error('dispatch', 'AssignResponder failed: HTTP ' .. tostring(status))
    return nil
  end

  return json.decode(body)
end

--- Update a responder's status (e.g. enroute → on_scene → cleared).
--- @param assignmentId string
--- @param newStatus string
--- @return table|nil  updated assignment
function ATC.Dispatch.UpdateResponderState(assignmentId, newStatus)
  local status, body = apiPatch('/api/v1/dispatch/responders/' .. assignmentId .. '/status', {
    status = newStatus,
  })

  if status ~= 200 then
    ATC.Log.Error('dispatch', 'UpdateResponderState failed: HTTP ' .. tostring(status))
    return nil
  end

  return json.decode(body)
end

--- Get open incidents for an agency.
--- @param agencyId string
--- @return table  { items, total, offset, limit }
function ATC.Dispatch.GetIncidents(agencyId)
  local status, body = apiGet('/api/v1/dispatch/incidents?agencyId=' .. agencyId .. '&status=open&limit=50')
  if status ~= 200 then
    ATC.Log.Warn('dispatch', 'GetIncidents failed: HTTP ' .. tostring(status))
    return { items = {}, total = 0, offset = 0, limit = 50 }
  end
  return json.decode(body)
end

--- Get active BOLOs for an agency.
--- @param agencyId string
--- @return table  { items, total, offset, limit }
function ATC.Dispatch.GetBolos(agencyId)
  local status, body = apiGet('/api/v1/dispatch/bolos?agencyId=' .. agencyId .. '&status=active&limit=50')
  if status ~= 200 then
    ATC.Log.Warn('dispatch', 'GetBolos failed: HTTP ' .. tostring(status))
    return { items = {}, total = 0, offset = 0, limit = 50 }
  end
  return json.decode(body)
end

--- Create a BOLO record.
--- @param source number  FiveM player server id
--- @param agencyId string
--- @param severity string  'infraction'|'misdemeanor'|'felony'
--- @param description string
--- @param opts table  { linkedWarrantId, linkedCharacterId, linkedVehicleId, expiresAt }
--- @return table|nil  BOLO record
function ATC.Dispatch.CreateBolo(source, agencyId, severity, description, opts)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then
    ATC.Log.Warn('dispatch', 'CreateBolo: no principal for source ' .. tostring(source))
    return nil
  end

  opts = opts or {}
  local status, body = apiPost('/api/v1/dispatch/bolos', {
    agencyId              = agencyId,
    createdByPrincipalId  = principalId,
    severity              = severity,
    description           = description,
    linkedWarrantId       = opts.linkedWarrantId,
    linkedCharacterId     = opts.linkedCharacterId,
    linkedVehicleId       = opts.linkedVehicleId,
    expiresAt             = opts.expiresAt,
  })

  if status ~= 201 then
    ATC.Log.Error('dispatch', 'CreateBolo failed: HTTP ' .. tostring(status))
    return nil
  end

  return json.decode(body)
end
