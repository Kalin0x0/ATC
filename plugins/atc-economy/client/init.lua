-- ATC Economy Plugin — Client
-- Receives ATM transaction results from the server and surfaces
-- them to the player via NUI notification messages.
-- The client does NOT initiate any balance mutations.

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
