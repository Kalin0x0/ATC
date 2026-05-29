-- atc-dispatch — Client Init
-- Receives dispatch call broadcasts and presents them in the NUI.
-- Registers the /911 command for players to send emergency calls.

-- ── Incoming Dispatch Call ────────────────────────────────────────────────────
RegisterNetEvent(ATC.Events.DISPATCH.CALL_RECEIVED)
AddEventHandler(ATC.Events.DISPATCH.CALL_RECEIVED, function(data)
    if not data then return end
    -- Push call data to the dispatch board NUI
    SendNUIMessage({ type = 'ATC_DISPATCH_CALL', payload = data })
    -- Show on-screen notification for all LEOs / dispatch personnel
    SendNUIMessage({ type = 'ATC_NOTIFICATION', payload = {
        message  = '[DISPATCH] ' .. (data.description or 'Call received'),
        level    = 'warning',
        duration = 8000,
    }})
end)

-- ── 911 Command ───────────────────────────────────────────────────────────────
-- Players type /911 <message> to send an emergency call.
-- Minimum 3-character message guard prevents empty spam.
RegisterCommand('911', function(source, args)
    if not ATC.Core or not ATC.Core.IsReady() then return end
    local msg = table.concat(args, ' ')
    if #msg < 3 then return end
    TriggerServerEvent('atc:dispatch:911', { message = msg })
end, false)
