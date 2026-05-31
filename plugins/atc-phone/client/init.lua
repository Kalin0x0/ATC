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

-- ─── GPS / Location Sharing (Maps app) ─────────────────────────────────────────
-- Set a waypoint from the phone Maps app
RegisterNUICallback('atc:phone:gps:waypoint', function(data, cb)
    local x = tonumber(data and data.x)
    local y = tonumber(data and data.y)
    if x and y then SetNewWaypoint(x, y) end
    cb('ok')
end)

-- Share current location with a contact
RegisterNUICallback('atc:phone:location:share', function(data, cb)
    local coords = GetEntityCoords(PlayerPedId())
    TriggerServerEvent('atc:phone:location:share', { to = data and data.to, x = coords.x, y = coords.y, z = coords.z })
    cb('ok')
end)

-- ─── Net Events (register before adding handlers) ──────────────────────────────
local netEvents = {
    'atc:phone:contacts:response',
    'atc:phone:message:sent',
    'atc:phone:message:received',
    'atc:phone:bank:response',
    'atc:phone:911:sent',
    'atc:phone:location:received',
    'atc:phone:location:shared',
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

-- A contact shared their live location with us: drop a routed blip + notify
AddEventHandler('atc:phone:location:received', function(d)
    if not d then return end
    local blip = AddBlipForCoord(d.x, d.y, d.z or 0.0)
    SetBlipSprite(blip, 280)
    SetBlipColour(blip, 3)
    SetBlipScale(blip, 0.9)
    BeginTextCommandSetBlipName('STRING')
    AddTextComponentString('Shared: ' .. tostring(d.from or '?'))
    EndTextCommandSetBlipName(blip)
    SetBlipRoute(blip, true)
    SendNUIMessage({
        type    = 'ATC_NOTIFICATION',
        payload = {
            message  = tostring(d.from or 'Someone') .. ' shared their location',
            level    = 'info',
            duration = 6000,
        },
    })
    -- Auto-remove after 5 minutes
    Citizen.SetTimeout(300000, function()
        if DoesBlipExist(blip) then RemoveBlip(blip) end
    end)
end)

-- Confirmation that our location was shared
AddEventHandler('atc:phone:location:shared', function(d)
    SendNUIMessage({
        type    = 'ATC_NOTIFICATION',
        payload = {
            message  = 'Location shared with ' .. tostring(d and d.to or 'contact'),
            level    = 'success',
            duration = 3000,
        },
    })
end)

-- ─── Escape key closes phone ───────────────────────────────────────────────────
-- The NUI already closes on ESC via its keydown handler (atc:phone:close callback);
-- this is a Lua-side fallback. Only spin the per-frame check while the phone is
-- actually open — otherwise idle at 500ms to avoid a permanent tight loop.
CreateThread(function()
    while true do
        if _phoneOpen then
            Wait(0)
            if IsControlJustReleased(0, 200) then  -- 200 = ESCAPE
                openPhone(false)
            end
        else
            Wait(500)
        end
    end
end)
