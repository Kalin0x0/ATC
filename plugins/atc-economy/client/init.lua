-- ATC Economy Plugin — Client
-- Receives ATM transaction results from the server and surfaces
-- them to the player via NUI notification messages.
-- The client does NOT initiate any balance mutations.
-- ATM command opens the NUI ATM panel (F5 keybinding).

-- ── Server → Client events ────────────────────────────────────────────────────

--- Server sends the result of an ATM withdraw or deposit.
RegisterNetEvent('atc:economy:atm:response')
AddEventHandler('atc:economy:atm:response', function(data)
    if not data then return end

    if data.success then
        local typeLabel = (data.type == 'deposit') and 'Deposit' or 'Withdrawal'
        local amountStr = data.amount and ('$' .. tostring(data.amount)) or ''
        SendNUIMessage({
            type    = 'ATC_NOTIFICATION',
            payload = {
                message  = typeLabel .. ' successful' .. (amountStr ~= '' and (' — ' .. amountStr) or '') .. '.',
                level    = 'success',
                duration = 3000,
            },
        })
    else
        local msg = (data.message) or 'Transaction failed.'
        SendNUIMessage({
            type    = 'ATC_NOTIFICATION',
            payload = {
                message  = msg,
                level    = 'error',
                duration = 4000,
            },
        })
    end
end)

-- ── ATM NUI panel ─────────────────────────────────────────────────────────────

--- Open the ATM NUI panel with the player's current balances.
--- Triggers a server-side balance fetch and then shows the panel.
RegisterCommand('atm', function()
    TriggerServerEvent('atc:phone:bank:get')  -- reuse bank data; server replies via atc:economy:atm:open
    SetNuiFocus(true, true)
    SendNUIMessage({
        type    = 'ATC_ECONOMY_ATM_OPEN',
        payload = {
            cash = ATC.SDK.Economy.GetCash(),
            bank = ATC.SDK.Economy.GetBank(),
        },
    })
end, false)

RegisterKeyMapping('atm', 'Open ATM', 'keyboard', 'F5')

--- Close callback from the NUI layer.
RegisterNUICallback('atc:economy:atm:close', function(_, cb)
    SetNuiFocus(false, false)
    cb('ok')
end)

--- Forward ATM result from server back to the NUI toast.
RegisterNetEvent('atc:economy:atm:result')
AddEventHandler('atc:economy:atm:result', function(data)
    if not data then return end
    SendNUIMessage({
        type    = 'ATC_ECONOMY_ATM_RESULT',
        payload = data,
    })
end)
