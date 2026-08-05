-- game/atc-sdk/client/sdk.lua
-- ATC SDK — client-side helpers for external plugins.
-- All functions are safe to call from any external resource that declares
-- 'atc-sdk' as a dependency.

ATC_SDK         = ATC_SDK or {}
ATC_SDK.Client  = {}

-- The core client runtime (ATC.Core, ATC.Characters, ATC.Vitals, ATC.Economy)
-- lives in atc-core's Lua state, which this resource cannot see — 'dependency'
-- only orders startup, it does not share globals. Reading them through
-- atc-core's exports returns the live values; including those files instead
-- would only produce empty copies. Wrapped so a call made before atc-core is
-- ready returns nil rather than raising.
local function _core(method)
    local ok, result = pcall(function()
        return exports['atc-core'][method](exports['atc-core'])
    end)
    if not ok then return nil end
    return result
end

-- ─── Core ─────────────────────────────────────────────────────────────────────

--- Returns true when the ATC Core client runtime is fully initialised.
--- Plugins should wait for this before reading SDK state.
--- @return boolean
function ATC_SDK.Client.IsReady()
    return _core('IsReady') == true
end

-- ─── Character ────────────────────────────────────────────────────────────────

--- Return the current active character data for the local player.
--- @return table|nil
function ATC_SDK.Client.GetCharacter()
    return _core('GetCharacter')
end

-- ─── Vitals ───────────────────────────────────────────────────────────────────

--- Return the current vitals snapshot (health, armour, hunger, thirst, etc.).
--- @return table|nil
function ATC_SDK.Client.GetVitals()
    return _core('GetVitals')
end

-- ─── Economy ──────────────────────────────────────────────────────────────────

--- Return the last-known wallet snapshot for the local player.
--- Note: this is a cached value; the authoritative balance lives on the server.
--- @return table|nil  { cash, bank, ... }
function ATC_SDK.Client.GetWallet()
    return _core('GetWallet')
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
