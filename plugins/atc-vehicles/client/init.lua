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

--- atc:vehicles:garage:retrieve:response
--- Server reply after a garage retrieval request.
RegisterNetEvent('atc:vehicles:garage:retrieve:response')
AddEventHandler('atc:vehicles:garage:retrieve:response', function(data)
    if type(data) ~= 'table' then return end

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
