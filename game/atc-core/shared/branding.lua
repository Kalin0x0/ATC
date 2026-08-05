-- ============================================================
-- ATC — Atlantic Core
-- shared/branding.lua — Self-host branding (server identity, not framework identity)
-- ============================================================
--
-- FRAMEWORK IDENTITY vs SERVER BRANDING — these are two different things and
-- only one of them is configurable.
--
--   FRAMEWORK IDENTITY is "Atlantic Core" / "ATC" by Naiemi Group. It stays put:
--   fxmanifest author and description, LICENSE, README, docs and the framework
--   startup log all keep it. Nothing in this file changes or removes it, and
--   the licence explicitly reserves those names. Attribution is not a setting.
--
--   SERVER BRANDING is what a player sees on YOUR server: the words in the NUI
--   logo, the tag on connect/kick messages, the admin panel title, the bank
--   name. Those are the convars below.
--
-- Every convar defaults to the exact string the codebase ships today, so an
-- existing deployment that sets none of them behaves identically to before.
--
--     set atc_brand_name           "Atlantic Core"
--     set atc_brand_short          "ATC"
--     set atc_brand_logo_primary   "ATLANTIC"
--     set atc_brand_logo_secondary "CORE"
--     set atc_brand_community      ""          -- empty = not shown
--     set atc_brand_website        ""
--     set atc_brand_discord        ""
--     set atc_brand_color          "#d4af37"
-- ============================================================

ATC = ATC or {}
ATC.Branding = ATC.Branding or {}

-- ── Defaults: today's literals, verbatim ────────────────────────────────────

local DEFAULTS = {
    Name          = 'Atlantic Core',
    Short         = 'ATC',
    LogoPrimary   = 'ATLANTIC',
    LogoSecondary = 'CORE',
    Community     = '',
    Website       = '',
    Discord       = '',
    Color         = '#d4af37',
}

-- Convar name and maximum length (in characters, not bytes) per field.
local FIELDS = {
    { key = 'Name',          convar = 'atc_brand_name',           max = 64,  kind = 'text' },
    { key = 'Short',         convar = 'atc_brand_short',          max = 16,  kind = 'tag'  },
    { key = 'LogoPrimary',   convar = 'atc_brand_logo_primary',   max = 16,  kind = 'text' },
    { key = 'LogoSecondary', convar = 'atc_brand_logo_secondary', max = 16,  kind = 'text' },
    { key = 'Community',     convar = 'atc_brand_community',      max = 64,  kind = 'text' },
    { key = 'Website',       convar = 'atc_brand_website',        max = 256, kind = 'url'  },
    { key = 'Discord',       convar = 'atc_brand_discord',        max = 256, kind = 'url'  },
}

local COLOR_CONVAR  = 'atc_brand_color'
local COLOR_PATTERN = '^#%x%x%x%x%x%x$'

-- ── Guarded runtime access ──────────────────────────────────────────────────

local function _hasNative(name)
    local ok, fn = pcall(function() return _G[name] end)
    return ok and type(fn) == 'function'
end

local function _callNative(name, ...)
    if not _hasNative(name) then return nil end
    local ok, value = pcall(_G[name], ...)
    if not ok then return nil end
    return value
end

--- GetConvar that can never raise and always yields a string.
local function _convar(name, default)
    local value = _callNative('GetConvar', name, default)
    if type(value) ~= 'string' then return default end
    return value
end

local function _isServer()
    return _callNative('IsDuplicityVersion') == true
end

-- ── Sanitisation ────────────────────────────────────────────────────────────
-- A self-hoster's typo must never reach the NUI as broken markup, a stray
-- newline in the console, or a truncated multi-byte character.

--- Drop control characters, neutralise angle brackets, collapse and trim space.
local function _clean(value)
    if type(value) ~= 'string' then return '' end
    value = value:gsub('%c', ' ')       -- newlines, tabs, colour-code garbage
    value = value:gsub('[<>]', '')      -- never let a value open an HTML tag
    value = value:gsub('%s+', ' ')
    value = value:gsub('^ ', '')
    value = value:gsub(' $', '')
    return value
end

--- Cut to maxChars without splitting a UTF-8 sequence (locales include fa/de).
local function _truncate(value, maxChars)
    if value == '' or #value <= maxChars then return value end

    if utf8 and type(utf8.len) == 'function' then
        local okLen, len = pcall(utf8.len, value)
        if okLen and type(len) == 'number' then
            if len <= maxChars then return value end
            local okOff, cut = pcall(utf8.offset, value, maxChars + 1)
            if okOff and type(cut) == 'number' then
                return value:sub(1, cut - 1)
            end
        end
    end

    -- Fallback: byte cut, then walk back off any dangling continuation bytes.
    local out = value:sub(1, maxChars)
    while #out > 0 do
        local b = out:byte(#out)
        if b >= 0x80 and b <= 0xBF then
            out = out:sub(1, #out - 1)
        else
            break
        end
    end
    return out
end

--- Field-specific extra rules on top of _clean.
local function _shape(value, kind)
    if kind == 'tag' then
        -- Used to build '[ATC]' / '[ATC Security]' style prefixes.
        value = value:gsub('[%[%]]', '')
    elseif kind == 'url' then
        value = value:gsub('%s', '')
        value = value:gsub('["\'`]', '')
    end
    return value
end

--- Normalise then strictly validate a hex colour; fall back when unusable.
--- @return string color, boolean valid
local function _color(raw)
    local value = _clean(raw):gsub('%s', '')
    if value == '' then return DEFAULTS.Color, true end

    if not value:find('^#') then value = '#' .. value end
    -- Accept #abc shorthand by expanding it before validation.
    local short = value:match('^#(%x%x%x)$')
    if short then
        value = '#' .. short:sub(1, 1):rep(2) .. short:sub(2, 2):rep(2) .. short:sub(3, 3):rep(2)
    end

    if value:match(COLOR_PATTERN) then return value, true end
    return DEFAULTS.Color, false
end

-- ── Build ───────────────────────────────────────────────────────────────────

local _colorValid = true

local function _build()
    for _, field in ipairs(FIELDS) do
        local default = DEFAULTS[field.key]
        local value   = _shape(_clean(_convar(field.convar, default)), field.kind)
        value = _truncate(value, field.max)
        -- Blank always falls back to the default. For Community/Website/Discord
        -- that default is itself '', so "unset" stays unset.
        if value == '' then value = default end
        ATC.Branding[field.key] = value
    end

    ATC.Branding.Color, _colorValid = _color(_convar(COLOR_CONVAR, DEFAULTS.Color))
end

-- ── Public API ──────────────────────────────────────────────────────────────

--- Plain, function-free copy for SendNUIMessage payloads and API bodies.
--- Keys are camelCase because the consumers are JS and JSON.
--- @return table
function ATC.Branding.Get()
    return {
        name          = ATC.Branding.Name,
        short         = ATC.Branding.Short,
        logoPrimary   = ATC.Branding.LogoPrimary,
        logoSecondary = ATC.Branding.LogoSecondary,
        community     = ATC.Branding.Community,
        website       = ATC.Branding.Website,
        discord       = ATC.Branding.Discord,
        color         = ATC.Branding.Color,
    }
end

--- The one string to use wherever a single server title is needed — window
--- titles, headers, tutorial copy. Guaranteed non-empty.
--- @return string
function ATC.Branding.Title()
    local name = ATC.Branding.Name
    if type(name) ~= 'string' or name == '' then return DEFAULTS.Name end
    return name
end

--- Bracketed tag for player-facing connect, kick and ban messages.
--- Tag()          -> '[ATC]'
--- Tag('Security') -> '[ATC Security]'
--- @param suffix string|nil
--- @return string
function ATC.Branding.Tag(suffix)
    local short = ATC.Branding.Short
    if type(short) ~= 'string' or short == '' then short = DEFAULTS.Short end
    if type(suffix) == 'string' and suffix ~= '' then
        return '[' .. short .. ' ' .. suffix .. ']'
    end
    return '[' .. short .. ']'
end

--- Re-read every convar. For admin live-reload; values are read at load
--- otherwise.
function ATC.Branding.Refresh()
    _build()
    return ATC.Branding.Get()
end

-- ── Boot ────────────────────────────────────────────────────────────────────

_build()

if _isServer() and not _colorValid then
    print('^3[ATC:WARN] ' .. COLOR_CONVAR .. ' is not a valid hex colour (expected #rrggbb). ' ..
          'Falling back to ' .. DEFAULTS.Color .. '.^7')
end
