-- ============================================================
-- ATC EMS — Client Init
-- Plugin: atc-ems v0.1.0
-- ============================================================

local _open = false

-- Check nearest downed player and open EMS panel
RegisterCommand('emscheck', function()
    local ped      = PlayerPedId()
    local myCoords = GetEntityCoords(ped)
    local nearest, nearestDist = nil, 5.0

    for _, pid in ipairs(GetActivePlayers()) do
        if pid ~= PlayerId() then
            local targetPed = GetPlayerPed(pid)
            if IsEntityDead(targetPed) then
                local d = #(myCoords - GetEntityCoords(targetPed))
                if d < nearestDist then
                    nearestDist = d
                    nearest     = GetPlayerServerId(pid)
                end
            end
        end
    end

    if nearest then
        TriggerServerEvent('atc:ems:patient:info', { targetSource = nearest })
        _open = true
        SetNuiFocus(true, true)
        SendNUIMessage({ type = 'ATC_EMS_OPEN', payload = { targetSource = nearest } })
    end
end, false)

RegisterKeyMapping('emscheck', 'EMS Check Patient', 'keyboard', 'F10')

-- NUI callbacks
RegisterNUICallback('atc:ems:close', function(_, cb)
    _open = false
    SetNuiFocus(false, false)
    cb('ok')
end)

RegisterNUICallback('atc:ems:treat', function(data, cb)
    TriggerServerEvent('atc:ems:treat', data)
    cb('ok')
end)

-- Register incoming server events
for _, e in ipairs({ 'atc:ems:treated', 'atc:ems:patient:response' }) do
    RegisterNetEvent(e)
end

AddEventHandler('atc:ems:patient:response', function(d)
    SendNUIMessage({ type = 'ATC_EMS_PATIENT', payload = d })
end)

AddEventHandler('atc:ems:treated', function(d)
    if d and d.revived then
        SendNUIMessage({
            type = 'ATC_NOTIFICATION',
            payload = {
                message  = 'You have been treated by EMS',
                level    = 'success',
                duration = 5000
            }
        })
    end
    -- Always close the panel on any server response (success or failure)
    -- to prevent NUI focus being permanently locked when treatment fails.
    if _open then
        SendNUIMessage({ type = 'ATC_EMS_TREATED', payload = d })
        _open = false
        SetNuiFocus(false, false)
    end
end)

-- Escape key closes EMS panel (mirrors phone/mdt escape handling)
CreateThread(function()
    while true do
        if _open then
            Wait(0)
            if IsControlJustReleased(0, 200) then  -- 200 = ESCAPE
                _open = false
                SetNuiFocus(false, false)
                SendNUIMessage({ type = 'ATC_EMS_CLOSE' })
            end
        else
            Wait(500)
        end
    end
end)

-- ── Ambulance Call System ─────────────────────────────────────────────────────

RegisterCommand('ambulance', function()
    TriggerServerEvent('atc:ems:ambulance:request', { x=GetEntityCoords(PlayerPedId()).x, y=GetEntityCoords(PlayerPedId()).y, z=GetEntityCoords(PlayerPedId()).z })
end, false)

RegisterNetEvent('atc:ems:ambulance:dispatched')
AddEventHandler('atc:ems:ambulance:dispatched', function(data)
    SendNUIMessage({ type='ATC_NOTIFICATION', payload={ message='Ambulance dispatched — ETA: ~3 min', level='info', duration=6000 } })
end)

-- ── Hospital Gameplay ─────────────────────────────────────────────────────────

local HOSPITAL_COORDS = vector3(295.84, -1447.53, 29.99)
local _inHospitalRange = false

CreateThread(function()
    while true do
        if ATC.Core.IsReady() and ATC.Characters and ATC.Characters.IsSpawned() then
            local dist = #(GetEntityCoords(PlayerPedId()) - HOSPITAL_COORDS)
            if dist < 5.0 and not _inHospitalRange then
                _inHospitalRange = true
                ATC.Interaction.RegisterZone('hospital_checkin', HOSPITAL_COORDS, 5.0, 'Check in to Hospital', function()
                    TriggerServerEvent('atc:hospital:checkin')
                end)
            elseif dist >= 5.0 and _inHospitalRange then
                _inHospitalRange = false
                ATC.Interaction.Remove('hospital_checkin')
            end
        end
        Wait(1000)
    end
end)

RegisterNetEvent('atc:hospital:checkin:result')
AddEventHandler('atc:hospital:checkin:result', function(data)
    if data and data.success then
        SendNUIMessage({ type='ATC_NOTIFICATION', payload={ message='Hospital check-in complete. Injuries treated.', level='success', duration=5000 } })
        -- Restore health
        SetEntityHealth(PlayerPedId(), 200)
    end
end)
