-- ATC Criminal Runtime Bridge — gang operations, raids, contraband, black market
-- All principal IDs resolved server-side. No client trust for operation state.

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

local function apiDelete(path, cb)
  PerformHttpRequest(API_BASE .. path, function(status, text)
    if cb then cb(status, text and json.decode(text)) end
  end, 'DELETE', '', {
    ['Authorization'] = 'Bearer ' .. API_TOKEN,
  })
end

-- ── Public SDK ────────────────────────────────────────────────────────────────

ATC.Criminal = {}

--- Create a new gang.
--- @param source          number   leader's FiveM server id
--- @param name            string
--- @param tag             string   max 8 chars
--- @param cb              function callback(status, gang)
function ATC.Criminal.CreateGang(source, name, tag, cb)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then
    if cb then cb(403, nil) end
    return
  end
  apiPost('/api/v1/criminal/gangs', {
    name               = name,
    tag                = tag,
    leaderPrincipalId  = principalId,
  }, cb)
end

--- Add a member to a gang.
--- @param source          number   inviting player's server id (capability check)
--- @param gangId          string
--- @param targetSource    number   player to add
--- @param rank            string   'leader'|'officer'|'member'|'associate'
--- @param cb              function callback(status, member)
function ATC.Criminal.AddMember(source, gangId, targetSource, rank, cb)
  local inviterPrincipalId = ATC.Accounts.GetPrincipalId(source)
  if not inviterPrincipalId then
    if cb then cb(403, nil) end
    return
  end
  local targetPrincipalId = ATC.Accounts.GetPrincipalId(targetSource)
  if not targetPrincipalId then
    if cb then cb(400, nil) end
    return
  end
  apiPost('/api/v1/criminal/gangs/' .. gangId .. '/members', {
    principalId          = targetPrincipalId,
    rank                 = rank or 'associate',
    invitedByPrincipalId = inviterPrincipalId,
  }, cb)
end

--- Remove a member from a gang.
--- @param source          number   officer/leader's server id
--- @param gangId          string
--- @param targetSource    number
--- @param cb              function callback(status, member)
function ATC.Criminal.RemoveMember(source, gangId, targetSource, cb)
  local targetPrincipalId = ATC.Accounts.GetPrincipalId(targetSource)
  if not targetPrincipalId then
    if cb then cb(400, nil) end
    return
  end
  apiDelete('/api/v1/criminal/gangs/' .. gangId .. '/members/' .. targetPrincipalId, cb)
end

--- Start a criminal operation.
--- @param source          number   operation owner
--- @param params          table    { label, operationType, gangId? }
--- @param cb              function callback(status, operation)
function ATC.Criminal.StartOperation(source, params, cb)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then
    if cb then cb(403, nil) end
    return
  end
  params = params or {}
  apiPost('/api/v1/criminal/operations', {
    label             = params.label          or 'Operation',
    operationType     = params.operationType  or 'other',
    ownerPrincipalId  = principalId,
    gangId            = params.gangId,
  }, cb)
end

--- Complete a criminal operation.
--- @param operationId     string
--- @param outcome         string   optional outcome description
--- @param cb              function callback(status, operation)
function ATC.Criminal.CompleteOperation(operationId, outcome, cb)
  apiPost('/api/v1/criminal/operations/' .. operationId .. '/complete', {
    outcome = outcome,
  }, cb)
end

--- Abort a criminal operation.
--- @param operationId     string
--- @param cb              function callback(status, operation)
function ATC.Criminal.AbortOperation(operationId, cb)
  apiPost('/api/v1/criminal/operations/' .. operationId .. '/abort', {}, cb)
end

--- Register contraband in a property stash.
--- @param source          number   registering player
--- @param params          table    { itemName, quantity, propertyId?, stashId? }
--- @param cb              function callback(status, contraband)
function ATC.Criminal.RegisterContraband(source, params, cb)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then
    if cb then cb(403, nil) end
    return
  end
  params = params or {}
  apiPost('/api/v1/criminal/contraband', {
    itemName                = params.itemName  or '',
    quantity                = tonumber(params.quantity) or 1,
    registeredByPrincipalId = principalId,
    propertyId              = params.propertyId,
    stashId                 = params.stashId,
  }, cb)
end

--- Seize contraband (law enforcement).
--- @param source          number   seizing officer
--- @param contrabandId    string
--- @param cb              function callback(status, contraband)
function ATC.Criminal.SeizeContraband(source, contrabandId, cb)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then
    if cb then cb(403, nil) end
    return
  end
  apiPost('/api/v1/criminal/contraband/' .. contrabandId .. '/seize', {
    seizedByPrincipalId = principalId,
  }, cb)
end

--- Record an illegal trade transaction.
--- @param sellerSource    number
--- @param buyerSource     number
--- @param params          table    { itemName, quantity, price, locationLabel? }
--- @param cb              function callback(status, transaction)
function ATC.Criminal.RecordTrade(sellerSource, buyerSource, params, cb)
  local sellerPrincipalId = ATC.Accounts.GetPrincipalId(sellerSource)
  if not sellerPrincipalId then
    if cb then cb(403, nil) end
    return
  end
  local buyerPrincipalId = ATC.Accounts.GetPrincipalId(buyerSource)
  if not buyerPrincipalId then
    if cb then cb(400, nil) end
    return
  end
  params = params or {}
  apiPost('/api/v1/criminal/trade', {
    sellerPrincipalId = sellerPrincipalId,
    buyerPrincipalId  = buyerPrincipalId,
    itemName          = params.itemName or '',
    quantity          = tonumber(params.quantity) or 1,
    price             = tonumber(params.price)    or 0,
    locationLabel     = params.locationLabel,
  }, cb)
end

--- Stage a raid on a property.
--- @param source          number   lead officer
--- @param params          table    { propertyId, initiatingAgencyId?, participants (table of sources), notes? }
--- @param cb              function callback(status, raid)
function ATC.Criminal.StageRaid(source, params, cb)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then
    if cb then cb(403, nil) end
    return
  end
  params = params or {}
  -- Resolve participant sources to principal IDs
  local participantPrincipalIds = {}
  if type(params.participants) == 'table' then
    for _, participantSource in ipairs(params.participants) do
      local pid = ATC.Accounts.GetPrincipalId(tonumber(participantSource))
      if pid then
        table.insert(participantPrincipalIds, pid)
      end
    end
  end
  -- Ensure lead is included
  if #participantPrincipalIds == 0 then
    table.insert(participantPrincipalIds, principalId)
  end
  apiPost('/api/v1/criminal/raids', {
    propertyId            = params.propertyId,
    initiatingAgencyId    = params.initiatingAgencyId,
    leadPrincipalId       = principalId,
    participants          = participantPrincipalIds,
    notes                 = params.notes,
  }, cb)
end

--- Start a staged raid.
--- @param raidId          string
--- @param cb              function callback(status, raid)
function ATC.Criminal.StartRaid(raidId, cb)
  apiPost('/api/v1/criminal/raids/' .. raidId .. '/start', {}, cb)
end

--- Complete a raid.
--- @param raidId          string
--- @param outcome         string   'success'|'failure'|'partial'|'aborted'
--- @param notes           string   optional
--- @param cb              function callback(status, raid)
function ATC.Criminal.CompleteRaid(raidId, outcome, notes, cb)
  apiPost('/api/v1/criminal/raids/' .. raidId .. '/complete', {
    outcome = outcome or 'success',
    notes   = notes,
  }, cb)
end

--- Abort a raid.
--- @param raidId          string
--- @param notes           string   optional
--- @param cb              function callback(status, raid)
function ATC.Criminal.AbortRaid(raidId, notes, cb)
  apiPost('/api/v1/criminal/raids/' .. raidId .. '/abort', {
    notes = notes,
  }, cb)
end

-- ── Server Events ─────────────────────────────────────────────────────────────

--- Client requests a gang operation start.
AddEventHandler('atc:criminal:operation:start:request', function(params)
  local source = source
  if type(params) ~= 'table' then return end
  ATC.Criminal.StartOperation(source, params, function(status, data)
    TriggerClientEvent('atc:criminal:operation:start:response', source, status, data)
  end)
end)

--- Client requests contraband registration.
AddEventHandler('atc:criminal:contraband:register:request', function(params)
  local source = source
  if type(params) ~= 'table' then return end
  ATC.Criminal.RegisterContraband(source, params, function(status, data)
    TriggerClientEvent('atc:criminal:contraband:register:response', source, status, data)
  end)
end)

--- Law enforcement requests contraband seizure.
AddEventHandler('atc:criminal:contraband:seize:request', function(contrabandId)
  local source = source
  if type(contrabandId) ~= 'string' then return end
  ATC.Criminal.SeizeContraband(source, contrabandId, function(status, data)
    TriggerClientEvent('atc:criminal:contraband:seize:response', source, status, data)
  end)
end)
