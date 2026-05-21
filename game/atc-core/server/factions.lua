-- ATC Faction & Territory Control Runtime Bridge
-- Factions, territory claims, conflicts, resource nodes, influence.
-- Territory control is server-authoritative. Clients never mutate faction state directly.

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

ATC.Factions = {}

--- Create a new faction.
--- @param source      number   leader's FiveM server id
--- @param name        string
--- @param tag         string   max 8 chars
--- @param factionType string   'gang'|'police'|'military'|'government'|'civilian'|'other'
--- @param colorHex    string|nil  '#RRGGBB'
--- @param description string|nil
--- @param cb          function callback(status, faction)
function ATC.Factions.Create(source, name, tag, factionType, colorHex, description, cb)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then
    if cb then cb(403, nil) end
    return
  end
  apiPost('/api/v1/factions', {
    name              = name,
    tag               = tag,
    leaderPrincipalId = principalId,
    factionType       = factionType,
    colorHex          = colorHex,
    description       = description,
  }, cb)
end

--- Get a faction by its DB id.
--- @param factionId string
--- @param cb        function callback(status, faction)
function ATC.Factions.Get(factionId, cb)
  apiGet('/api/v1/factions/' .. factionId, cb)
end

--- Add a player to a faction.
--- @param source      number   requester (capability check)
--- @param factionId   string
--- @param targetSource number   player to add
--- @param cb          function callback(status, nil)
function ATC.Factions.AddMember(source, factionId, targetSource, cb)
  local targetId = ATC.Accounts.GetPrincipalId(targetSource)
  if not targetId then
    if cb then cb(403, nil) end
    return
  end
  apiPost('/api/v1/factions/' .. factionId .. '/members', {
    factionId   = factionId,
    principalId = targetId,
  }, cb)
end

--- Disband a faction.
--- @param source    number   requester (capability check)
--- @param factionId string
--- @param cb        function callback(status, nil)
function ATC.Factions.Disband(source, factionId, cb)
  apiDelete('/api/v1/factions/' .. factionId, cb)
end

--- Claim a territory for a faction (supersedes existing claim).
--- @param source      number   initiating player
--- @param territoryId string   game territory_id
--- @param factionId   string
--- @param claimType   string   'capture'|'purchase'|'grant'|'inheritance'
--- @param claimNonce  string   idempotency nonce
--- @param notes       string|nil
--- @param cb          function callback(status, claim)
function ATC.Factions.ClaimTerritory(source, territoryId, factionId, claimType, claimNonce, notes, cb)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then
    if cb then cb(403, nil) end
    return
  end
  apiPost('/api/v1/factions/territories/claim', {
    territoryId          = territoryId,
    factionId            = factionId,
    claimedByPrincipalId = principalId,
    claimType            = claimType,
    claimNonce           = claimNonce,
    notes                = notes,
  }, cb)
end

--- Get a territory.
--- @param territoryId string   game territory_id (not DB id)
--- @param cb          function callback(status, territory)
function ATC.Factions.GetTerritory(territoryId, cb)
  apiGet('/api/v1/factions/territories/' .. territoryId, cb)
end

--- Start a faction conflict over a territory.
--- @param source           number   initiating player's server id
--- @param territoryId      string
--- @param attackerFactionId string
--- @param defenderFactionId string|nil
--- @param conflictType     string   'territory_capture'|'resource_dispute'|'retaliation'|'war'|'skirmish'
--- @param conflictNonce    string
--- @param notes            string|nil
--- @param cb               function callback(status, conflict)
function ATC.Factions.StartConflict(source, territoryId, attackerFactionId, defenderFactionId, conflictType, conflictNonce, notes, cb)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then
    if cb then cb(403, nil) end
    return
  end
  apiPost('/api/v1/factions/conflicts', {
    territoryId            = territoryId,
    attackerFactionId      = attackerFactionId,
    defenderFactionId      = defenderFactionId,
    initiatingPrincipalId  = principalId,
    conflictType           = conflictType,
    conflictNonce          = conflictNonce,
    notes                  = notes,
  }, cb)
end

--- Resolve a conflict.
--- @param conflictId string
--- @param outcome    string  'attacker_won'|'defender_won'|'stalemate'|'aborted'
--- @param notes      string|nil
--- @param cb         function callback(status, conflict)
function ATC.Factions.ResolveConflict(conflictId, outcome, notes, cb)
  apiPost('/api/v1/factions/conflicts/' .. conflictId .. '/resolve', {
    conflictId = conflictId,
    outcome    = outcome,
    notes      = notes,
  }, cb)
end

--- Capture a resource node for a faction.
--- @param source   number   capturing player's server id
--- @param nodeId   string   game node_id
--- @param factionId string
--- @param cb       function callback(status, node)
function ATC.Factions.CaptureResourceNode(source, nodeId, factionId, cb)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then
    if cb then cb(403, nil) end
    return
  end
  apiPost('/api/v1/factions/resource-nodes/capture', {
    nodeId               = nodeId,
    factionId            = factionId,
    capturingPrincipalId = principalId,
  }, cb)
end

--- Get a resource node.
--- @param nodeId string   game node_id
--- @param cb     function callback(status, node)
function ATC.Factions.GetResourceNode(nodeId, cb)
  apiGet('/api/v1/factions/resource-nodes/' .. nodeId, cb)
end

--- Get influence records for a faction across all territories.
--- @param factionId string
--- @param cb        function callback(status, records)
function ATC.Factions.GetInfluence(factionId, cb)
  apiGet('/api/v1/factions/' .. factionId .. '/influence', cb)
end

-- ── Server Events ─────────────────────────────────────────────────────────────

AddEventHandler('atc:faction:created', function(payload)
  ATC.Log.Info('[Factions] Faction created: ' .. (payload.name or '?') .. ' [' .. (payload.tag or '?') .. ']')
end)

AddEventHandler('atc:faction:disbanded', function(payload)
  ATC.Log.Info('[Factions] Faction disbanded: ' .. (payload.id or '?'))
end)

AddEventHandler('atc:faction:territory:claimed', function(payload)
  ATC.Log.Info('[Factions] Territory claimed: territory=' .. (payload.territoryId or '?') .. ' faction=' .. (payload.factionId or '?'))
end)

AddEventHandler('atc:faction:territory:released', function(payload)
  ATC.Log.Info('[Factions] Territory released: territory=' .. (payload.territoryId or '?'))
end)

AddEventHandler('atc:faction:conflict:started', function(payload)
  ATC.Log.Info('[Factions] Conflict started: ' .. (payload.id or '?') .. ' type=' .. (payload.conflictType or '?'))
end)

AddEventHandler('atc:faction:conflict:resolved', function(payload)
  ATC.Log.Info('[Factions] Conflict resolved: ' .. (payload.id or '?') .. ' outcome=' .. (payload.outcome or '?'))
end)

AddEventHandler('atc:faction:resource:captured', function(payload)
  ATC.Log.Info('[Factions] Resource node captured: nodeId=' .. (payload.nodeId or '?') .. ' faction=' .. (payload.factionId or '?'))
end)
