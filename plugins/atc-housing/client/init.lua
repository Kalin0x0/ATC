-- ATC Housing Plugin — Client
-- Receives server-validated responses only. No local ownership logic.

ATC        = ATC        or {}
ATC.Housing = ATC.Housing or {}

-- ── Event Handlers ────────────────────────────────────────────────────────────

--- atc:housing:property:enter:response
--- Server reply after an access-check. Notify player with the result.
RegisterNetEvent('atc:housing:property:enter:response')
AddEventHandler('atc:housing:property:enter:response', function(data)
    if type(data) ~= 'table' then return end

    if data.allowed then
        SendNUIMessage({
            type    = 'ATC_NOTIFICATION',
            payload = {
                message  = 'Property entered',
                level    = 'info',
                duration = 2000,
            },
        })
    else
        SendNUIMessage({
            type    = 'ATC_NOTIFICATION',
            payload = {
                message  = 'Access denied',
                level    = 'error',
                duration = 3000,
            },
        })
    end
end)

--- atc:housing:property:lock:response
--- Server reply after a lock/unlock request.
RegisterNetEvent('atc:housing:property:lock:response')
AddEventHandler('atc:housing:property:lock:response', function(data)
    if type(data) ~= 'table' then return end

    local message = data.locked and 'Property locked' or 'Property unlocked'
    local level   = data.success and 'info' or 'error'

    if not data.success then
        message = 'Lock change failed'
    end

    SendNUIMessage({
        type    = 'ATC_NOTIFICATION',
        payload = {
            message  = message,
            level    = level,
            duration = 2000,
        },
    })

    -- Forward lock result to the housing panel
    SendNUIMessage({
        type    = 'ATC_HOUSING_LOCK_RESULT',
        payload = {
            propertyId = data.propertyId,
            locked     = data.locked,
        },
    })
end)

-- ── NUI / Housing Panel ───────────────────────────────────────────────────

--- /housing  (F3)
--- Opens the property management panel.
RegisterCommand('housing', function()
    SetNuiFocus(true, true)
    TriggerServerEvent('atc:housing:properties:list')
    SendNUIMessage({ type = 'ATC_HOUSING_OPEN', payload = { properties = {} } })
end, false)
RegisterKeyMapping('housing', 'Open Housing', 'keyboard', 'F3')

RegisterNetEvent('atc:housing:properties:list:response')
AddEventHandler('atc:housing:properties:list:response', function(data)
    SendNUIMessage({ type = 'ATC_HOUSING_OPEN', payload = data })
end)

RegisterNUICallback('atc:housing:close', function(_, cb)
    SetNuiFocus(false, false)
    cb('ok')
end)

RegisterNUICallback('atc:housing:lock', function(data, cb)
    TriggerServerEvent('atc:housing:property:lock', data)
    cb('ok')
end)

RegisterNUICallback('atc:housing:enter', function(data, cb)
    TriggerServerEvent('atc:housing:property:enter', data)
    cb('ok')
end)
