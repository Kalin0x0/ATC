-- ATC EMS Runtime Bridge — emergency lifecycle, ambulance dispatch, hospital capacity, revive
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

-- ── Public SDK ───────────────────────────────────────────────────────────────

ATC.EMS = {}

--- Create a new EMS emergency for a character.
--- @param source       number   FiveM player server id of the reporting officer/medic
--- @param characterId  string
--- @param opts         table    optional: incidentId, notes
--- @param cb           function callback(status, emergency)
function ATC.EMS.CreateEmergency(source, characterId, opts, cb)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then
    if cb then cb(403, nil) end
    return
  end
  opts = opts or {}
  apiPost('/api/v1/ems/emergencies', {
    characterId          = characterId,
    createdByPrincipalId = principalId,
    incidentId           = opts.incidentId,
    notes                = opts.notes,
  }, cb)
end

--- Triage an active emergency.
--- @param source       number   FiveM player server id
--- @param emergencyId  string
--- @param category     string   'red'|'yellow'|'green'|'black'
--- @param opts         table    optional: notes
--- @param cb           function callback(status, emergency)
function ATC.EMS.TriageEmergency(source, emergencyId, category, opts, cb)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then
    if cb then cb(403, nil) end
    return
  end
  opts = opts or {}
  apiPost('/api/v1/ems/emergencies/' .. emergencyId .. '/triage', {
    category             = category,
    triageByPrincipalId  = principalId,
    notes                = opts.notes,
  }, cb)
end

--- Assign a responder (ambulance unit) to an emergency.
--- @param source       number   FiveM player server id of the dispatcher
--- @param emergencyId  string
--- @param responderId  string   ambulance unit id
--- @param opts         table    optional: notes
--- @param cb           function callback(status, emergency)
function ATC.EMS.AssignResponder(source, emergencyId, responderId, opts, cb)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then
    if cb then cb(403, nil) end
    return
  end
  opts = opts or {}
  apiPost('/api/v1/ems/emergencies/' .. emergencyId .. '/assign', {
    responderId           = responderId,
    dispatchedByPrincipalId = principalId,
    notes                 = opts.notes,
  }, cb)
end

--- Mark an emergency as stabilized on scene.
--- @param source       number   FiveM player server id
--- @param emergencyId  string
--- @param opts         table    optional: notes
--- @param cb           function callback(status, emergency)
function ATC.EMS.StabilizeEmergency(source, emergencyId, opts, cb)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then
    if cb then cb(403, nil) end
    return
  end
  opts = opts or {}
  apiPost('/api/v1/ems/emergencies/' .. emergencyId .. '/stabilize', {
    updatedByPrincipalId = principalId,
    notes                = opts.notes,
  }, cb)
end

--- Mark patient as transported to hospital.
--- @param source       number   FiveM player server id
--- @param emergencyId  string
--- @param facilityId   string   destination hospital facility id
--- @param opts         table    optional: notes
--- @param cb           function callback(status, emergency)
function ATC.EMS.TransportPatient(source, emergencyId, facilityId, opts, cb)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then
    if cb then cb(403, nil) end
    return
  end
  opts = opts or {}
  apiPost('/api/v1/ems/emergencies/' .. emergencyId .. '/transport', {
    facilityId           = facilityId,
    transportedByPrincipalId = principalId,
    notes                = opts.notes,
  }, cb)
end

--- Close a resolved emergency.
--- @param source       number   FiveM player server id
--- @param emergencyId  string
--- @param resolution   string   outcome / resolution text
--- @param opts         table    optional: notes
--- @param cb           function callback(status, emergency)
function ATC.EMS.CloseEmergency(source, emergencyId, resolution, opts, cb)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then
    if cb then cb(403, nil) end
    return
  end
  opts = opts or {}
  apiPost('/api/v1/ems/emergencies/' .. emergencyId .. '/close', {
    resolution           = resolution,
    closedByPrincipalId  = principalId,
    notes                = opts.notes,
  }, cb)
end

--- Revive a deceased character via the EMS revive workflow (includes cooldown check).
--- @param source       number   FiveM player server id of the medic
--- @param characterId  string
--- @param opts         table    optional: emergencyId, notes
--- @param cb           function callback(status, result)
function ATC.EMS.Revive(source, characterId, opts, cb)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then
    if cb then cb(403, nil) end
    return
  end
  opts = opts or {}
  -- Revive lives in the medical routes but is part of EMS workflow
  apiPost('/api/v1/medical/revive/' .. characterId, {
    revivedByPrincipalId = principalId,
    emergencyId          = opts.emergencyId,
    incidentId           = opts.incidentId,
    notes                = opts.notes,
  }, cb)
end

--- Get current hospital capacity across all facilities.
--- @param cb function callback(status, capacities)
function ATC.EMS.GetHospitalCapacity(cb)
  apiGet('/api/v1/ems/hospitals/capacity', cb)
end

--- List all active (non-closed) emergencies.
--- @param cb function callback(status, emergencies)
function ATC.EMS.ListActiveEmergencies(cb)
  apiGet('/api/v1/ems/emergencies/active', cb)
end

--- Get a single emergency by id.
--- @param emergencyId string
--- @param cb          function callback(status, emergency)
function ATC.EMS.GetEmergency(emergencyId, cb)
  apiGet('/api/v1/ems/emergencies/' .. emergencyId, cb)
end

--- List active responders currently on duty.
--- @param cb function callback(status, responders)
function ATC.EMS.ListActiveResponders(cb)
  apiGet('/api/v1/ems/responders/active', cb)
end

-- ── Server Events ────────────────────────────────────────────────────────────

--- Triggered by a client requesting emergency dispatch. All data validated server-side.
RegisterNetEvent('atc:ems:emergency:request', function(characterId, notes)
  local source = source
  ATC.EMS.CreateEmergency(source, characterId, { notes = notes }, function(status, result)
    if status == 201 then
      TriggerClientEvent('atc:ems:emergency:created', source, result)
    else
      TriggerClientEvent('atc:ems:emergency:failed', source, { status = status, error = result })
    end
  end)
end)

--- Triggered by a medic stabilizing a patient on scene.
RegisterNetEvent('atc:ems:stabilize:request', function(emergencyId, notes)
  local source = source
  ATC.EMS.StabilizeEmergency(source, emergencyId, { notes = notes }, function(status, result)
    if status == 200 then
      TriggerClientEvent('atc:ems:stabilize:confirmed', source, result)
    else
      TriggerClientEvent('atc:ems:stabilize:failed', source, { status = status, error = result })
    end
  end)
end)

--- Triggered by a medic performing a revive.
RegisterNetEvent('atc:ems:revive:request', function(characterId, emergencyId, notes)
  local source = source
  ATC.EMS.Revive(source, characterId, { emergencyId = emergencyId, notes = notes }, function(status, result)
    if status == 200 then
      TriggerClientEvent('atc:ems:revive:confirmed', source, result)
    else
      TriggerClientEvent('atc:ems:revive:failed', source, { status = status, error = result })
    end
  end)
end)
