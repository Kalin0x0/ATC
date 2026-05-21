-- ATC Medical Bridge — server-authoritative EMS, trauma & medical operations
-- All principal IDs resolved server-side; no client value trusted.

local API_BASE  = ATC.Config.ApiBase  or 'http://localhost:3000'
local API_TOKEN = ATC.Config.ApiToken or ''

local function apiPost(path, body)
  local payload = json.encode(body)
  local result = PerformHttpRequest(API_BASE .. path, function() end, 'POST', payload, {
    ['Content-Type']  = 'application/json',
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
    ['Content-Type']  = 'application/json',
    ['Authorization'] = 'Bearer ' .. API_TOKEN,
  })
  return result
end

-- ── Public SDK ───────────────────────────────────────────────────────────────

ATC.Medical = {}

--- Record an injury for a character.
--- @param source       number  FiveM player server id of the recording officer/medic
--- @param characterId  string
--- @param region       string  body region
--- @param severity     string  'minor'|'moderate'|'critical'|'fatal'
--- @param description  string
--- @param incidentId   string|nil  optional linked incident
--- @return table|nil
function ATC.Medical.RecordInjury(source, characterId, region, severity, description, incidentId)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then return nil end
  return apiPost('/api/v1/medical/injuries', {
    characterId           = characterId,
    recordedByPrincipalId = principalId,
    region                = region,
    severity              = severity,
    description           = description,
    incidentId            = incidentId,
  })
end

--- Get the current trauma state for a character.
--- @param characterId string
--- @return table|nil
function ATC.Medical.GetTrauma(characterId)
  return apiGet('/api/v1/medical/trauma/' .. characterId)
end

--- Transition a character's trauma state.
--- @param source       number   FiveM player server id
--- @param characterId  string
--- @param newState     string   trauma state
--- @param notes        string|nil
--- @return table|nil
function ATC.Medical.UpdateTrauma(source, characterId, newState, notes)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then return nil end
  return apiPatch('/api/v1/medical/trauma/' .. characterId, {
    newState             = newState,
    updatedByPrincipalId = principalId,
    notes                = notes,
  })
end

--- Revive a deceased character. Requires ems.revive capability on the caller.
--- @param source       number   FiveM player server id of the medic
--- @param characterId  string
--- @param incidentId   string|nil
--- @param notes        string|nil
--- @return table|nil
function ATC.Medical.RevivePatient(source, characterId, incidentId, notes)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then return nil end
  return apiPost('/api/v1/medical/revive/' .. characterId, {
    revivedByPrincipalId = principalId,
    incidentId           = incidentId,
    notes                = notes,
  })
end

--- Apply a treatment to a character.
--- @param source       number   FiveM player server id
--- @param characterId  string
--- @param treatmentType string  e.g. 'bandage', 'cpr', 'defibrillator'
--- @param opts         table    optional: incidentId, itemId, notes, previousTrauma, resultingTrauma
--- @return table|nil
function ATC.Medical.ApplyTreatment(source, characterId, treatmentType, opts)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then return nil end
  opts = opts or {}
  return apiPost('/api/v1/medical/treatments', {
    characterId          = characterId,
    appliedByPrincipalId = principalId,
    type                 = treatmentType,
    incidentId           = opts.incidentId,
    itemId               = opts.itemId,
    notes                = opts.notes,
    previousTrauma       = opts.previousTrauma,
    resultingTrauma      = opts.resultingTrauma,
  })
end

--- Create a medical report.
--- @param source       number   FiveM player server id
--- @param characterId  string
--- @param diagnosis    string
--- @param opts         table    optional: incidentId, arrestId, notes, injuryIds, treatmentIds, vitalsSnapshot
--- @return table|nil
function ATC.Medical.CreateReport(source, characterId, diagnosis, opts)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then return nil end
  opts = opts or {}
  return apiPost('/api/v1/medical/reports', {
    characterId          = characterId,
    createdByPrincipalId = principalId,
    diagnosis            = diagnosis,
    incidentId           = opts.incidentId,
    arrestId             = opts.arrestId,
    notes                = opts.notes,
    injuryIds            = opts.injuryIds,
    treatmentIds         = opts.treatmentIds,
    vitalsSnapshot       = opts.vitalsSnapshot,
  })
end

--- Admit a character to hospital.
--- @param source       number   FiveM player server id
--- @param characterId  string
--- @param opts         table    optional: facilityId, incidentId, notes
--- @return table|nil
function ATC.Medical.AdmitToHospital(source, characterId, opts)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then return nil end
  opts = opts or {}
  return apiPost('/api/v1/medical/hospital/admit', {
    characterId          = characterId,
    admittedByPrincipalId = principalId,
    facilityId           = opts.facilityId,
    incidentId           = opts.incidentId,
    notes                = opts.notes,
  })
end

--- Get active hospital record for a character.
--- @param characterId string
--- @return table|nil
function ATC.Medical.GetHospitalRecord(characterId)
  return apiGet('/api/v1/medical/hospital/character/' .. characterId)
end

--- Update hospital status (e.g. admitted → icu → surgery → discharged).
--- @param source     number   FiveM player server id
--- @param recordId   string   hospital record id
--- @param newStatus  string
--- @param notes      string|nil
--- @return table|nil
function ATC.Medical.UpdateHospitalStatus(source, recordId, newStatus, notes)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then return nil end
  return apiPatch('/api/v1/medical/hospital/' .. recordId .. '/status', {
    newStatus            = newStatus,
    updatedByPrincipalId = principalId,
    notes                = notes,
  })
end
