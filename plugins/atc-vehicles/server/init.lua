-- ATC Vehicles Plugin — Server
-- Server-authoritative vehicle management: spawn, garage retrieve/store, impound.
-- All ownership verified through the API; net IDs and spawn coords are never trusted raw.

ATC             = ATC             or {}
ATC.VehiclesPlugin = ATC.VehiclesPlugin or {}

-- ── Network id registry ───────────────────────────────────────────────────────
-- Storing a vehicle needs the registered vehicleId, but the only handle the
-- client has for a car in the world is its FiveM network id. This maps one to
-- the other. It is filled when the client confirms it created the entity the
-- server told it to, so a client cannot name a vehicle it was never given.
--
-- Server-local and deliberately not persisted: a network id is meaningless
-- across a restart, and every entity is gone by then anyway.
--   _netIds[netId]   = { vehicleId, principalId, at }
--   _pending[key]    = timestamp   key = principalId .. ':' .. vehicleId
local _netIds  = {}
local _pending = {}

local function _pendingKey(principalId, vehicleId)
    return principalId .. ':' .. vehicleId
end

--- Note that this player was authorised to spawn this vehicle. Only a pending
--- entry can later be turned into a registry entry.
local function _markPending(principalId, vehicleId)
    _pending[_pendingKey(principalId, vehicleId)] = os.time()
end

--- Drop registry entries older than the configured TTL, and stale pending
--- spawns the client never confirmed. Called on registration, which is the only
--- point at which the table grows.
local function _pruneNetIds()
    local ttl = ATC.VehiclesPlugin.Config.NetIdTtlSeconds or 21600
    local now = os.time()
    for netId, entry in pairs(_netIds) do
        if (now - entry.at) > ttl then _netIds[netId] = nil end
    end
    for key, at in pairs(_pending) do
        -- A confirmation that has not arrived within a minute is not coming.
        if (now - at) > 60 then _pending[key] = nil end
    end
end

--- Resolve a network id to the vehicle it belongs to, for one principal.
--- Returns nil when the id is unknown or belongs to someone else.
local function _resolveNetId(netId, principalId)
    local entry = _netIds[netId]
    if not entry then return nil end
    if entry.principalId ~= principalId then return nil end
    return entry.vehicleId
end

--- Nearest configured garage to a point, or the fallback when out of range.
--- @return string|nil garageId
local function _garageNear(coords)
    local cfg = ATC.VehiclesPlugin.Config
    if not coords or type(cfg.Garages) ~= 'table' then return cfg.DefaultGarageId end

    local radius = cfg.GarageRadius or 40.0
    local best, bestDist
    for _, g in ipairs(cfg.Garages) do
        local dx, dy, dz = (coords.x or 0) - g.x, (coords.y or 0) - g.y, (coords.z or 0) - g.z
        local dist = math.sqrt(dx * dx + dy * dy + dz * dz)
        if dist <= radius and (not bestDist or dist < bestDist) then
            best, bestDist = g.id, dist
        end
    end
    return best or cfg.DefaultGarageId
end

-- ── Public API ────────────────────────────────────────────────────────────────

--- Request the API to prepare a vehicle spawn record for a player.
--- The actual FiveM entity is spawned client-side after the API confirms.
---
--- Takes a vehicleId, not a model name. The API spawns a vehicle that is
--- already registered and stored — POST /api/v1/vehicles/{vehicleId}/spawn —
--- and rejects anything whose status is not 'stored'. There is no spawn-by-model
--- endpoint, and the previous signature could never have worked: it posted a
--- model to /api/v1/vehicles/spawn, which does not exist.
--- Use GET /api/v1/vehicles?ownerId= to obtain the player's vehicleIds.
--- @param source    number    FiveM player source
--- @param vehicleId string    Registered vehicle id, status 'stored'
--- @param coords    table     { x, y, z, h } — server-derived spawn coordinates
--- @param callback  function  function(vehicleData|nil)
function ATC.VehiclesPlugin.SpawnVehicle(source, vehicleId, coords, callback)
    if type(vehicleId) ~= 'string' or #vehicleId == 0 or #vehicleId > 128 then
        ATC.Log.Warn('vehicles', 'SpawnVehicle — invalid vehicleId', {
            source = source, vehicleId = tostring(vehicleId),
        })
        if callback then callback(nil) end
        return
    end

    local principalId = ATC.Accounts.GetPrincipalId(source)
    if not principalId then
        if callback then callback(nil) end
        return
    end

    -- spawnVehicleSchema: spawnedByPrincipalId, x, y, z, heading optional.
    ATC.HTTP.Post('/api/v1/vehicles/' .. vehicleId .. '/spawn', {
        spawnedByPrincipalId = principalId,
        x                    = (coords and coords.x) or 0.0,
        y                    = (coords and coords.y) or 0.0,
        z                    = (coords and coords.z) or 0.0,
        heading              = coords and coords.h or nil,
    }, function(ok, status, data, err)
        if not ok then
            ATC.Log.Error('vehicles', 'SpawnVehicle API error', {
                source = source, vehicleId = vehicleId, status = status, err = err,
            })
            if callback then callback(nil) end
            return
        end
        -- Authorise the client to report the entity it is about to create.
        _markPending(principalId, vehicleId)
        if callback then callback(data) end
    end)
end

--- atc:vehicles:entity:registered
--- The client reports the network id of a vehicle it created on the server's
--- instruction. Accepted only when the server actually issued that spawn for
--- this player, so a client cannot bind an arbitrary network id — its own or
--- another player's — to a vehicle it does not own.
ATC.Firewall.On('atc:vehicles:entity:registered', {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { window = 10000, max = 5 },
}, function(src, payload)
    if type(payload) ~= 'table' then return end

    local cfg       = ATC.VehiclesPlugin.Config
    local vehicleId = type(payload.vehicleId) == 'string' and payload.vehicleId or ''
    local netId     = tonumber(payload.netId)

    if vehicleId == '' or #vehicleId > cfg.VehicleIdMaxLength then return end
    if not netId or netId < 1 or netId > cfg.VehicleNetIdMax then return end
    netId = math.floor(netId)

    local principalId = ATC.Accounts.GetPrincipalId(src)
    if not principalId then return end

    local key = _pendingKey(principalId, vehicleId)
    if not _pending[key] then
        ATC.Log.Warn('vehicles', 'entity:registered — no pending spawn for this player and vehicle', {
            source = src, vehicleId = vehicleId, netId = netId,
        })
        return
    end
    _pending[key] = nil

    _pruneNetIds()
    _netIds[netId] = { vehicleId = vehicleId, principalId = principalId, at = os.time() }

    ATC.Log.Debug('vehicles', 'Network id registered', {
        source = src, vehicleId = vehicleId, netId = netId,
    })
end)

-- ── Firewall Events ───────────────────────────────────────────────────────────

--- atc:vehicles:garage:list
--- Client requests the full list of vehicles owned by the player's account.
--- Used by the /garage command to populate the garage menu.
ATC.Firewall.On('atc:vehicles:garage:list', {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { window = 5000, max = 5 },
}, function(src, _payload)
    local principalId = ATC.Accounts.GetPrincipalId(src)
    if not principalId then return end

    ATC.HTTP.Get('/api/v1/vehicles?ownerId=' .. principalId, function(ok, status, data, err)
        if not ok then
            ATC.Log.Error('vehicles', 'garage:list API error', {
                source = src, status = status, err = err,
            })
        end
        TriggerClientEvent('atc:vehicles:garage:list:response', src, {
            success  = ok,
            vehicles = ok and (data and data.vehicles or {}) or {},
        })
    end)
end)

--- atc:vehicles:garage:retrieve
--- Client requests to take a vehicle out of the garage.
--- Rate limited to 3 per 30 s to prevent rapid garage cycling.
ATC.Firewall.On('atc:vehicles:garage:retrieve', {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { window = 30000, max = 3 },
}, function(src, payload)
    if type(payload) ~= 'table' then return end

    local vehicleId = payload.vehicleId
    if type(vehicleId) ~= 'string' or #vehicleId == 0
        or #vehicleId > ATC.VehiclesPlugin.Config.VehicleIdMaxLength then
        ATC.Log.Warn('vehicles', 'garage:retrieve — invalid vehicleId', {
            source = src, vehicleId = tostring(vehicleId),
        })
        return
    end

    local principalId = ATC.Accounts.GetPrincipalId(src)
    if not principalId then return end

    ATC.HTTP.Post('/api/v1/vehicles/' .. vehicleId .. '/retrieve', {
        principalId = principalId,
    }, function(ok, status, data, err)
        if not ok then
            ATC.Log.Error('vehicles', 'garage:retrieve API error', {
                source = src, vehicleId = vehicleId, status = status, err = err,
            })
        else
            -- Authorise this player to report the entity the client is about to
            -- create, so the car can be parked again later.
            _markPending(principalId, vehicleId)
        end
        TriggerClientEvent('atc:vehicles:garage:retrieve:response', src, {
            success   = ok,
            vehicle   = ok and data or nil,
            vehicleId = ok and vehicleId or nil,
        })
    end)
end)

--- atc:vehicles:garage:store
--- Client requests to store the currently occupied vehicle in the garage.
--- vehicleNetId is validated: must be a positive integer within FiveM limits.
ATC.Firewall.On('atc:vehicles:garage:store', {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { window = 10000, max = 5 },
}, function(src, payload)
    if type(payload) ~= 'table' then return end

    local vehicleNetId = tonumber(payload.vehicleNetId)
    if not vehicleNetId or vehicleNetId < 1
        or vehicleNetId > ATC.VehiclesPlugin.Config.VehicleNetIdMax then
        ATC.Log.Warn('vehicles', 'garage:store — invalid vehicleNetId', {
            source = src, vehicleNetId = tostring(payload.vehicleNetId),
        })
        return
    end
    vehicleNetId = math.floor(vehicleNetId)

    local principalId = ATC.Accounts.GetPrincipalId(src)
    if not principalId then return end

    -- Resolve the network id the client reported when it created the entity.
    -- An id this player never had, or one that has aged out, is refused here
    -- rather than sent on as someone else's vehicle.
    local vehicleId = _resolveNetId(vehicleNetId, principalId)
    if not vehicleId then
        ATC.Log.Warn('vehicles', 'garage:store — unknown or foreign network id', {
            source = src, vehicleNetId = vehicleNetId,
        })
        TriggerClientEvent('atc:vehicles:garage:store:response', src, {
            success = false,
            reason  = 'unknown_vehicle',
        })
        return
    end

    -- The garage is chosen from the player's own position, never from the
    -- payload: letting the client name a garage would let it park anywhere.
    local ped     = GetPlayerPed(src)
    local pcoords = ped and GetEntityCoords(ped) or nil
    local garageId = _garageNear(pcoords and { x = pcoords.x, y = pcoords.y, z = pcoords.z } or nil)

    if not garageId then
        TriggerClientEvent('atc:vehicles:garage:store:response', src, {
            success = false,
            reason  = 'not_at_garage',
        })
        return
    end

    -- storeVehicleSchema: garageId + storedByPrincipalId, the rest optional.
    ATC.HTTP.Post('/api/v1/vehicles/' .. vehicleId .. '/store', {
        garageId            = garageId,
        storedByPrincipalId = principalId,
    }, function(ok, status, _data, err)
        if not ok then
            ATC.Log.Error('vehicles', 'garage:store API error', {
                source = src, vehicleId = vehicleId, garageId = garageId,
                status = status, err = err,
            })
        else
            -- The car is off the map; its network id means nothing now.
            _netIds[vehicleNetId] = nil
        end

        TriggerClientEvent('atc:vehicles:garage:store:response', src, {
            success  = ok,
            garageId = ok and garageId or nil,
        })
    end)
end)

--- atc:vehicles:impound
--- Internal server-side event — NOT exposed to clients.
--- Triggered by other server modules (e.g. law enforcement, parking enforcement).
AddEventHandler('atc:vehicles:impound', function(vehicleId, reason)
    if type(vehicleId) ~= 'string' or #vehicleId == 0 then
        ATC.Log.Warn('vehicles', 'impound — missing vehicleId')
        return
    end

    ATC.HTTP.Post('/api/v1/vehicles/' .. vehicleId .. '/impound', {
        reason = type(reason) == 'string' and reason or 'police',
    }, function(ok, status, data, err)
        if not ok then
            ATC.Log.Error('vehicles', 'impound API error', {
                vehicleId = vehicleId, status = status, err = err,
            })
        end
    end)
end)

--- atc:vehicles:garage:payFine
--- Client requests to pay the impound fine for a vehicle.
ATC.Firewall.On('atc:vehicles:garage:payFine', {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { window = 10000, max = 3 },
}, function(src, payload)
    if type(payload) ~= 'table' then return end
    local vehicleId = payload.vehicleId
    if type(vehicleId) ~= 'string' or #vehicleId == 0 then return end

    local principalId = ATC.Accounts.GetPrincipalId(src)
    if not principalId then return end

    ATC.HTTP.Post('/api/v1/vehicles/' .. vehicleId .. '/impound/pay', {
        principalId = principalId,
    }, function(ok, status, data, err)
        if not ok then
            ATC.Log.Error('vehicles', 'payFine API error', {
                source = src, vehicleId = vehicleId, status = status, err = err,
            })
        end
        TriggerClientEvent('atc:vehicles:garage:result', src, {
            success  = ok,
            message  = ok and 'Fine paid. Vehicle returned to garage.' or (data and data.error or 'Payment failed.'),
            vehicles = ok and data and data.vehicles or nil,
        })
    end)
end)

ATC.Log.Info('vehicles', 'atc-vehicles server initialised')
