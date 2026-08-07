-- ATC Vehicles Plugin — Client
-- Displays garage interaction feedback and provides the /garage command.
-- No vehicle ownership logic runs on the client.

ATC             = ATC             or {}
ATC.VehiclesPlugin = ATC.VehiclesPlugin or {}

-- ── Event Handlers ────────────────────────────────────────────────────────────

--- atc:vehicles:garage:list:response
--- Server reply with the full vehicle list for the garage UI.
RegisterNetEvent('atc:vehicles:garage:list:response')
AddEventHandler('atc:vehicles:garage:list:response', function(data)
    if type(data) ~= 'table' then return end
    SendNUIMessage({
        type    = 'ATC_VEHICLES_GARAGE_LIST',
        payload = data.vehicles or {},
    })
end)

--- Create the vehicle entity and report its network id back to the server.
--- The server can only park a car again if it knows which registered vehicle a
--- network id belongs to, and the network id only exists once the entity does —
--- so the client is the only place this mapping can start.
--- Runs in its own thread: model loading yields, and the event handler must not.
--- @param vehicleId string  Registered vehicle id the server just retrieved
--- @param vehicle   table   Vehicle record from the API (model, plate, …)
local function _createAndReport(vehicleId, vehicle)
    CreateThread(function()
        local model = vehicle and (vehicle.model or vehicle.modelName)
        if type(model) ~= 'string' or model == '' then return end

        local hash = GetHashKey(model)
        RequestModel(hash)

        -- Give up rather than spin forever on a model the client does not have.
        local waited = 0
        while not HasModelLoaded(hash) and waited < 5000 do
            Wait(50)
            waited = waited + 50
        end
        if not HasModelLoaded(hash) then
            SetModelAsNoLongerNeeded(hash)
            return
        end

        local ped    = PlayerPedId()
        local pos    = GetEntityCoords(ped)
        local head   = GetEntityHeading(ped)
        local entity = CreateVehicle(hash, pos.x, pos.y, pos.z, head, true, false)
        SetModelAsNoLongerNeeded(hash)
        if not entity or entity == 0 then return end

        if vehicle.plate then SetVehicleNumberPlateText(entity, tostring(vehicle.plate)) end

        TriggerServerEvent('atc:vehicles:entity:registered', {
            vehicleId = vehicleId,
            netId     = NetworkGetNetworkIdFromEntity(entity),
        })
    end)
end

--- atc:vehicles:garage:retrieve:response
--- Server reply after a garage retrieval request.
RegisterNetEvent('atc:vehicles:garage:retrieve:response')
AddEventHandler('atc:vehicles:garage:retrieve:response', function(data)
    if type(data) ~= 'table' then return end

    if data.success and data.vehicleId then
        _createAndReport(data.vehicleId, data.vehicle or {})
    end

    if data.success and data.vehicle then
        SendNUIMessage({
            type    = 'ATC_NOTIFICATION',
            payload = {
                message  = 'Vehicle retrieved from garage',
                level    = 'success',
                duration = 3000,
            },
        })
    else
        SendNUIMessage({
            type    = 'ATC_NOTIFICATION',
            payload = {
                message  = 'Could not retrieve vehicle',
                level    = 'error',
                duration = 3000,
            },
        })
    end
end)

--- atc:vehicles:garage:capture:response
--- Server reply to /atc_garage_here. The line is also printed on the server
--- console; this copy goes to the client console so it can be read in-game.
RegisterNetEvent('atc:vehicles:garage:capture:response')
AddEventHandler('atc:vehicles:garage:capture:response', function(data)
    if type(data) ~= 'table' or type(data.line) ~= 'string' then return end
    print('[ATC:garage] ' .. data.line)
    SendNUIMessage({
        type    = 'ATC_NOTIFICATION',
        payload = {
            message  = 'Garage position captured — see console (F8)',
            level    = 'success',
            duration = 4000,
        },
    })
end)

--- atc:vehicles:garage:store:response
--- Server reply after a garage store request.
RegisterNetEvent('atc:vehicles:garage:store:response')
AddEventHandler('atc:vehicles:garage:store:response', function(data)
    if type(data) ~= 'table' then return end

    local ok      = data.success == true
    local message = ok and 'Vehicle stored in garage' or 'Could not store vehicle'
    local level   = ok and 'success' or 'error'

    SendNUIMessage({
        type    = 'ATC_NOTIFICATION',
        payload = {
            message  = message,
            level    = level,
            duration = 3000,
        },
    })
end)

-- ── Commands ──────────────────────────────────────────────────────────────────

--- /garage
--- Opens the garage menu. The server handles vehicle ownership lookup;
--- the client sends an empty vehicleId to signal a full garage listing request.
local _garageNuiOpen = false

RegisterCommand('garage', function()
    if not ATC.Core.IsReady() then
        SendNUIMessage({
            type    = 'ATC_NOTIFICATION',
            payload = {
                message  = 'Not connected — please wait',
                level    = 'warning',
                duration = 2000,
            },
        })
        return
    end

    _garageNuiOpen = true
    SetNuiFocus(true, true)
    -- The server resolves the owned vehicle list from the principal ID.
    TriggerServerEvent('atc:vehicles:garage:list')
    SendNUIMessage({ type = 'ATC_GARAGE_OPEN', payload = { vehicles = {} } })
end, false)

RegisterKeyMapping('garage', 'Open Garage', 'keyboard', 'F1')

--- /atc_garage_here <id> [label]
--- Prints the player's current position as a ready-to-paste line for
--- ATC.VehiclesPlugin.Config.Garages. Stand where the garage belongs and run it.
--- Admin-only: the server checks the atc.admin ace before answering, so an
--- ordinary player running this gets nothing back.
RegisterCommand('atc_garage_here', function(_, args)
    local id    = args[1]
    local label = table.concat(args, ' ', 2)
    if not id or id == '' then
        SendNUIMessage({
            type    = 'ATC_NOTIFICATION',
            payload = {
                message  = 'Usage: /atc_garage_here <id> [label]',
                level    = 'warning',
                duration = 4000,
            },
        })
        return
    end

    local coords = GetEntityCoords(PlayerPedId())
    TriggerServerEvent('atc:vehicles:garage:capture', {
        id    = id,
        label = label ~= '' and label or id,
        x     = coords.x,
        y     = coords.y,
        z     = coords.z,
    })
end, false)

-- ── NUI Callbacks ─────────────────────────────────────────────────────────────

RegisterNUICallback('atc:vehicles:close', function(_, cb)
    _garageNuiOpen = false
    SetNuiFocus(false, false)
    cb('ok')
end)

RegisterNUICallback('atc:vehicles:retrieve', function(data, cb)
    TriggerServerEvent('atc:vehicles:garage:retrieve', data)
    cb('ok')
end)

RegisterNUICallback('atc:vehicles:store', function(data, cb)
    TriggerServerEvent('atc:vehicles:garage:store', data)
    cb('ok')
end)

RegisterNUICallback('atc:vehicles:payFine', function(data, cb)
    TriggerServerEvent('atc:vehicles:garage:payFine', data)
    cb('ok')
end)

-- Push updated vehicle list into NUI when server responds
AddEventHandler('atc:vehicles:garage:list:response', function(data)
    if not _garageNuiOpen then return end
    SendNUIMessage({ type = 'ATC_GARAGE_OPEN', payload = data })
end)

-- Push action result (retrieve/store/fine) into NUI
AddEventHandler('atc:vehicles:garage:retrieve:response', function(data)
    SendNUIMessage({ type = 'ATC_GARAGE_RESULT', payload = {
        success = data and data.success,
        message = data and data.success and 'Vehicle retrieved.' or 'Could not retrieve vehicle.',
    }})
end)

AddEventHandler('atc:vehicles:garage:store:response', function(data)
    SendNUIMessage({ type = 'ATC_GARAGE_RESULT', payload = {
        success = data and data.success,
        message = data and data.success and 'Vehicle stored.' or 'Could not store vehicle.',
    }})
end)

-- Close NUI on resource stop
AddEventHandler('onResourceStop', function(resourceName)
    if resourceName == GetCurrentResourceName() and _garageNuiOpen then
        SetNuiFocus(false, false)
        _garageNuiOpen = false
    end
end)
