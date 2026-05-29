-- ATC Core — Client Economy
-- Caches the player wallet as pushed by the server.
-- The server is the sole authority on balances; this module never modifies money.

ATC         = ATC         or {}
ATC.Economy = ATC.Economy or {}

local _wallet = { cash = 0, bank = 0, dirty = 0 }

-- ── Public API ────────────────────────────────────────────────────────────────

--- Returns { cash, bank, dirty } wallet snapshot.
function ATC.Economy.GetWallet()
    return _wallet
end

--- Replaces the wallet cache and notifies the NUI.
--- Called internally from net-event handlers.
function ATC.Economy.SetWallet(data)
    if not data then return end
    _wallet.cash  = data.cash  or 0
    _wallet.bank  = data.bank  or 0
    _wallet.dirty = data.dirty or 0
    SendNUIMessage({ type = 'ATC_WALLET_UPDATE', payload = _wallet })
end

-- ── Network events ────────────────────────────────────────────────────────────

-- Full balance snapshot (response to atc:economy:balance:request)
RegisterNetEvent(ATC.Events.ECONOMY.BALANCE_UPDATE)
AddEventHandler(ATC.Events.ECONOMY.BALANCE_UPDATE, function(data)
    ATC.Economy.SetWallet(data)
end)

-- Incremental balance change (e.g., purchase, salary, fine)
RegisterNetEvent(ATC.Events.ECONOMY.MONEY_CHANGED)
AddEventHandler(ATC.Events.ECONOMY.MONEY_CHANGED, function(data)
    ATC.Economy.SetWallet(data)
end)

-- When a character is selected the wallet is not yet loaded — request a push.
-- We listen on the CHARACTER.SELECTED net-event which fires after the server
-- has committed the character.  The server then responds with BALANCE_UPDATE.
-- NOTE: RegisterNetEvent for CHARACTER.SELECTED is already called in characters.lua;
-- a second RegisterNetEvent call is harmless but redundant. AddEventHandler is fine
-- to call multiple times for the same event in FiveM.
AddEventHandler(ATC.Events.CHARACTER.SELECTED, function(data)
    if data and data.success then
        TriggerServerEvent(ATC.Events.ECONOMY.BALANCE_REQUEST)
    end
end)
