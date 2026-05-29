-- bridges/esx/server/init.lua
-- ESX → ATC Server Bridge
-- Translates ESX player/economy/job events into ATC SDK calls.
-- This resource only loads when both 'es_extended' and 'atc-core' are present
-- (enforced via fxmanifest.lua dependencies).

-- ─── Player Loaded ────────────────────────────────────────────────────────────
AddEventHandler('esx:playerLoaded', function(playerId, xPlayer, isNew)
    ATC.Log.Info('bridge:esx', 'ESX player loaded', {
        source = playerId,
        isNew  = isNew or false,
    })
    -- ATC session is created via playerConnecting; nothing extra needed here.
    -- This handler exists for future extension (e.g. character migration).
end)

-- ─── Money Events ─────────────────────────────────────────────────────────────
-- ESX fires esx:addMoney / esx:removeMoney when wallet mutations occur.
-- We forward both to the ATC economy API so balances stay in sync.
AddEventHandler('esx:addMoney', function(playerId, moneyType, amount)
    local principalId = ATC.Accounts.GetPrincipalId(playerId)
    if not principalId then
        ATC.Log.Warn('bridge:esx', 'esx:addMoney — no principalId for source', { source = playerId })
        return
    end

    ATC.HTTP.Post('/api/v1/economy/wallets/' .. principalId .. '/credit', {
        amount = tonumber(amount) or 0,
        reason = 'esx_' .. (moneyType or 'cash'),
    }, function(ok, status, data, err)
        if not ok then
            ATC.Log.Warn('bridge:esx', 'Economy credit sync failed', {
                source     = playerId,
                httpStatus = status,
                err        = err,
            })
        end
    end)
end)

AddEventHandler('esx:removeMoney', function(playerId, moneyType, amount)
    local principalId = ATC.Accounts.GetPrincipalId(playerId)
    if not principalId then
        ATC.Log.Warn('bridge:esx', 'esx:removeMoney — no principalId for source', { source = playerId })
        return
    end

    ATC.HTTP.Post('/api/v1/economy/wallets/' .. principalId .. '/debit', {
        amount = tonumber(amount) or 0,
        reason = 'esx_' .. (moneyType or 'cash'),
    }, function(ok, status, data, err)
        if not ok then
            ATC.Log.Warn('bridge:esx', 'Economy debit sync failed', {
                source     = playerId,
                httpStatus = status,
                err        = err,
            })
        end
    end)
end)

-- ─── Job Update ───────────────────────────────────────────────────────────────
-- ESX fires esx:setJob when a player's job or grade changes.
-- We normalise the ESX job object into the ATC job payload and relay it to the
-- client so HUD / job systems stay framework-agnostic.
AddEventHandler('esx:setJob', function(playerId, job, lastJob)
    TriggerClientEvent('atc:jobs:job:changed', playerId, {
        jobName   = job and job.name        or 'unemployed',
        jobLabel  = job and job.label       or 'Unemployed',
        rank      = job and job.grade_name  or 'recruit',
        rankLabel = job and job.grade_label or 'Recruit',
        onDuty    = false, -- ESX has no built-in onDuty flag
    })
end)
