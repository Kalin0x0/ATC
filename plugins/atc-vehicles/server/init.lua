-- ATC Vehicles Plugin — Server
-- Server-authoritative vehicle management: spawn, garage retrieve/store, impound.
-- All ownership verified through the API; net IDs and spawn coords are never trusted raw.

ATC             = ATC             or {}
ATC.VehiclesPlugin = ATC.VehiclesPlugin or {}

-- Set once the unsupported-store warning has been emitted, so a player parking
-- repeatedly does not flood the log.
local _warnedStore = false

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
        if callback then callback(data) end
    end)
end

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
        end
        TriggerClientEvent('atc:vehicles:garage:retrieve:response', src, {
            success = ok,
            vehicle = ok and data or nil,
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

    -- Storing cannot be forwarded to the API yet, and no path change fixes it.
    -- POST /api/v1/vehicles/{vehicleId}/store needs the registered vehicleId
    -- plus a garageId (storeVehicleSchema). All this handler has is the FiveM
    -- network id of the entity in the world and the player's principal.
    -- Nothing maps a network id back to a vehicleId: that mapping would have to
    -- be recorded when the vehicle is spawned, and the client does not send a
    -- garage either. Both are gameplay state this plugin does not yet keep, so
    -- the old POST to /api/v1/vehicles/store — a route that does not exist —
    -- is not replaced with a guess.
    if not _warnedStore then
        _warnedStore = true
        ATC.Log.Warn('vehicles', 'Garage store is not persisted: the API needs a vehicleId and a garageId, and this handler only has a network id. Requires a netId-to-vehicleId mapping recorded at spawn time.')
    end

    TriggerClientEvent('atc:vehicles:garage:store:response', src, {
        success = false,
        reason  = 'not_supported',
    })
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
