-- atc-admin — Server Init
-- In-game admin commands gated by the 'atc.admin' ace permission.
-- All actions are logged via ATC.Log.Security / ATC.Log.Info.
-- /atcban persists through POST /api/v1/accounts/ban and also kicks; the kick
-- runs first so a failed request cannot leave the target on the server.
-- bring/goto/freeze are local FiveM ops with no API side.

-- ── Branding ──────────────────────────────────────────────────────────────────

--- Player-facing message prefix, derived from the atc_brand_short convar via
--- ATC.Branding.Tag() so a self-hosted server rebrands its kick/ban text.
---
--- ATC.Branding is populated by atc-core's shared scripts — the same injected
--- `ATC` global surface this file already uses for ATC.Log / ATC.Accounts /
--- ATC.Firewall (see docs/sdk/PLUGIN_GUIDE.md §2), so this adds no
--- dependency the plugin did not already carry. The extra `ATC and` test is
--- because this is a separate resource from atc-core: if the global is ever
--- absent, indexing it would raise inside a kick/ban handler. Every failure
--- mode falls back to the literal prefix this file shipped with, so a branding
--- problem can never swallow a kick or a ban.
--- @param suffix string|nil  'Admin' for the admin-action tag, nil for plain
--- @return string  '[ATC Admin]' / '[ATC]' when unbranded
local function _tag(suffix)
    if ATC and ATC.Branding and type(ATC.Branding.Tag) == 'function' then
        local ok, tag = pcall(ATC.Branding.Tag, suffix)
        if ok and type(tag) == 'string' and tag ~= '' then
            return tag
        end
    end
    return (suffix == 'Admin') and '[ATC Admin]' or '[ATC]'
end

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

    DropPlayer(tostring(targetId), _tag('Admin') .. ' ' .. reason)

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

    -- Kicking is a local FiveM op that needs no response, so it runs first and
    -- unconditionally. It used to sit inside the request callback, which meant a
    -- failed request left the target on the server.
    DropPlayer(tostring(targetId), _tag() .. ' You have been banned: ' .. reason)

    -- Recorded against the admin's principal where one is resolvable, so the
    -- ban row names who issued it. Console (source 0) has none.
    local actingPrincipal = (source ~= 0) and ATC.Accounts.GetPrincipalId(source) or nil

    ATC.HTTP.Post('/api/v1/accounts/ban', {
        identifier          = identifier,
        reason              = reason,
        expiresAt           = expiresAt,     -- nil = permanent
        bannedByPrincipalId = actingPrincipal,
    }, function(ok, status, data, err)
        if not ok then
            -- Everything needed to apply the ban by hand (server.cfg / txAdmin)
            -- is in this line, because the kick already happened and only the
            -- record is missing — the player can otherwise reconnect.
            ATC.Log.Security('admin', 'Ban NOT persisted — API call failed; player kicked only and can reconnect', {
                admin      = source,
                target     = targetId,
                identifier = identifier,
                duration   = duration,
                reason     = reason,
                expiresAt  = expiresAt,
                status     = status,
                err        = err,
            })
            return
        end

        ATC.Log.Security('admin', 'Player banned', {
            admin      = source,
            target     = targetId,
            identifier = identifier,
            duration   = duration,
            reason     = reason,
            expiresAt  = expiresAt,
            banId      = type(data) == 'table' and data.id or nil,
        })
    end, { principalId = actingPrincipal })
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

-- ── NUI-based Firewall handlers ───────────────────────────────────────────────

ATC.Firewall.On('atc:admin:bring', {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { window = 3000, max = 10 },
}, function(src, d)
    if not isAdmin(src) then return end
    local targetId = tonumber(d and d.id)
    if not targetId then return end
    local coords = GetEntityCoords(GetPlayerPed(src))
    SetEntityCoords(GetPlayerPed(targetId), coords.x + 2.0, coords.y, coords.z, false, false, false, true)
    ATC.Log.Info('admin', 'NUI bring', { admin = src, target = targetId })
end)

ATC.Firewall.On('atc:admin:goto', {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { window = 3000, max = 10 },
}, function(src, d)
    if not isAdmin(src) then return end
    local targetId = tonumber(d and d.id)
    if not targetId then return end
    local coords = GetEntityCoords(GetPlayerPed(targetId))
    SetEntityCoords(GetPlayerPed(src), coords.x + 2.0, coords.y, coords.z, false, false, false, true)
    ATC.Log.Info('admin', 'NUI goto', { admin = src, target = targetId })
end)

ATC.Firewall.On('atc:admin:freeze', {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { window = 3000, max = 10 },
}, function(src, d)
    if not isAdmin(src) then return end
    local targetId = tonumber(d and d.id)
    if not targetId then return end
    FreezeEntityPosition(GetPlayerPed(targetId), true)
    ATC.Log.Info('admin', 'NUI freeze', { admin = src, target = targetId })
end)

ATC.Firewall.On('atc:admin:kick', {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { window = 5000, max = 5 },
}, function(src, d)
    if not isAdmin(src) then return end
    local targetId = tonumber(d and d.id)
    local reason   = type(d) == 'table' and tostring(d.reason or 'Admin kick'):sub(1, 128) or 'Admin kick'
    if not targetId then return end
    DropPlayer(tostring(targetId), _tag('Admin') .. ' ' .. reason)
    ATC.Log.Security('admin', 'NUI kick', { admin = src, target = targetId, reason = reason })
end)

ATC.Firewall.On('atc:admin:ban', {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { window = 10000, max = 3 },
}, function(src, d)
    if not isAdmin(src) then return end
    local targetId = tonumber(d and d.id)
    local reason   = type(d) == 'table' and tostring(d.reason or 'Admin ban'):sub(1, 256) or 'Admin ban'
    if not targetId then return end
    local identifier = GetPlayerIdentifierByType(tostring(targetId), 'license')
    if not identifier then
        ATC.Log.Security('admin', 'NUI ban ignored — could not resolve license identifier', {
            admin = src, target = targetId, reason = reason,
        })
        return
    end

    -- Kick first, unconditionally — see /atcban above.
    DropPlayer(tostring(targetId), _tag() .. ' Banned: ' .. reason)

    -- Permanent: the admin panel offers no duration. /atcban takes one.
    local actingPrincipal = ATC.Accounts.GetPrincipalId(src)
    ATC.HTTP.Post('/api/v1/accounts/ban', {
        identifier          = identifier,
        reason              = reason,
        bannedByPrincipalId = actingPrincipal,
    }, function(ok, status, data, err)
        if not ok then
            ATC.Log.Security('admin', 'NUI ban NOT persisted — API call failed; player kicked only and can reconnect', {
                admin = src, target = targetId, identifier = identifier,
                reason = reason, status = status, err = err,
            })
            return
        end
        ATC.Log.Security('admin', 'NUI ban', {
            admin      = src,
            target     = targetId,
            identifier = identifier,
            reason     = reason,
            banId      = type(data) == 'table' and data.id or nil,
        })
    end, { principalId = actingPrincipal })
end)

ATC.Firewall.On('atc:admin:announce', {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { window = 10000, max = 5 },
}, function(src, d)
    if not isAdmin(src) then return end
    local msg = type(d) == 'table' and tostring(d.message or ''):sub(1, 256) or ''
    if msg ~= '' then
        TriggerClientEvent('atc:notify:show', -1, {
            message  = '[ADMIN] ' .. msg,
            level    = 'warning',
            duration = 8000,
        })
        ATC.Log.Info('admin', 'Server announcement sent', { admin = src, message = msg })
    end
end)

ATC.Firewall.On('atc:admin:reviveAll', {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { window = 15000, max = 3 },
}, function(src)
    if not isAdmin(src) then return end
    TriggerClientEvent('atc:admin:reviveAll:exec', -1)
    ATC.Log.Info('admin', 'Revive all triggered', { admin = src })
end)

ATC.Firewall.On('atc:admin:clearArea', {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { window = 30000, max = 2 },
}, function(src)
    if not isAdmin(src) then return end
    -- Delegate to client-side clear for nearby entity removal
    TriggerClientEvent('atc:admin:clearArea:exec', src)
    ATC.Log.Info('admin', 'Clear area triggered', { admin = src })
end)
