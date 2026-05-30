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
        Wait(0)
        if _open and IsControlJustReleased(0, 200) then  -- 200 = ESCAPE
            _open = false
            SetNuiFocus(false, false)
            SendNUIMessage({ type = 'ATC_EMS_CLOSE' })
        end
    end
end)
