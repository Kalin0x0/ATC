-- bridges/qb-core/server/init.lua
-- QB-Core → ATC Server Bridge
-- Translates QB-Core player/economy/job events into ATC SDK calls.
-- This resource only loads when both 'qb-core' and 'atc-core' are present
-- (enforced via fxmanifest.lua dependencies).

-- ─── Player Loaded ────────────────────────────────────────────────────────────
-- QB fires QBCore:Server:OnPlayerLoaded after it has fully initialised the
-- player object.  By this point ATC Core should already have created a session
-- via playerConnecting / playerJoining.  We verify that and log a warning if
-- the session is missing so developers can diagnose load-order problems.
AddEventHandler('QBCore:Server:OnPlayerLoaded', function(Player)
    local src = Player.PlayerData.source
    ATC.Log.Info('bridge:qb', 'QB player loaded, verifying ATC session', { source = src })

    local session = ATC.Sessions.Get(src)
    if not session then
        -- Should not happen if both resources load in the correct order.
        -- Logged at WARN so it surfaces in observability dashboards.
        ATC.Log.Warn('bridge:qb', 'No ATC session for QB player — triggering CLIENT_READY', { source = src })
    end
end)

-- ─── Money Events ─────────────────────────────────────────────────────────────
-- QB fires QBCore:Server:OnMoneyChange whenever a player's wallet changes.
-- We forward the delta to the ATC economy API so balances stay in sync.
AddEventHandler('QBCore:Server:OnMoneyChange', function(src, moneyType, amount, reason, add)
    local principalId = ATC.Accounts.GetPrincipalId(src)
    if not principalId then
        ATC.Log.Warn('bridge:qb', 'OnMoneyChange — no principalId for source', { source = src })
        return
    end

    local endpoint = add
        and ('/api/v1/economy/wallets/' .. principalId .. '/credit')
        or  ('/api/v1/economy/wallets/' .. principalId .. '/debit')

    ATC.HTTP.Post(endpoint, {
        amount = tonumber(amount) or 0,
        reason = reason or 'qb_bridge',
    }, function(ok, status, data, err)
        if not ok then
            ATC.Log.Warn('bridge:qb', 'Economy sync failed', {
                source     = src,
                endpoint   = endpoint,
                httpStatus = status,
                err        = err,
            })
        end
    end)
end)

-- ─── Job Update ───────────────────────────────────────────────────────────────
-- QB fires QBCore:Server:OnJobUpdate when a player's job or grade changes.
-- We relay the normalised job payload to the ATC client so HUD / job systems
-- can react without depending on QB types.
AddEventHandler('QBCore:Server:OnJobUpdate', function(src, JobInfo)
    TriggerClientEvent('atc:jobs:job:changed', src, {
        jobName   = JobInfo and JobInfo.name                              or 'unemployed',
        jobLabel  = JobInfo and JobInfo.label                             or 'Unemployed',
        rank      = JobInfo and JobInfo.grade and JobInfo.grade.name      or 'recruit',
        rankLabel = JobInfo and JobInfo.grade and JobInfo.grade.label     or 'Recruit',
        onDuty    = JobInfo and JobInfo.onduty                            or false,
    })
end)
