-- ATC Vehicle Simulation Runtime Bridge
-- Fuel, damage, registration, pursuits, traffic violations.
-- All vehicle-to-server state flows through this bridge; clients never set fuel/damage directly.

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

ATC.VehicleRuntime = {}

--- Sync fuel state from server tick.
--- @param vehicleRuntimeId string
--- @param currentFuel      number
--- @param fuelGrade        string  'regular'|'premium'|'diesel'|'electric'
--- @param consumptionRate  number
--- @param cb               function callback(status, fuel)
function ATC.VehicleRuntime.SyncFuel(vehicleRuntimeId, currentFuel, fuelGrade, consumptionRate, cb)
  apiPost('/api/v1/vehicles/runtime/fuel/sync', {
    vehicleRuntimeId = vehicleRuntimeId,
    currentFuel      = currentFuel,
    fuelGrade        = fuelGrade,
    consumptionRate  = consumptionRate,
  }, cb)
end

--- Consume fuel for a vehicle (server-authoritative).
--- @param vehicleRuntimeId string
--- @param amount           number  litres consumed
--- @param cb               function callback(status, fuel)
function ATC.VehicleRuntime.ConsumeFuel(vehicleRuntimeId, amount, cb)
  apiPost('/api/v1/vehicles/runtime/fuel/consume', {
    vehicleRuntimeId = vehicleRuntimeId,
    amount           = amount,
  }, cb)
end

--- Refuel a vehicle at a station.
--- @param vehicleRuntimeId string
--- @param amount           number  litres added
--- @param cb               function callback(status, fuel)
function ATC.VehicleRuntime.Refuel(vehicleRuntimeId, amount, cb)
  apiPost('/api/v1/vehicles/runtime/fuel/refuel', {
    vehicleRuntimeId = vehicleRuntimeId,
    amount           = amount,
  }, cb)
end

--- Get fuel state for a vehicle.
--- @param vehicleRuntimeId string
--- @param cb               function callback(status, fuel)
function ATC.VehicleRuntime.GetFuel(vehicleRuntimeId, cb)
  apiGet('/api/v1/vehicles/runtime/fuel/' .. vehicleRuntimeId, cb)
end

--- Sync damage state from server.
--- @param vehicleRuntimeId string
--- @param damage           table   { engineHealth, bodyHealth, fuelTankHealth, isEngineDestroyed, isOnFire }
--- @param cb               function callback(status, damage)
function ATC.VehicleRuntime.SyncDamage(vehicleRuntimeId, damage, cb)
  damage.vehicleRuntimeId = vehicleRuntimeId
  apiPost('/api/v1/vehicles/runtime/damage/sync', damage, cb)
end

--- Apply damage delta to a vehicle (FOR UPDATE locked).
--- @param vehicleRuntimeId string
--- @param engineDelta      number|nil
--- @param bodyDelta        number|nil
--- @param fuelTankDelta    number|nil
--- @param cb               function callback(status, damage)
function ATC.VehicleRuntime.ApplyDamage(vehicleRuntimeId, engineDelta, bodyDelta, fuelTankDelta, cb)
  apiPost('/api/v1/vehicles/runtime/damage/apply', {
    vehicleRuntimeId = vehicleRuntimeId,
    engineDelta      = engineDelta,
    bodyDelta        = bodyDelta,
    fuelTankDelta    = fuelTankDelta,
  }, cb)
end

--- Register a vehicle plate.
--- @param vehicleId        string
--- @param ownerSource      number  server source of owner
--- @param plate            string
--- @param expiresAt        string  ISO 8601 datetime
--- @param cb               function callback(status, registration)
function ATC.VehicleRuntime.RegisterVehicle(vehicleId, ownerSource, plate, expiresAt, cb)
  local principalId = ATC.Accounts.GetPrincipalId(ownerSource)
  if not principalId then
    if cb then cb(403, nil) end
    return
  end
  apiPost('/api/v1/vehicles/runtime/registration/register', {
    vehicleId         = vehicleId,
    ownerPrincipalId  = principalId,
    plate             = plate,
    expiresAt         = expiresAt,
  }, cb)
end

--- Validate that a vehicle has an active, non-expired registration.
--- @param vehicleId string
--- @param cb        function callback(status, registration)
function ATC.VehicleRuntime.ValidateRegistration(vehicleId, cb)
  apiGet('/api/v1/vehicles/runtime/registration/' .. vehicleId .. '/validate', cb)
end

--- Start a vehicle pursuit. Emits atc:vehicle:pursuit:started.
--- @param vehicleRuntimeId             string
--- @param suspectSource                number   FiveM server id of suspect
--- @param officerSource                number   FiveM server id of initiating officer
--- @param pursuitNonce                 string   idempotency nonce
--- @param agencyId                     string|nil
--- @param cb                           function callback(status, pursuit)
function ATC.VehicleRuntime.StartPursuit(vehicleRuntimeId, suspectSource, officerSource, pursuitNonce, agencyId, cb)
  local suspectId = ATC.Accounts.GetPrincipalId(suspectSource)
  local officerId = ATC.Accounts.GetPrincipalId(officerSource)
  if not suspectId or not officerId then
    if cb then cb(403, nil) end
    return
  end
  local ped = GetPlayerPed(suspectSource)
  local coords = GetEntityCoords(ped)
  apiPost('/api/v1/vehicles/runtime/pursuits', {
    vehicleRuntimeId              = vehicleRuntimeId,
    suspectPrincipalId            = suspectId,
    initiatingOfficerPrincipalId  = officerId,
    initiatingAgencyId            = agencyId,
    pursuitNonce                  = pursuitNonce,
    startLocationX                = coords.x,
    startLocationY                = coords.y,
    startLocationZ                = coords.z,
  }, cb)
end

--- End a pursuit. Emits atc:vehicle:pursuit:ended.
--- @param pursuitId  string
--- @param toStatus   string  'ended'|'escaped'|'terminated'
--- @param notes      string|nil
--- @param cb         function callback(status, pursuit)
function ATC.VehicleRuntime.EndPursuit(pursuitId, toStatus, notes, cb)
  apiPatch('/api/v1/vehicles/runtime/pursuits/' .. pursuitId .. '/end', {
    pursuitId = pursuitId,
    toStatus  = toStatus,
    notes     = notes,
  }, cb)
end

--- Record a traffic violation.
--- @param source     number   officer or camera source (nil for automated)
--- @param params     table    { vehicleId, principalId, violationType, speedRecorded?, speedLimit?, fineAmount }
--- @param cb         function callback(status, violation)
function ATC.VehicleRuntime.RecordViolation(source, params, cb)
  if source then
    local ped    = GetPlayerPed(source)
    local coords = GetEntityCoords(ped)
    params.locationX = coords.x
    params.locationY = coords.y
    params.locationZ = coords.z
    params.recordedByPrincipalId = ATC.Accounts.GetPrincipalId(source)
  end
  apiPost('/api/v1/vehicles/runtime/violations', params, cb)
end

--- Send vehicle heartbeat (metrics update).
--- @param vehicleRuntimeId   string
--- @param distanceDelta      number|nil
--- @param topSpeedSnapshot   number|nil
--- @param collisionIncrement boolean|nil
function ATC.VehicleRuntime.Heartbeat(vehicleRuntimeId, distanceDelta, topSpeedSnapshot, collisionIncrement)
  apiPost('/api/v1/vehicles/runtime/heartbeat', {
    vehicleRuntimeId   = vehicleRuntimeId,
    distanceDelta      = distanceDelta,
    topSpeedSnapshot   = topSpeedSnapshot,
    collisionIncrement = collisionIncrement,
  }, nil)
end

-- ── Server Events ─────────────────────────────────────────────────────────────

AddEventHandler('atc:vehicle:pursuit:started', function(payload)
  ATC.Log.Info('[VehicleRuntime] Pursuit started: ' .. (payload.id or '?'))
end)

AddEventHandler('atc:vehicle:pursuit:ended', function(payload)
  ATC.Log.Info('[VehicleRuntime] Pursuit ended: ' .. (payload.id or '?') .. ' status=' .. (payload.status or '?'))
end)

AddEventHandler('atc:vehicle:registration:expired', function(payload)
  ATC.Log.Warn('[VehicleRuntime] Registration expired for vehicle: ' .. (payload.vehicleId or '?'))
end)
