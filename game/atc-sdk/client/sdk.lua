-- game/atc-sdk/client/sdk.lua
-- ATC SDK — client-side helpers for external plugins.
-- All functions are safe to call from any external resource that declares
-- 'atc-sdk' as a dependency.

ATC_SDK         = ATC_SDK or {}
ATC_SDK.Client  = {}

-- ─── Core ─────────────────────────────────────────────────────────────────────

--- Returns true when the ATC Core client runtime is fully initialised.
--- Plugins should wait for this before reading SDK state.
--- @return boolean
function ATC_SDK.Client.IsReady()
    return ATC.Core ~= nil and ATC.Core.IsReady()
end

-- ─── Character ────────────────────────────────────────────────────────────────

--- Return the current active character data for the local player.
--- @return table|nil
function ATC_SDK.Client.GetCharacter()
    return ATC.Characters and ATC.Characters.GetCurrent() or nil
end

-- ─── Vitals ───────────────────────────────────────────────────────────────────

--- Return the current vitals snapshot (health, armour, hunger, thirst, etc.).
--- @return table|nil
function ATC_SDK.Client.GetVitals()
    return ATC.Vitals and ATC.Vitals.Get() or nil
end

-- ─── Economy ──────────────────────────────────────────────────────────────────

--- Return the last-known wallet snapshot for the local player.
--- Note: this is a cached value; the authoritative balance lives on the server.
--- @return table|nil  { cash, bank, ... }
function ATC_SDK.Client.GetWallet()
    return ATC.Economy and ATC.Economy.GetWallet() or nil
end

-- ─── UI / Notifications ───────────────────────────────────────────────────────

--- Display an ATC NUI toast notification for the local player.
--- @param message  string
--- @param level    string  'info' | 'success' | 'warning' | 'error'
--- @param duration number  Milliseconds (default 5000)
function ATC_SDK.Client.Notify(message, level, duration)
    SendNUIMessage({
        type    = 'ATC_NOTIFICATION',
        payload = {
            message  = message  or '',
            level    = level    or 'info',
            duration = duration or 5000,
        },
    })
end
