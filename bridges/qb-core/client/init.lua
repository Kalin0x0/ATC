-- bridges/qb-core/client/init.lua
-- QB-Core → ATC Client Bridge
-- Intercepts QB-Core client-side notification events and forwards them to the
-- ATC NUI notification system so servers that still call QB notify functions
-- get the ATC-styled toast UI instead of a QB overlay.

-- ─── Notifications ────────────────────────────────────────────────────────────
-- QB fires QBCore:Notify on the client whenever a server or client script calls
-- QBCore.Functions.Notify().  We map QB's notifyType strings to ATC levels.
AddEventHandler('QBCore:Notify', function(text, notifyType, duration)
    local level = 'info'
    if notifyType == 'error' then
        level = 'error'
    elseif notifyType == 'success' then
        level = 'success'
    elseif notifyType == 'warning' then
        level = 'warning'
    end

    SendNUIMessage({
        type    = 'ATC_NOTIFICATION',
        payload = {
            message  = text     or '',
            level    = level,
            duration = duration or 5000,
        },
    })
end)
