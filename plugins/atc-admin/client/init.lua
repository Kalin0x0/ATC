-- atc-admin / client / init.lua
-- In-game NUI admin panel — toggle with /adminmenu or F6

ATC = ATC or {}
local _open = false

-- ── Open/Close command ────────────────────────────────────────────────────────
RegisterCommand('adminmenu', function()
    if not IsPlayerAceAllowed(tostring(PlayerId()), 'atc.admin') then
        SendNUIMessage({
            type    = 'ATC_NOTIFICATION',
            payload = { message = 'Access denied', level = 'error', duration = 3000 },
        })
        return
    end

    _open = not _open
    SetNuiFocus(_open, _open)

    if _open then
        -- Build a client-side player list (pings are client-side reads; auth is server-side)
        local players = {}
        for _, pid in ipairs(GetActivePlayers()) do
            table.insert(players, {
                id   = GetPlayerServerId(pid),
                name = GetPlayerName(pid) or '?',
                ping = GetPlayerPing(pid),
            })
        end
        SendNUIMessage({ type = 'ATC_ADMIN_OPEN', payload = { players = players } })
    else
        SendNUIMessage({ type = 'ATC_ADMIN_CLOSE' })
    end
end, false)

RegisterKeyMapping('adminmenu', 'Admin Menu', 'keyboard', 'F6')

-- ── NUI Callbacks ─────────────────────────────────────────────────────────────
RegisterNUICallback('atc:admin:close', function(_, cb)
    _open = false
    SetNuiFocus(false, false)
    cb('ok')
end)

RegisterNUICallback('atc:admin:spectate', function(d, cb)
    TriggerServerEvent('atc:spectate:start', { targetSource = d and d.id })
    cb('ok')
end)

RegisterNUICallback('atc:admin:bring', function(d, cb)
    TriggerServerEvent('atc:admin:bring', d)
    cb('ok')
end)

RegisterNUICallback('atc:admin:goto', function(d, cb)
    TriggerServerEvent('atc:admin:goto', d)
    cb('ok')
end)

RegisterNUICallback('atc:admin:freeze', function(d, cb)
    TriggerServerEvent('atc:admin:freeze', d)
    cb('ok')
end)

RegisterNUICallback('atc:admin:kick', function(d, cb)
    TriggerServerEvent('atc:admin:kick', d)
    cb('ok')
end)

RegisterNUICallback('atc:admin:ban', function(d, cb)
    TriggerServerEvent('atc:admin:ban', d)
    cb('ok')
end)

RegisterNUICallback('atc:admin:announce', function(d, cb)
    TriggerServerEvent('atc:admin:announce', d)
    cb('ok')
end)

RegisterNUICallback('atc:admin:reviveAll', function(_, cb)
    TriggerServerEvent('atc:admin:reviveAll')
    cb('ok')
end)

RegisterNUICallback('atc:admin:clearArea', function(_, cb)
    TriggerServerEvent('atc:admin:clearArea')
    cb('ok')
end)

-- ── Close NUI on resource stop ────────────────────────────────────────────────
AddEventHandler('onResourceStop', function(resourceName)
    if resourceName == GetCurrentResourceName() and _open then
        SetNuiFocus(false, false)
        _open = false
    end
end)
