-- atc-admin — Server Init
-- In-game admin commands gated by the 'atc.admin' ace permission.
-- All actions are logged via ATC.Log.Security / ATC.Log.Info.
-- Ban persistence goes through the API; kick/bring/goto/freeze are local FiveM ops.

-- ── Permission Guard ──────────────────────────────────────────────────────────

--- Returns true when the source player holds the 'atc.admin' ace.
--- @param source number FiveM server id (0 = console, always allowed)
local function isAdmin(source)
    -- Console / server-internal callers are always allowed
    if source == 0 then return true end
    local principalId = ATC.Accounts.GetPrincipalId(source)
    if not principalId then return false end
    return IsPlayerAceAllowed(tostring(source), 'atc.admin')
end

-- ── /atckick ─────────────────────────────────────────────────────────────────
RegisterCommand('atckick', function(source, args)
    if not isAdmin(source) then
        ATC.Log.Security('admin', 'Unauthorized kick attempt', { source = source })
        return
    end

    local targetId = tonumber(args[1])
    if not targetId then return end

    local reason = table.concat(args, ' ', 2)
    reason = (reason ~= '') and reason or 'Kicked by admin'

    DropPlayer(tostring(targetId), '[ATC Admin] ' .. reason)

    ATC.Log.Security('admin', 'Player kicked', {
        admin  = source,
        target = targetId,
        reason = reason,
    })
end, true)

-- ── /atcban ──────────────────────────────────────────────────────────────────
-- Usage: /atcban <id> <days|0> <reason>
-- duration 0 = permanent ban.
RegisterCommand('atcban', function(source, args)
    if not isAdmin(source) then
        ATC.Log.Security('admin', 'Unauthorized ban attempt', { source = source })
        return
    end

    local targetId = tonumber(args[1])
    local duration = tonumber(args[2])  -- days; 0 = permanent
    if not targetId or not duration then return end

    local reason = table.concat(args, ' ', 3)
    reason = (reason ~= '') and reason or 'Admin ban'

    -- Resolve the Rockstar license identifier for persistence
    local identifier = GetPlayerIdentifierByType(tostring(targetId), 'license')
    if not identifier then
        ATC.Log.Warn('admin', 'Ban failed — could not resolve license identifier', {
            target = targetId,
        })
        return
    end

    -- Calculate ISO-8601 expiry; nil = permanent
    local expiresAt = nil
    if duration > 0 then
        expiresAt = os.date('!%Y-%m-%dT%H:%M:%SZ', os.time() + duration * 86400)
    end

    ATC.HTTP.Post('/api/v1/accounts/ban', {
        identifier = identifier,
        reason     = reason,
        expiresAt  = expiresAt,
    }, function(ok, status, data)
        if ok then
            DropPlayer(tostring(targetId), '[ATC] You have been banned: ' .. reason)
            ATC.Log.Security('admin', 'Player banned', {
                admin      = source,
                target     = targetId,
                identifier = identifier,
                duration   = duration,
                reason     = reason,
                expiresAt  = expiresAt,
            })
        else
            ATC.Log.Warn('admin', 'Ban API call failed', {
                target     = targetId,
                httpStatus = status,
            })
        end
    end)
end, true)

-- ── /atcbring ─────────────────────────────────────────────────────────────────
-- Teleports target player to 2 units beside the admin.
RegisterCommand('atcbring', function(source, args)
    if not isAdmin(source) then
        ATC.Log.Security('admin', 'Unauthorized bring attempt', { source = source })
        return
    end

    local targetId = tonumber(args[1])
    if not targetId then return end

    local adminPed  = GetPlayerPed(source)
    local coords    = GetEntityCoords(adminPed)

    SetEntityCoords(
        GetPlayerPed(targetId),
        coords.x + 2.0, coords.y, coords.z,
        false, false, false, true
    )

    ATC.Log.Info('admin', 'Player brought to admin', {
        admin  = source,
        target = targetId,
    })
end, true)

-- ── /atcgoto ─────────────────────────────────────────────────────────────────
-- Teleports the admin to 2 units beside the target player.
RegisterCommand('atcgoto', function(source, args)
    if not isAdmin(source) then
        ATC.Log.Security('admin', 'Unauthorized goto attempt', { source = source })
        return
    end

    local targetId = tonumber(args[1])
    if not targetId then return end

    local targetCoords = GetEntityCoords(GetPlayerPed(targetId))

    SetEntityCoords(
        GetPlayerPed(source),
        targetCoords.x + 2.0, targetCoords.y, targetCoords.z,
        false, false, false, true
    )

    ATC.Log.Info('admin', 'Admin teleported to player', {
        admin  = source,
        target = targetId,
    })
end, true)

-- ── /atcfreeze ────────────────────────────────────────────────────────────────
-- Freezes a player's ped in place. Useful to stop suspects fleeing.
RegisterCommand('atcfreeze', function(source, args)
    if not isAdmin(source) then
        ATC.Log.Security('admin', 'Unauthorized freeze attempt', { source = source })
        return
    end

    local targetId = tonumber(args[1])
    if not targetId then return end

    FreezeEntityPosition(GetPlayerPed(targetId), true)

    ATC.Log.Info('admin', 'Player frozen', {
        admin  = source,
        target = targetId,
    })
end, true)

-- ── /atcunfreeze ──────────────────────────────────────────────────────────────
-- Releases a previously frozen player.
RegisterCommand('atcunfreeze', function(source, args)
    if not isAdmin(source) then
        ATC.Log.Security('admin', 'Unauthorized unfreeze attempt', { source = source })
        return
    end

    local targetId = tonumber(args[1])
    if not targetId then return end

    FreezeEntityPosition(GetPlayerPed(targetId), false)

    ATC.Log.Info('admin', 'Player unfrozen', {
        admin  = source,
        target = targetId,
    })
end, true)

-- ── /atcspectate ──────────────────────────────────────────────────────────────
-- Stub: full implementation requires client-side camera control.
-- Logs the intent for audit purposes and reserves the command namespace.
RegisterCommand('atcspectate', function(source, args)
    if not isAdmin(source) then
        ATC.Log.Security('admin', 'Unauthorized spectate attempt', { source = source })
        return
    end

    local targetId = tonumber(args[1])
    -- TODO: trigger client-side spectate camera via a signed server→client event
    ATC.Log.Info('admin', 'Spectate requested (client implementation pending)', {
        admin  = source,
        target = targetId,
    })
end, true)
