ATC = ATC or {}
local _phoneOpen = false

-- ─── Internal helpers ──────────────────────────────────────────────────────────
local function openPhone(open)
    _phoneOpen = open
    SetNuiFocus(open, open)
    SendNUIMessage({ type = open and 'ATC_PHONE_OPEN' or 'ATC_PHONE_CLOSE' })
    if open then
        TriggerServerEvent('atc:phone:contacts:get')
    end
end

-- ─── Commands ──────────────────────────────────────────────────────────────────
RegisterCommand('phone', function()
    openPhone(not _phoneOpen)
end, false)

RegisterKeyMapping('phone', 'Toggle Phone', 'keyboard', 'NUMPAD0')

-- ─── NUI Callbacks ─────────────────────────────────────────────────────────────
RegisterNUICallback('atc:phone:close', function(_, cb)
    openPhone(false)
    cb('ok')
end)

RegisterNUICallback('atc:phone:message:send', function(data, cb)
    TriggerServerEvent('atc:phone:message:send', data)
    cb('ok')
end)

RegisterNUICallback('atc:phone:bank:get', function(_, cb)
    TriggerServerEvent('atc:phone:bank:get')
    cb('ok')
end)

RegisterNUICallback('atc:phone:911', function(data, cb)
    TriggerServerEvent('atc:phone:911', data)
    cb('ok')
end)

-- ─── Net Events (register before adding handlers) ──────────────────────────────
local netEvents = {
    'atc:phone:contacts:response',
    'atc:phone:message:sent',
    'atc:phone:message:received',
    'atc:phone:bank:response',
    'atc:phone:911:sent',
}

for _, evt in ipairs(netEvents) do
    RegisterNetEvent(evt)
end

-- ─── Event Handlers → forward to NUI ──────────────────────────────────────────
AddEventHandler('atc:phone:contacts:response', function(data)
    SendNUIMessage({ type = 'ATC_PHONE_CONTACTS', payload = data })
end)

AddEventHandler('atc:phone:message:sent', function(data)
    SendNUIMessage({ type = 'ATC_PHONE_MESSAGE_SENT', payload = data })
end)

AddEventHandler('atc:phone:message:received', function(data)
    SendNUIMessage({ type = 'ATC_PHONE_MESSAGE_IN', payload = data })
    -- Also surface a heads-up notification
    SendNUIMessage({
        type    = 'ATC_NOTIFICATION',
        payload = {
            message  = 'New message from ' .. tostring(data.from or '?'),
            level    = 'info',
            duration = 5000,
        },
    })
end)

AddEventHandler('atc:phone:bank:response', function(data)
    SendNUIMessage({ type = 'ATC_PHONE_BANK', payload = data })
end)

AddEventHandler('atc:phone:911:sent', function(data)
    SendNUIMessage({ type = 'ATC_PHONE_911_SENT', payload = data })
end)

-- ─── Escape key closes phone ───────────────────────────────────────────────────
CreateThread(function()
    while true do
        Wait(0)
        if _phoneOpen and IsControlJustReleased(0, 200) then  -- 200 = ESCAPE
            openPhone(false)
        end
    end
end)
