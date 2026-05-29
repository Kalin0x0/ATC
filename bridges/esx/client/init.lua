-- bridges/esx/client/init.lua
-- ESX → ATC Client Bridge
-- Intercepts ESX client-side notification events and forwards them to the
-- ATC NUI notification system.

-- ─── Notifications ────────────────────────────────────────────────────────────
-- ESX fires esx:showNotification whenever a script calls ESX.ShowNotification().
-- We route it through ATC's NUI messenger so the player sees the ATC-styled
-- toast UI regardless of which framework originally sent the notification.
AddEventHandler('esx:showNotification', function(msg)
    SendNUIMessage({
        type    = 'ATC_NOTIFICATION',
        payload = {
            message  = msg or '',
            level    = 'info',
            duration = 4000,
        },
    })
end)
