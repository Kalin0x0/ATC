-- ATC Core — Client Locale System
-- Manages the active locale, direction, and translation lookup on the client.

ATC = ATC or {}
ATC.Locale = ATC.Locale or {}

local _code         = 'en'
local _direction    = 'ltr'
local _translations = ATC.Locales.GetTranslations('en')  -- default until server responds

-- ── Public API ───────────────────────────────────────────────────────────────

--- Set the active locale. Falls back to 'en' if unsupported.
--- @param code string Locale code
function ATC.Locale.Set(code)
    if not ATC.Locales.IsSupported(code) then
        print(string.format('[ATC:WARN] Locale "%s" unsupported — falling back to en', tostring(code)))
        code = 'en'
    end
    _code         = code
    _translations = ATC.Locales.GetTranslations(code)
    _direction    = ATC.Locales.GetMeta(code).direction
end

--- Translate a dot-notation key with optional variable interpolation.
--- Falls back to English, then to the raw key.
--- @param key string e.g. 'auth.connecting'
--- @param vars table|nil Optional { varName = value }
--- @return string
function ATC.Locale.T(key, vars)
    return ATC.Locales.T(_code, key, vars)
end

--- Get the current locale code.
--- @return string
function ATC.Locale.GetCode()
    return _code
end

--- Get the current text direction ('ltr' or 'rtl').
--- @return string
function ATC.Locale.GetDirection()
    return _direction
end

--- Check if the current locale is RTL.
--- @return boolean
function ATC.Locale.IsRTL()
    return _direction == 'rtl'
end

-- Convenience alias
ATC.T = ATC.Locale.T
