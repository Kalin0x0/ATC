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

-- ── Evidence Collection ───────────────────────────────────────────────────────

-- Evidence collection (near crime scene)
RegisterCommand('evidence', function()
    if not ATC.Core.IsReady() then return end
    local ped    = PlayerPedId()
    local coords = GetEntityCoords(ped)
    -- Collect evidence at current position
    TriggerServerEvent('atc:evidence:collect', { x=coords.x, y=coords.y, z=coords.z })
end, false)
RegisterKeyMapping('evidence', 'Collect Evidence', 'keyboard', 'F12')

RegisterNetEvent('atc:evidence:collected')
AddEventHandler('atc:evidence:collected', function(data)
    local msg = data and data.success and 'Evidence collected: '..tostring(data.evidenceType or 'sample') or 'No evidence found here'
    SendNUIMessage({ type='ATC_NOTIFICATION', payload={ message=msg, level=data and data.success and 'success' or 'warning', duration=4000 } })
end)

-- ── Tactical Systems ──────────────────────────────────────────────────────────

-- Tactical: flash command (throw flashbang effect simulation)
RegisterCommand('atcflash', function()
    if not ATC.Core.IsReady() then return end
    -- Screen flash effect for nearby players
    TriggerServerEvent('atc:tactical:flash', { x=GetEntityCoords(PlayerPedId()).x, y=GetEntityCoords(PlayerPedId()).y, z=GetEntityCoords(PlayerPedId()).z, radius=10.0 })
end, false)

RegisterNetEvent('atc:tactical:flash:effect')
AddEventHandler('atc:tactical:flash:effect', function()
    -- Blind screen briefly — must run inside a thread so Wait() is valid
    CreateThread(function()
        DoScreenFadeOut(100)
        Wait(400)
        DoScreenFadeIn(600)
        ShakeGameplayCam('EXPLOSION_SHAKE', 1.0)
        Citizen.SetTimeout(1500, function() StopGameplayCamShaking(true) end)
    end)
end)
