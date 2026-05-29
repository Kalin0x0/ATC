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
end)
