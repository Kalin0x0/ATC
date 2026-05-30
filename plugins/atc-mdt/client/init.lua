-- ============================================================
-- ATC MDT — Client Init
-- Plugin: atc-mdt v0.1.0
-- ============================================================

local _open = false

-- Toggle MDT open/close
RegisterCommand('mdt', function()
    _open = not _open
    SetNuiFocus(_open, _open)
    if _open then
        TriggerServerEvent('atc:mdt:open')
    else
        SendNUIMessage({ type = 'ATC_MDT_CLOSE' })
    end
end, false)

RegisterKeyMapping('mdt', 'Open MDT', 'keyboard', 'F9')

-- NUI callbacks
RegisterNUICallback('atc:mdt:close', function(_, cb)
    _open = false
    SetNuiFocus(false, false)
    cb('ok')
end)

RegisterNUICallback('atc:mdt:search:person', function(data, cb)
    TriggerServerEvent('atc:mdt:search:person', data)
    cb('ok')
end)

RegisterNUICallback('atc:mdt:warrant:create', function(data, cb)
    TriggerServerEvent('atc:mdt:warrant:create', data)
    cb('ok')
end)

-- Register incoming server events
for _, e in ipairs({ 'atc:mdt:data', 'atc:mdt:search:result', 'atc:mdt:warrant:created' }) do
    RegisterNetEvent(e)
end

AddEventHandler('atc:mdt:data', function(d)
    SendNUIMessage({ type = 'ATC_MDT_OPEN', payload = d })
end)

AddEventHandler('atc:mdt:search:result', function(d)
    SendNUIMessage({ type = 'ATC_MDT_SEARCH_RESULT', payload = d })
end)

AddEventHandler('atc:mdt:warrant:created', function(d)
    SendNUIMessage({ type = 'ATC_MDT_WARRANT_CREATED', payload = d })
end)
