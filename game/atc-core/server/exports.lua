-- ============================================================
-- ATC — Atlantic Core
-- server/exports.lua — cross-resource access to server state
--
-- Every FiveM resource runs its own Lua state, so a resource that includes
-- atc-core's files with '@atc-core/...' gets its own copy of the tables, not
-- atc-core's. That is fine for stateless helpers, and wrong for anything
-- holding runtime state: a copy of sessions.lua has an empty _sessions table
-- and would answer nil for every connected player.
--
-- These exports are the supported way to read that state from another
-- resource. Keep them to plain data — a FiveM export cannot carry a Lua
-- callback across the boundary, so anything callback-based (ATC.HTTP) has to
-- be included instead of exported.
-- ============================================================

--- Full session table for a connected player, or nil.
exports('GetSession', function(source)
    if not (ATC.Sessions and ATC.Sessions.Get) then return nil end
    return ATC.Sessions.Get(tonumber(source) or source)
end)

--- Active characterId for a connected player, or nil.
exports('GetCharacterId', function(source)
    if not (ATC.Sessions and ATC.Sessions.GetCharacterId) then return nil end
    return ATC.Sessions.GetCharacterId(tonumber(source) or source)
end)

--- Account principal id for a connected player, or nil.
exports('GetPrincipalId', function(source)
    if not (ATC.Accounts and ATC.Accounts.GetPrincipalId) then return nil end
    return ATC.Accounts.GetPrincipalId(tonumber(source) or source)
end)

--- Detected platform name, for plugins that want to report or branch on it.
exports('GetPlatform', function()
    return (ATC.Platform and ATC.Platform.Name) or 'unknown'
end)

--- Server-facing branding values (name, short tag, colour…).
exports('GetBranding', function()
    if not (ATC.Branding and ATC.Branding.Get) then return nil end
    return ATC.Branding.Get()
end)
