-- ATC Economy Plugin — Server
-- Exposes ATC.EconomyPlugin.Pay / Charge for other server-side plugins,
-- and handles ATM withdraw/deposit client events.
-- All balance mutations are server-authoritative via the economy API.
-- Delegates to ATC.Economy.Credit / ATC.Economy.Debit from atc-core.

ATC = ATC or {}
ATC.EconomyPlugin = ATC.EconomyPlugin or {}

-- ── Amount validation ─────────────────────────────────────────────────────────

--- Validate that a value is a positive integer.
--- @param v any
--- @return boolean
local function _isPositiveInt(v)
    local n = tonumber(v)
    if not n then return false end
    if n <= 0 then return false end
    if math.floor(n) ~= n then return false end
    return true
end

-- ── Public plugin API ─────────────────────────────────────────────────────────

--- Credit (pay) a player. Delegates to ATC.Economy.Credit.
--- Intended to be called by other server-side plugins.
--- @param source  number  FiveM player source
--- @param amount  number  Positive integer (minor units / cents)
--- @param reason  string  Audit reason string
--- @param cb      function|nil  Optional callback function(ok, data)
function ATC.EconomyPlugin.Pay(source, amount, reason, cb)
    if not _isPositiveInt(amount) then
        ATC.Log.Warn('economy-plugin', 'Pay called with invalid amount', {
            source = source, amount = amount,
        })
        if cb then cb(false, nil) end
        return
    end

    ATC.Economy.Credit(source, 'cash', math.floor(amount), nil, reason or 'payment', function(ok, data)
        if ok then
            ATC.Log.Info('economy-plugin', 'Pay completed', {
                source = source, amount = amount, reason = reason,
            })
        else
            ATC.Log.Warn('economy-plugin', 'Pay failed', {
                source = source, amount = amount, reason = reason,
            })
        end
        if cb then cb(ok, data) end
    end)
end

--- Charge (debit) a player. Delegates to ATC.Economy.Debit.
--- Intended to be called by other server-side plugins.
--- @param source  number  FiveM player source
--- @param amount  number  Positive integer (minor units / cents)
--- @param reason  string  Audit reason string
--- @param cb      function|nil  Optional callback function(ok, data)
function ATC.EconomyPlugin.Charge(source, amount, reason, cb)
    if not _isPositiveInt(amount) then
        ATC.Log.Warn('economy-plugin', 'Charge called with invalid amount', {
            source = source, amount = amount,
        })
        if cb then cb(false, nil) end
        return
    end

    ATC.Economy.Debit(source, 'cash', math.floor(amount), nil, reason or 'charge', function(ok, data)
        if ok then
            ATC.Log.Info('economy-plugin', 'Charge completed', {
                source = source, amount = amount, reason = reason,
            })
        else
            ATC.Log.Warn('economy-plugin', 'Charge failed (insufficient funds?)', {
                source = source, amount = amount, reason = reason,
            })
        end
        if cb then cb(ok, data) end
    end)
end

-- ── Event: ATM withdraw ───────────────────────────────────────────────────────
-- Player requests to withdraw cash from their bank account.
-- Amount is capped at 10 000 per request to limit exploit vectors.

ATC.Firewall.On(
    'atc:economy:atm:withdraw',
    {
        clientAllowed  = true,
        requireSession = true,
        rateLimit      = { window = 30000, max = 5 },
    },
    function(src, payload)
        local amount = payload and tonumber(payload.amount)

        if not amount or amount <= 0 or amount > 10000 then
            ATC.Log.Warn('economy-plugin', 'atm:withdraw — invalid amount', {
                source = src, amount = amount,
            })
            TriggerClientEvent('atc:economy:atm:response', src, {
                success = false,
                code    = 'INVALID_AMOUNT',
                message = 'Amount must be between 1 and 10,000.',
            })
            return
        end

        -- Debit the bank account (player is withdrawing cash from bank)
        ATC.Economy.Debit(src, 'bank', math.floor(amount), nil, 'atm_withdrawal', function(ok, data)
            if ok then
                -- Credit the withdrawn amount to cash
                ATC.Economy.Credit(src, 'cash', math.floor(amount), nil, 'atm_withdrawal_cash', function(creditOk, creditData)
                    if creditOk then
                        ATC.Log.Info('economy-plugin', 'ATM withdrawal completed', {
                            source = src, amount = amount,
                        })
                        TriggerClientEvent('atc:economy:atm:response', src, {
                            success  = true,
                            data     = creditData,
                            amount   = amount,
                            type     = 'withdraw',
                        })
                    else
                        -- Cash credit failed — this is a critical consistency issue; log loudly
                        ATC.Log.Error('economy-plugin', 'ATM withdrawal: bank debited but cash credit failed', {
                            source = src, amount = amount,
                        })
                        TriggerClientEvent('atc:economy:atm:response', src, {
                            success = false,
                            code    = 'CREDIT_ERROR',
                            message = 'Withdrawal error. Contact support.',
                        })
                    end
                end)
            else
                ATC.Log.Warn('economy-plugin', 'ATM withdrawal failed (insufficient bank funds?)', {
                    source = src, amount = amount,
                })
                TriggerClientEvent('atc:economy:atm:response', src, {
                    success = false,
                    code    = 'INSUFFICIENT_FUNDS',
                    message = 'Insufficient bank balance.',
                })
            end
        end)
    end
)

-- ── Event: ATM deposit ────────────────────────────────────────────────────────
-- Player deposits cash into their bank account.
-- Amount is capped at 50 000 per request.

ATC.Firewall.On(
    'atc:economy:atm:deposit',
    {
        clientAllowed  = true,
        requireSession = true,
        rateLimit      = { window = 30000, max = 5 },
    },
    function(src, payload)
        local amount = payload and tonumber(payload.amount)

        if not amount or amount <= 0 or amount > 50000 then
            ATC.Log.Warn('economy-plugin', 'atm:deposit — invalid amount', {
                source = src, amount = amount,
            })
            TriggerClientEvent('atc:economy:atm:response', src, {
                success = false,
                code    = 'INVALID_AMOUNT',
                message = 'Amount must be between 1 and 50,000.',
            })
            return
        end

        -- Debit the cash account first
        ATC.Economy.Debit(src, 'cash', math.floor(amount), nil, 'atm_deposit', function(ok, data)
            if ok then
                -- Credit the bank account
                ATC.Economy.Credit(src, 'bank', math.floor(amount), nil, 'atm_deposit_bank', function(creditOk, creditData)
                    if creditOk then
                        ATC.Log.Info('economy-plugin', 'ATM deposit completed', {
                            source = src, amount = amount,
                        })
                        TriggerClientEvent('atc:economy:atm:response', src, {
                            success = true,
                            data    = creditData,
                            amount  = amount,
                            type    = 'deposit',
                        })
                    else
                        ATC.Log.Error('economy-plugin', 'ATM deposit: cash debited but bank credit failed', {
                            source = src, amount = amount,
                        })
                        TriggerClientEvent('atc:economy:atm:response', src, {
                            success = false,
                            code    = 'CREDIT_ERROR',
                            message = 'Deposit error. Contact support.',
                        })
                    end
                end)
            else
                ATC.Log.Warn('economy-plugin', 'ATM deposit failed (insufficient cash?)', {
                    source = src, amount = amount,
                })
                TriggerClientEvent('atc:economy:atm:response', src, {
                    success = false,
                    code    = 'INSUFFICIENT_FUNDS',
                    message = 'Insufficient cash balance.',
                })
            end
        end)
    end
)

ATC.Log.Info('economy-plugin', 'atc-economy server plugin loaded')
