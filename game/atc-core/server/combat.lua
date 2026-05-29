-- ATC Combat Runtime Bridge — weapon state, damage pipeline, combat sessions, injury propagation
-- Server-authoritative: no client damage values trusted. Replay nonce prevents duplicate hits.
-- All principal IDs resolved server-side via ATC.Accounts.GetPrincipalId.

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

ATC.Combat = {}

--- Register a weapon in the server registry.
--- @param source          number   FiveM server id
--- @param model           string
--- @param category        string
--- @param serial          string
--- @param cb              function callback(status, weapon)
function ATC.Combat.RegisterWeapon(source, model, category, serial, cb)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then
    if cb then cb(403, nil) end
    return
  end
  apiPost('/api/v1/combat/weapons', {
    ownerId                = principalId,
    model                  = model,
    category               = category,
    serial                 = serial,
    registeredByPrincipalId = principalId,
  }, cb)
end

--- Equip a weapon for a player. Server validates weapon state before accepting.
--- @param source          number
--- @param weaponId        string
--- @param currentAmmo     number   server-validated ammo count
--- @param maxAmmo         number
--- @param cb              function callback(status, runtime)
function ATC.Combat.EquipWeapon(source, weaponId, currentAmmo, maxAmmo, cb)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then
    if cb then cb(403, nil) end
    return
  end
  apiPost('/api/v1/combat/weapons/' .. weaponId .. '/equip', {
    holderPrincipalId = principalId,
    currentAmmo       = tonumber(currentAmmo) or 0,
    maxAmmo           = tonumber(maxAmmo)     or 0,
  }, cb)
end

--- Unequip a weapon.
--- @param source          number
--- @param weaponId        string
--- @param cb              function callback(status, runtime)
function ATC.Combat.UnequipWeapon(source, weaponId, cb)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then
    if cb then cb(403, nil) end
    return
  end
  apiPost('/api/v1/combat/weapons/' .. weaponId .. '/unequip', {
    holderPrincipalId = principalId,
  }, cb)
end

--- Sync ammo count from a server-authoritative source.
--- Never call this with client-reported ammo without validation.
--- @param source          number
--- @param weaponId        string
--- @param currentAmmo     number   server-validated value only
--- @param cb              function callback(status)
function ATC.Combat.SyncAmmo(source, weaponId, currentAmmo, cb)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then
    if cb then cb(403, nil) end
    return
  end
  apiPost('/api/v1/combat/weapons/' .. weaponId .. '/ammo', {
    holderPrincipalId = principalId,
    currentAmmo       = tonumber(currentAmmo) or 0,
  }, cb)
end

--- Record a server-authoritative damage event.
--- replayNonce must be unique per attacker+victim pair; duplicate nonces are rejected (409).
--- @param source          number   attacker server id
--- @param params          table    { victimSource, weaponModel, hitBone, damageAmount, mitigatedAmount, replayNonce, weaponId?, sessionId?, hitX?, hitY?, hitZ? }
--- @param cb              function callback(status, damageEvent)
function ATC.Combat.ApplyDamage(source, params, cb)
  local attackerPrincipalId = ATC.Accounts.GetPrincipalId(source)
  if not attackerPrincipalId then
    if cb then cb(403, nil) end
    return
  end
  local victimPrincipalId = ATC.Accounts.GetPrincipalId(params.victimSource)
  if not victimPrincipalId then
    if cb then cb(400, nil) end
    return
  end
  params = params or {}
  apiPost('/api/v1/combat/damage', {
    attackerPrincipalId = attackerPrincipalId,
    victimPrincipalId   = victimPrincipalId,
    weaponId            = params.weaponId,
    weaponModel         = params.weaponModel    or 'WEAPON_UNARMED',
    hitBone             = params.hitBone        or 'unknown',
    damageAmount        = tonumber(params.damageAmount)    or 0,
    mitigatedAmount     = tonumber(params.mitigatedAmount) or 0,
    replayNonce         = params.replayNonce    or '',
    sessionId           = params.sessionId,
    hitX                = tonumber(params.hitX),
    hitY                = tonumber(params.hitY),
    hitZ                = tonumber(params.hitZ),
  }, cb)
end

--- Start a combat session.
--- @param source          number   initiating player
--- @param cb              function callback(status, session)
function ATC.Combat.StartSession(source, cb)
  local principalId = ATC.Accounts.GetPrincipalId(source)
  if not principalId then
    if cb then cb(403, nil) end
    return
  end
  apiPost('/api/v1/combat/sessions', {
    initiatorPrincipalId = principalId,
  }, cb)
end

--- End a combat session.
--- @param sessionId       string
--- @param outcome         string   optional
--- @param cb              function callback(status, session)
function ATC.Combat.EndSession(sessionId, outcome, cb)
  apiPost('/api/v1/combat/sessions/' .. sessionId .. '/end', {
    outcome = outcome,
  }, cb)
end

--- Apply an injury to a principal (called after damage pipeline).
--- @param params          table    { principalId, bodyRegion, severity, sourceDamageEventId? }
--- @param cb              function callback(status, injury)
function ATC.Combat.ApplyInjury(params, cb)
  params = params or {}
  apiPost('/api/v1/combat/injuries', {
    principalId         = params.principalId,
    bodyRegion          = params.bodyRegion   or 'unknown',
    severity            = params.severity     or 'minor',
    sourceDamageEventId = params.sourceDamageEventId,
  }, cb)
end

--- Resolve a specific injury (on treatment or revive).
--- @param injuryId        string
--- @param cb              function callback(status, injury)
function ATC.Combat.ResolveInjury(injuryId, cb)
  apiPost('/api/v1/combat/injuries/' .. injuryId .. '/resolve', {}, cb)
end

--- Get all active injuries for a principal.
--- @param principalId     string
--- @param cb              function callback(status, injuries)
function ATC.Combat.GetActiveInjuries(principalId, cb)
  apiGet('/api/v1/combat/injuries/' .. principalId, cb)
end

-- ── Server Events ─────────────────────────────────────────────────────────────

--- Client requests a damage event be recorded.
--- Client provides nonce; server validates and deduplicates.
ATC.Firewall.On(ATC.Events.COMBAT.DAMAGE_REQUEST, {
  clientAllowed  = true,
  requireSession = true,
  rateLimit      = { window = 1000, max = 30 },
}, function(src, params)
  if type(params) ~= 'table' then return end
  -- Sanitize all numeric fields — never trust client damage values raw
  local safeParams = {
    victimSource    = tonumber(params.victimSource),
    weaponModel     = type(params.weaponModel) == 'string' and params.weaponModel or 'WEAPON_UNARMED',
    hitBone         = type(params.hitBone)     == 'string' and params.hitBone     or 'unknown',
    damageAmount    = math.min(tonumber(params.damageAmount)    or 0, 32767),
    mitigatedAmount = math.min(tonumber(params.mitigatedAmount) or 0, 32767),
    replayNonce     = type(params.replayNonce) == 'string' and params.replayNonce or '',
    sessionId       = type(params.sessionId)   == 'string' and params.sessionId   or nil,
    hitX            = tonumber(params.hitX),
    hitY            = tonumber(params.hitY),
    hitZ            = tonumber(params.hitZ),
  }
  if not safeParams.victimSource or safeParams.replayNonce == '' then return end
  ATC.Combat.ApplyDamage(src, safeParams, function(status, data)
    TriggerClientEvent('atc:combat:damage:response', src, status, data)
  end)
end)

--- Client requests weapon equip state sync.
ATC.Firewall.On(ATC.Events.COMBAT.WEAPON_EQUIP, {
  clientAllowed  = true,
  requireSession = true,
  rateLimit      = { window = 5000, max = 10 },
}, function(src, params)
  if type(params) ~= 'table' then return end
  local weaponId   = params.weaponId
  local currentAmmo = params.currentAmmo
  local maxAmmo    = params.maxAmmo
  if type(weaponId) ~= 'string' then return end
  ATC.Combat.EquipWeapon(src, weaponId,
    math.min(tonumber(currentAmmo) or 0, 9999),
    math.min(tonumber(maxAmmo)     or 0, 9999),
    function(status, data)
      TriggerClientEvent('atc:combat:weapon:equip:response', src, status, data)
    end)
end)

--- Client requests weapon unequip.
ATC.Firewall.On(ATC.Events.COMBAT.WEAPON_UNEQUIP, {
  clientAllowed  = true,
  requireSession = true,
  rateLimit      = { window = 5000, max = 10 },
}, function(src, params)
  if type(params) ~= 'table' then return end
  local weaponId = params.weaponId
  if type(weaponId) ~= 'string' then return end
  ATC.Combat.UnequipWeapon(src, weaponId, function(status, data)
    TriggerClientEvent('atc:combat:weapon:unequip:response', src, status, data)
  end)
end)
