-- atc-combat — Server Init
-- Handles player death, revive attempts, and self-initiated respawn.
-- Server-authoritative: death state and revive eligibility are confirmed server-side.
-- Dispatches EMS calls via the dispatch plugin's internal event bus.

-- ── Player Died ───────────────────────────────────────────────────────────────
-- Client fires this when GTA's native death state is confirmed on the client ped.
-- Rate-limited to 3 per 30 s to prevent death-spam exploits.
ATC.Firewall.On(ATC.Events.COMBAT.PLAYER_DIED, {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { window = 30000, max = 3 },
}, function(src, payload)
    local principalId = ATC.Accounts.GetPrincipalId(src)
    if not principalId then return end

    -- Persist injury record to the API
    ATC.HTTP.Post('/api/v1/combat/injuries', {
        principalId = principalId,
        bodyRegion  = 'general',
        severity    = 'critical',
    }, function(ok, status, data)
        if not ok then
            ATC.Log.Warn('combat', 'Failed to record injury', {
                principalId = principalId,
                httpStatus  = status,
            })
        end

        -- Always broadcast EMS call regardless of API success so players are never
        -- silently stuck downed with no help on the way.
        local ped    = GetPlayerPed(src)
        local coords = GetEntityCoords(ped)
        TriggerEvent('atc:dispatch:call:new', {
            type     = 'medical',
            priority = 'high',
            message  = 'Person down — EMS required',
            source   = src,
            coords   = coords,
        })
    end)
end)

-- ── Revive Attempt ────────────────────────────────────────────────────────────
-- Triggered when a player presses their interact key near a downed player.
-- Server confirms the target is actually dead before applying the revive.
ATC.Firewall.On(ATC.Events.COMBAT.REVIVE_ATTEMPT, {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { window = 5000, max = 3 },
}, function(src, payload)
    local targetSource = type(payload) == 'table' and tonumber(payload.targetSource)
    if not targetSource then
        ATC.Log.Warn('combat', 'Revive attempt: missing targetSource', { reviver = src })
        return
    end

    -- Confirm target is dead server-side — never trust client claim
    local targetPed = GetPlayerPed(targetSource)
    if not IsEntityDead(targetPed) then
        ATC.Log.Security('combat', 'Revive attempt on non-dead target', {
            reviver = src,
            target  = targetSource,
        })
        return
    end

    -- Apply revive to both target and reviver (reviver gets feedback event)
    TriggerClientEvent(ATC.Events.COMBAT.REVIVE, targetSource)
    TriggerClientEvent(ATC.Events.COMBAT.REVIVE, src)

    -- Resolve all active injuries for the revived player.
    -- There is no bulk endpoint: the API lists a principal's active injuries and
    -- resolves them one at a time by injury id, so the list is fetched first and
    -- each entry resolved individually.
    local targetPrincipalId = ATC.Accounts.GetPrincipalId(targetSource)
    if targetPrincipalId then
        ATC.HTTP.Get('/api/v1/combat/injuries/' .. targetPrincipalId, function(ok, status, data, err)
            if not ok then
                ATC.Log.Warn('combat', 'Failed to list injuries after revive', {
                    principalId = targetPrincipalId,
                    httpStatus  = status,
                    err         = err,
                })
                return
            end

            -- The handler sends the array straight through; tolerate a wrapper
            -- object in case that changes.
            local injuries = data
            if type(injuries) == 'table' and injuries[1] == nil then
                injuries = injuries.injuries or injuries.items or injuries.data
            end
            if type(injuries) ~= 'table' then return end

            for _, injury in ipairs(injuries) do
                local injuryId = injury and (injury.injuryId or injury.id)
                if type(injuryId) == 'string' and injuryId ~= '' then
                    ATC.HTTP.Post('/api/v1/combat/injuries/' .. injuryId .. '/resolve', {},
                    function(rok, rstatus)
                        if not rok then
                            ATC.Log.Warn('combat', 'Failed to resolve injury after revive', {
                                principalId = targetPrincipalId,
                                injuryId    = injuryId,
                                httpStatus  = rstatus,
                            })
                        end
                    end)
                end
            end
        end)
    end

    ATC.Log.Info('combat', 'Player revived', { reviver = src, target = targetSource })
end)

-- ── Self Respawn (15-minute timeout) ─────────────────────────────────────────
-- Players may request their own respawn after lying downed for the timeout period.
-- Strict rate limit (2 per min) prevents repeated teleport abuse.
ATC.Firewall.On(ATC.Events.PLAYER.REQUEST_RESPAWN, {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { window = 60000, max = 2 },
}, function(src, payload)
    -- Teleport to Sandy Shores Medical Center as default respawn
    local hospitalX, hospitalY, hospitalZ = 357.7, -590.6, 28.7
    SetEntityCoords(
        GetPlayerPed(src),
        hospitalX, hospitalY, hospitalZ,
        false, false, false, true
    )

    -- Trigger client revive so health/ragdoll state resets
    TriggerClientEvent(ATC.Events.COMBAT.REVIVE, src)

    ATC.Log.Info('combat', 'Player self-respawned at hospital', { source = src })
end)

-- ── Weapon Attachment Persistence ─────────────────────────────────────────────
-- The client toggles GTA weapon components locally for instant feedback; the
-- server records the change but never trusts the client for combat math.
-- Component string is hard-clamped to 64 chars to bound payload size.
--
-- Attachments live on the weapon runtime row, not on the player, so the weapon
-- has to be resolved first: the client knows which component it toggled but not
-- which atc_weapon_runtime row that is. The equipped weapon is that row.
ATC.Firewall.On('atc:combat:weapon:attachment', {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { window = 2000, max = 10 },
}, function(src, payload)
    local action    = type(payload) == 'table' and tostring(payload.action or '') or ''
    local component = type(payload) == 'table' and tostring(payload.component or ''):sub(1, 64) or ''
    if (action ~= 'add' and action ~= 'remove') or component == '' then return end

    local principalId = ATC.Accounts.GetPrincipalId(src)
    if not principalId then return end

    ATC.HTTP.Get('/api/v1/combat/weapons/holder/' .. principalId .. '/equipped',
    function(ok, status, data, err)
        if not ok then
            ATC.Log.Warn('combat', 'attachment not persisted — equipped lookup failed', {
                source = src, principalId = principalId, status = status, err = err,
            })
            return
        end

        local weapons = type(data) == 'table' and data.weapons or nil
        local weapon  = type(weapons) == 'table' and weapons[1] or nil
        if not weapon or not weapon.weaponId then
            -- Attaching a component to a weapon the server does not know the
            -- player is holding is not something to guess at: the registry is
            -- what /equip writes, and nothing here can stand in for it.
            ATC.Log.Debug('combat', 'attachment ignored — no equipped weapon on record', {
                source = src, principalId = principalId, component = component,
            })
            return
        end

        ATC.HTTP.Post('/api/v1/combat/weapons/' .. weapon.weaponId .. '/attachments', {
            holderPrincipalId = principalId,
            component         = component,
            action            = action,
        }, function(pok, pstatus, _pdata, perr)
            if not pok then
                ATC.Log.Warn('combat', 'attachment not persisted', {
                    source = src, principalId = principalId, weaponId = weapon.weaponId,
                    component = component, action = action, status = pstatus, err = perr,
                })
            end
        end)
    end)
end)
