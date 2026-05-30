-- ============================================================
-- ATC Criminal — Client Init
-- Plugin: atc-criminal v0.1.0
-- ============================================================

-- Register incoming server events
RegisterNetEvent('atc:criminal:robbery:response')
RegisterNetEvent('atc:criminal:robbery:payout')
RegisterNetEvent('atc:criminal:drug:crafted')

AddEventHandler('atc:criminal:robbery:response', function(data)
    if data and data.success then
        SendNUIMessage({
            type = 'ATC_NOTIFICATION',
            payload = {
                message  = 'Robbery started! Police alerted.',
                level    = 'warning',
                duration = 5000
            }
        })
    else
        SendNUIMessage({
            type = 'ATC_NOTIFICATION',
            payload = {
                message  = 'Cannot start robbery: ' .. (data and data.reason or 'unknown'),
                level    = 'error',
                duration = 3000
            }
        })
    end
end)

AddEventHandler('atc:criminal:robbery:payout', function(data)
    if data and data.amount then
        SendNUIMessage({
            type = 'ATC_NOTIFICATION',
            payload = {
                message  = 'Robbery complete! Earned $' .. tostring(data.amount),
                level    = 'success',
                duration = 6000
            }
        })
    end
end)

AddEventHandler('atc:criminal:drug:crafted', function(data)
    local success = data and data.success
    local msg     = success and ('Crafted ' .. tostring(data.drugType)) or 'Crafting failed'
    SendNUIMessage({
        type = 'ATC_NOTIFICATION',
        payload = {
            message  = msg,
            level    = success and 'success' or 'error',
            duration = 4000
        }
    })
end)

-- ── Commands ──────────────────────────────────────────────────────────────────

RegisterCommand('robbery', function(_, args)
    local locationId = args[1]
    if not locationId then return end
    TriggerServerEvent('atc:criminal:robbery:start', { locationId = locationId })
end, false)

-- ── Smuggling ─────────────────────────────────────────────────────────────────

RegisterNetEvent('atc:criminal:smuggle:response')
RegisterNetEvent('atc:criminal:smuggle:payout')
AddEventHandler('atc:criminal:smuggle:response', function(data)
    if data and data.success then
        SendNUIMessage({ type='ATC_NOTIFICATION', payload={ message='Smuggle run started! Deliver '..tostring(data.itemType)..' to '..tostring(data.destination)..' within '..tostring(data.timeLimit)..'s', level='warning', duration=8000 } })
    end
end)
AddEventHandler('atc:criminal:smuggle:payout', function(data)
    SendNUIMessage({ type='ATC_NOTIFICATION', payload={ message='Smuggle complete! Earned $'..tostring(data and data.amount or 0), level='success', duration=6000 } })
end)
RegisterCommand('smuggle', function(src, args)
    TriggerServerEvent('atc:criminal:smuggle:start', { itemType='drugs', destination=args[1] or 'port' })
end, false)

-- ── Black Market ──────────────────────────────────────────────────────────────

RegisterCommand('blackmarket', function()
    if not ATC.Core.IsReady() then return end
    TriggerServerEvent('atc:criminal:blackmarket:catalog')
end, false)

RegisterNetEvent('atc:criminal:blackmarket:catalog:response')
AddEventHandler('atc:criminal:blackmarket:catalog:response', function(data)
    -- Use notification as lightweight UI
    local items = data and data.items or {}
    local msg = 'Black Market: '
    for i, item in ipairs(items) do
        if i > 3 then msg = msg .. '...'; break end
        msg = msg .. item.name .. ' ($' .. tostring(item.price) .. ') '
    end
    SendNUIMessage({ type='ATC_NOTIFICATION', payload={ message=msg, level='warning', duration=8000 } })
end)

-- ── Gang Management ───────────────────────────────────────────────────────────

RegisterCommand('gangmenu', function()
    if not ATC.Core.IsReady() then return end
    TriggerServerEvent('atc:gang:info:request')
end, false)
RegisterKeyMapping('gangmenu', 'Gang Menu', 'keyboard', 'G')

RegisterNetEvent('atc:gang:info:response')
AddEventHandler('atc:gang:info:response', function(data)
    if not data then
        SendNUIMessage({
            type    = 'ATC_NOTIFICATION',
            payload = { message = 'You are not in a gang', level = 'info', duration = 3000 }
        })
        return
    end
    SendNUIMessage({
        type    = 'ATC_NOTIFICATION',
        payload = {
            message  = 'Gang: ' .. tostring(data.name or '?')
                    .. ' | Members: ' .. tostring(data.memberCount or 0)
                    .. ' | Territory: ' .. tostring(data.zones or 0) .. ' zones',
            level    = 'info',
            duration = 6000
        }
    })
end)

RegisterNetEvent('atc:gang:territory:captured')
AddEventHandler('atc:gang:territory:captured', function(data)
    SendNUIMessage({
        type    = 'ATC_NOTIFICATION',
        payload = {
            message  = 'Your gang captured: ' .. tostring(data and data.zoneName or 'zone'),
            level    = 'success',
            duration = 8000
        }
    })
end)
