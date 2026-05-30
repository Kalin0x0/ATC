local _inRange  = false
local _shopOpen = false
local SHOP_COORDS = vector3(24.47, -1346.64, 29.5)

-- Show [E] prompt near shop using interaction system
CreateThread(function()
    while true do
        local dist = #(GetEntityCoords(PlayerPedId()) - SHOP_COORDS)
        if dist < 3.0 and not _inRange then
            _inRange = true
            ATC.Interaction.RegisterZone('example_shop', SHOP_COORDS, 3.0, '24/7 Shop', function()
                _shopOpen = true
                TriggerServerEvent('atc:example_shop:catalog')
                SetNuiFocus(true, true)
                SendNUIMessage({ type='ATC_NOTIFICATION', payload={ message='Shop opened', level='info', duration=2000 } })
            end)
        elseif dist >= 3.0 and _inRange then
            _inRange = false
            ATC.Interaction.Remove('example_shop')
        end
        Wait(500)
    end
end)

for _, e in ipairs({'atc:example_shop:catalog:response','atc:example_shop:buy:result'}) do RegisterNetEvent(e) end

-- NUI close callback: released focus so the player can move again
RegisterNUICallback('atc:example_shop:close', function(_, cb)
    _shopOpen = false
    SetNuiFocus(false, false)
    SendNUIMessage({ type='ATC_EXAMPLE_SHOP_CLOSE' })
    cb('ok')
end)

AddEventHandler('atc:example_shop:catalog:response', function(items)
    -- Just show notification for now (UI would be implemented in ui/ folder)
    local names = {}
    for _, i in ipairs(items or {}) do table.insert(names, i.name) end
    SendNUIMessage({ type='ATC_NOTIFICATION', payload={ message='Shop: '..table.concat(names, ', '), level='info', duration=5000 } })
end)

AddEventHandler('atc:example_shop:buy:result', function(data)
    -- Close shop NUI after purchase result so focus is always released
    _shopOpen = false
    SetNuiFocus(false, false)
    if data and data.success then
        SendNUIMessage({ type='ATC_NOTIFICATION', payload={ message='Bought: '..tostring(data.item and data.item.name or 'item'), level='success', duration=3000 } })
    else
        SendNUIMessage({ type='ATC_NOTIFICATION', payload={ message='Cannot buy: '..(data and data.reason or 'error'), level='error', duration=3000 } })
    end
end)
