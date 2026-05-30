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
