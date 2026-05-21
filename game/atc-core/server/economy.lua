-- ATC Core — Economy Manager
-- Server-side only. Wraps wallet API calls.
-- CLIENTS CANNOT CREDIT OR DEBIT DIRECTLY. All money mutations must go through
-- server-side Lua (plugins call ATC.Economy.Credit/Debit/Transfer directly).
-- The only client-initiated event is atc:economy:balance:request (read-only).

ATC = ATC or {}
ATC.Economy = ATC.Economy or {}

local DEFAULT_CURRENCY = 'ATC'

-- ── Internal helpers ──────────────────────────────────────────────────────────

local function _getCharacterId(source)
    return ATC.Characters.GetSelectedId(source)
end

local function _makeIdempotencyKey(op, source, characterId)
    return ('atc:%s:%d:%s:%d:%d'):format(op, source, characterId, os.time(), math.random(1, 999999999))
end

-- ── Public server API ─────────────────────────────────────────────────────────

--- Get the wallet balance for the player's selected character.
--- @param source number FiveM player source
--- @param currency string|nil Currency code (default 'ATC')
--- @param callback function(ok, data|nil) data = { cashBalance, bankBalance, currency, status }
function ATC.Economy.GetBalance(source, currency, callback)
    local characterId = _getCharacterId(source)
    if not characterId then
        ATC.Log.Warn('economy', 'GetBalance called with no character selected', { source = source })
        callback(false, nil)
        return
    end

    local cur = currency or DEFAULT_CURRENCY
    local path = '/api/v1/wallets/character/' .. characterId .. '?currency=' .. cur
    ATC.HTTP.Get(path, function(ok, status, data, err)
        if not ok then
            ATC.Log.Error('economy', 'GetBalance API error', {
                source = source, status = status, err = err,
            })
            callback(false, nil)
            return
        end
        callback(true, data)
    end)
end

--- Credit money to the player's selected character wallet.
--- SERVER-SIDE ONLY — not callable via client events.
--- @param source number FiveM player source
--- @param account string 'cash' or 'bank'
--- @param amount number Positive integer in minor units (e.g. cents)
--- @param currency string|nil Currency code (default 'ATC')
--- @param reason string Audit reason
--- @param callback function(ok, data|nil)
function ATC.Economy.Credit(source, account, amount, currency, reason, callback)
    local characterId = _getCharacterId(source)
    if not characterId then
        ATC.Log.Warn('economy', 'Credit called with no character selected', { source = source })
        callback(false, nil)
        return
    end

    if type(amount) ~= 'number' or amount <= 0 or math.floor(amount) ~= amount then
        ATC.Log.Warn('economy', 'Credit called with invalid amount', { source = source, amount = amount })
        callback(false, nil)
        return
    end

    local cur = currency or DEFAULT_CURRENCY
    local idempotencyKey = _makeIdempotencyKey('credit', source, characterId)

    local path = '/api/v1/wallets/character/' .. characterId .. '/credit'
    local payload = {
        account       = account,
        amount        = amount,
        currency      = cur,
        reason        = reason or 'system',
        source        = 'gameplay',
        idempotencyKey = idempotencyKey,
    }

    ATC.HTTP.Post(path, payload, function(ok, status, data, err)
        if not ok then
            ATC.Log.Error('economy', 'Credit API error', {
                source = source, status = status, err = err,
            })
            callback(false, nil)
            return
        end

        ATC.Log.Info('economy', 'Credit applied', {
            source      = source,
            characterId = characterId,
            account     = account,
            amount      = amount,
            currency    = cur,
        })

        -- Notify server-side plugins that the balance changed
        TriggerEvent(ATC.Events.ECONOMY.MONEY_CHANGED, source, {
            characterId = characterId,
            type        = 'credit',
            account     = account,
            amount      = amount,
            currency    = cur,
            cashBalance = data and data.cashBalance,
            bankBalance = data and data.bankBalance,
        })

        callback(true, data)
    end)
end

--- Debit money from the player's selected character wallet.
--- SERVER-SIDE ONLY — not callable via client events.
--- @param source number FiveM player source
--- @param account string 'cash' or 'bank'
--- @param amount number Positive integer in minor units
--- @param currency string|nil Currency code (default 'ATC')
--- @param reason string Audit reason
--- @param callback function(ok, data|nil)
function ATC.Economy.Debit(source, account, amount, currency, reason, callback)
    local characterId = _getCharacterId(source)
    if not characterId then
        ATC.Log.Warn('economy', 'Debit called with no character selected', { source = source })
        callback(false, nil)
        return
    end

    if type(amount) ~= 'number' or amount <= 0 or math.floor(amount) ~= amount then
        ATC.Log.Warn('economy', 'Debit called with invalid amount', { source = source, amount = amount })
        callback(false, nil)
        return
    end

    local cur = currency or DEFAULT_CURRENCY
    local idempotencyKey = _makeIdempotencyKey('debit', source, characterId)

    local path = '/api/v1/wallets/character/' .. characterId .. '/debit'
    local payload = {
        account        = account,
        amount         = amount,
        currency       = cur,
        reason         = reason or 'system',
        source         = 'gameplay',
        idempotencyKey = idempotencyKey,
    }

    ATC.HTTP.Post(path, payload, function(ok, status, data, err)
        if not ok then
            ATC.Log.Error('economy', 'Debit API error', {
                source = source, status = status, err = err,
                insufficientFunds = (status == 422),
            })
            callback(false, nil)
            return
        end

        ATC.Log.Info('economy', 'Debit applied', {
            source      = source,
            characterId = characterId,
            account     = account,
            amount      = amount,
            currency    = cur,
        })

        TriggerEvent(ATC.Events.ECONOMY.MONEY_CHANGED, source, {
            characterId = characterId,
            type        = 'debit',
            account     = account,
            amount      = amount,
            currency    = cur,
            cashBalance = data and data.cashBalance,
            bankBalance = data and data.bankBalance,
        })

        callback(true, data)
    end)
end

--- Transfer money between the player's cash and bank accounts.
--- SERVER-SIDE ONLY.
--- @param source number FiveM player source
--- @param fromAccount string 'cash' or 'bank'
--- @param toAccount string 'cash' or 'bank' (must differ from fromAccount)
--- @param amount number Positive integer in minor units
--- @param currency string|nil Currency code (default 'ATC')
--- @param reason string Audit reason
--- @param callback function(ok, data|nil)
function ATC.Economy.Transfer(source, fromAccount, toAccount, amount, currency, reason, callback)
    local characterId = _getCharacterId(source)
    if not characterId then
        ATC.Log.Warn('economy', 'Transfer called with no character selected', { source = source })
        callback(false, nil)
        return
    end

    if type(amount) ~= 'number' or amount <= 0 or math.floor(amount) ~= amount then
        ATC.Log.Warn('economy', 'Transfer called with invalid amount', { source = source, amount = amount })
        callback(false, nil)
        return
    end

    if fromAccount == toAccount then
        ATC.Log.Warn('economy', 'Transfer called with identical accounts', { source = source })
        callback(false, nil)
        return
    end

    local cur = currency or DEFAULT_CURRENCY
    local idempotencyKey = _makeIdempotencyKey('transfer', source, characterId)

    local path = '/api/v1/wallets/character/' .. characterId .. '/transfer'
    local payload = {
        fromAccount    = fromAccount,
        toAccount      = toAccount,
        amount         = amount,
        currency       = cur,
        reason         = reason or 'player transfer',
        idempotencyKey = idempotencyKey,
    }

    ATC.HTTP.Post(path, payload, function(ok, status, data, err)
        if not ok then
            ATC.Log.Error('economy', 'Transfer API error', {
                source = source, status = status, err = err,
            })
            callback(false, nil)
            return
        end

        ATC.Log.Info('economy', 'Transfer applied', {
            source      = source,
            characterId = characterId,
            fromAccount = fromAccount,
            toAccount   = toAccount,
            amount      = amount,
            currency    = cur,
        })

        TriggerEvent(ATC.Events.ECONOMY.MONEY_CHANGED, source, {
            characterId = characterId,
            type        = 'transfer',
            account     = fromAccount,
            amount      = amount,
            currency    = cur,
            cashBalance = data and data.cashBalance,
            bankBalance = data and data.bankBalance,
        })

        callback(true, data)
    end)
end

-- ── Phase 21 — Financial Ledger API ──────────────────────────────────────────

ATC.Economy.Ledger = ATC.Economy.Ledger or {}

--- Transfer between two financial accounts via the double-entry ledger.
--- SERVER-SIDE ONLY. Amount is a positive number with up to 4 decimal places.
--- @param fromAccountId string Source financial account ID
--- @param toAccountId string Destination financial account ID
--- @param amount number Positive amount (e.g. 100.00)
--- @param currency string Currency code (e.g. 'USD')
--- @param description string Human-readable reason
--- @param idempotencyKey string Unique key for replay safety
--- @param callback function(ok, journal|nil, err|nil)
function ATC.Economy.Ledger.Transfer(fromAccountId, toAccountId, amount, currency, description, idempotencyKey, callback)
    if type(amount) ~= 'number' or amount <= 0 then
        ATC.Log.Warn('economy', 'LedgerTransfer called with invalid amount', { amount = amount })
        callback(false, nil, 'invalid_amount')
        return
    end

    local payload = {
        fromAccountId  = fromAccountId,
        toAccountId    = toAccountId,
        amount         = amount,
        currency       = currency or 'USD',
        description    = description or 'ledger transfer',
        source         = 'gameplay',
        idempotencyKey = idempotencyKey,
    }

    ATC.HTTP.Post('/api/v1/economy/transfer', payload, function(ok, status, data, err)
        if not ok then
            ATC.Log.Error('economy', 'LedgerTransfer API error', {
                status = status, err = err,
                insufficientFunds = (status == 422),
            })
            callback(false, nil, err or 'api_error')
            return
        end
        callback(true, data, nil)
    end)
end

--- Get a financial account by ID.
--- @param accountId string Financial account ID
--- @param callback function(ok, account|nil)
function ATC.Economy.Ledger.GetAccount(accountId, callback)
    ATC.HTTP.Get('/api/v1/economy/accounts/' .. accountId, function(ok, status, data, err)
        if not ok then
            callback(false, nil)
            return
        end
        callback(true, data)
    end)
end

-- ── Phase 21 — Organization API ───────────────────────────────────────────────

ATC.Economy.Org = ATC.Economy.Org or {}

--- Get an organization by ID.
--- @param orgId string Organization ID
--- @param callback function(ok, org|nil)
function ATC.Economy.Org.Get(orgId, callback)
    ATC.HTTP.Get('/api/v1/economy/organizations/' .. orgId, function(ok, status, data, err)
        if not ok then
            callback(false, nil)
            return
        end
        callback(true, data)
    end)
end

--- Get members of an organization.
--- @param orgId string Organization ID
--- @param callback function(ok, members|nil)
function ATC.Economy.Org.GetMembers(orgId, callback)
    ATC.HTTP.Get('/api/v1/economy/organizations/' .. orgId .. '/members', function(ok, status, data, err)
        if not ok then
            callback(false, nil)
            return
        end
        callback(true, data)
    end)
end

-- ── Balance request event (client → server, read-only) ────────────────────────
-- Rate-limited to 10 per 60 seconds. Client sends { currency? }.
-- Server responds with atc:economy:balance:update on the requesting client.

ATC.Firewall.On(ATC.Events.ECONOMY.BALANCE_REQUEST, {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { max = 10, window = 60 },
}, function(src, payload)
    local currency = DEFAULT_CURRENCY
    if type(payload) == 'table' and type(payload.currency) == 'string' then
        -- Only uppercase alphanumeric, 1-8 chars
        if payload.currency:match('^[A-Z0-9]+$') and #payload.currency <= 8 then
            currency = payload.currency
        end
    end

    ATC.Economy.GetBalance(src, currency, function(ok, data)
        if not ok or not data then
            TriggerClientEvent(ATC.Events.ECONOMY.BALANCE_UPDATE, src, {
                ok      = false,
                error   = 'balance_fetch_failed',
            })
            return
        end
        TriggerClientEvent(ATC.Events.ECONOMY.BALANCE_UPDATE, src, {
            ok          = true,
            currency    = data.currency,
            cashBalance = data.cashBalance,
            bankBalance = data.bankBalance,
            status      = data.status,
        })
    end)
end)
