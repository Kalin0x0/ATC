-- ============================================================
-- ATC — Atlantic Core
-- client/exports.lua — cross-resource access to client state
--
-- Same reason as server/exports.lua: every resource has its own Lua state, so
-- the client runtime tables (ATC.Core, ATC.Characters, ATC.Vitals,
-- ATC.Economy) are not visible to another resource, and including their files
-- would only produce empty copies. These exports read the live values.
--
-- All of them are safe to call before the core has finished starting: they
-- return false or nil rather than erroring.
-- ============================================================

--- True once the core client runtime has completed its handshake.
exports('IsReady', function()
    if not (ATC.Core and ATC.Core.IsReady) then return false end
    return ATC.Core.IsReady() and true or false
end)

--- Current session id, or nil.
exports('GetSessionId', function()
    if not (ATC.Core and ATC.Core.GetSessionId) then return nil end
    return ATC.Core.GetSessionId()
end)

--- Active character table for the local player, or nil.
exports('GetCharacter', function()
    if not (ATC.Characters and ATC.Characters.GetCurrent) then return nil end
    return ATC.Characters.GetCurrent()
end)

--- Vitals snapshot (health, armour, hunger, thirst…), or nil.
exports('GetVitals', function()
    if not (ATC.Vitals and ATC.Vitals.Get) then return nil end
    return ATC.Vitals.Get()
end)

--- Last known wallet snapshot. Cached — the server holds the authoritative value.
exports('GetWallet', function()
    if not (ATC.Economy and ATC.Economy.GetWallet) then return nil end
    return ATC.Economy.GetWallet()
end)

--- Branding values, so plugin UIs can carry the server's name and colour.
exports('GetBranding', function()
    if not (ATC.Branding and ATC.Branding.Get) then return nil end
    return ATC.Branding.Get()
end)
