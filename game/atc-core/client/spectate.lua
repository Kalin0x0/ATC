ATC = ATC or {}
local _spectating = false

RegisterNetEvent('atc:spectate:start')
RegisterNetEvent('atc:spectate:stop')

AddEventHandler('atc:spectate:start', function(data)
    _spectating = true
    local targetPed = GetPlayerPed(GetPlayerFromServerId(data.targetSource))
    if not DoesEntityExist(targetPed) then return end
    -- Freeze local ped, attach camera to target
    local localPed = PlayerPedId()
    FreezeEntityPosition(localPed, true)
    SetEntityVisible(localPed, false, false)
    NetworkSetInSpectatorMode(true, targetPed)
    SendNUIMessage({ type='ATC_NOTIFICATION', payload={ message='Spectating: '..(data.targetName or '?'), level='info', duration=4000 } })
end)

AddEventHandler('atc:spectate:stop', function()
    _spectating = false
    local localPed = PlayerPedId()
    NetworkSetInSpectatorMode(false, localPed)
    FreezeEntityPosition(localPed, false)
    SetEntityVisible(localPed, true, false)
    SendNUIMessage({ type='ATC_NOTIFICATION', payload={ message='Spectate ended', level='info', duration=3000 } })
end)
