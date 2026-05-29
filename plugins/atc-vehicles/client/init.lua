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

    -- The server resolves the owned vehicle list from the principal ID.
    -- Use the dedicated garage:list event to fetch the full vehicle list.
    TriggerServerEvent('atc:vehicles:garage:list')
end, false)
