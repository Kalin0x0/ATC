-- ATC Core — Accounts Helper
-- Resolves account-level identifiers from the active session.
-- Loaded after sessions.lua so ATC.Sessions is guaranteed available.

ATC = ATC or {}
ATC.Accounts = ATC.Accounts or {}

--- Return the accountId (REST API UUID) for a connected player.
--- Returns nil if the player has no session or the session is not yet verified.
--- @param source number FiveM player source
--- @return string|nil
function ATC.Accounts.GetPrincipalId(source)
    local session = ATC.Sessions.Get(source)
    return session and session.accountId or nil
end

--- Return the active characterId for a connected player.
--- Convenience alias — preferred over reading session.characterId directly.
--- @param source number
--- @return string|nil
function ATC.Accounts.GetCharacterId(source)
    local session = ATC.Sessions.Get(source)
    return session and session.characterId or nil
end

--- Return the full in-memory session table for a player, or nil.
--- @param source number
--- @return table|nil
function ATC.Accounts.GetSession(source)
    return ATC.Sessions.Get(source)
end
