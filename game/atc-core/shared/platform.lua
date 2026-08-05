-- ============================================================
-- ATC — Atlantic Core
-- shared/platform.lua — Runtime platform detection & capability flags
-- ============================================================
--
-- ATC targets the CitizenFX resource contract: fxmanifest.lua, fx_version
-- 'cerulean', game 'gta5', the standard natives, exports and sv_* convars.
-- That contract is identical on Cfx.re FiveM and on its forks, so ATC never
-- *requires* the platform to be identified and never refuses to boot because
-- it could not name one. Detection exists so logs, telemetry and operator
-- documentation can say the right thing — not so gameplay code can branch.
--
-- Load order: this file has no dependencies (not even ATC.Config) and must be
-- listed first in shared_scripts. Every native call below is guarded so a
-- missing or renamed native on an unfamiliar build degrades to "unknown"
-- instead of raising.
--
-- Manual override — always wins over auto-detection:
--     set atc_platform "auto"     -- default: detect
--     set atc_platform "fivem"
--     set atc_platform "vmp"
--     set atc_platform "redm"
-- ============================================================

ATC = ATC or {}
ATC.Platform = ATC.Platform or {}

-- ── Known platform ids ──────────────────────────────────────────────────────

local PLATFORM_FIVEM = 'fivem'
local PLATFORM_VMP   = 'vmp'
local PLATFORM_REDM  = 'redm'

local PLATFORM_NAMES = {
    [PLATFORM_FIVEM] = 'FiveM',
    [PLATFORM_VMP]   = 'VMP',
    [PLATFORM_REDM]  = 'RedM',
}

-- Accepted spellings for the manual override convar.
local OVERRIDE_ALIASES = {
    ['fivem']     = PLATFORM_FIVEM,
    ['cfx']       = PLATFORM_FIVEM,
    ['citizenfx'] = PLATFORM_FIVEM,
    ['fxserver']  = PLATFORM_FIVEM,
    ['vmp']       = PLATFORM_VMP,
    ['vmp.ir']    = PLATFORM_VMP,
    ['redm']      = PLATFORM_REDM,
    ['rdr3']      = PLATFORM_REDM,
}

local OVERRIDE_CONVAR = 'atc_platform'           -- operator-set, wins over everything
local RESOLVED_CONVAR = 'atc_platform_resolved'  -- server-detected, replicated to clients

-- ── Guarded runtime access ──────────────────────────────────────────────────

--- True when a global of this name exists and is callable in this runtime.
local function _hasNative(name)
    local ok, fn = pcall(function() return _G[name] end)
    return ok and type(fn) == 'function'
end

--- Call a global native by name. Returns nil if it is missing or throws.
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

local function _lower(value)
    if type(value) ~= 'string' then return '' end
    return value:lower()
end

--- Whole-word match, so "vmp" hits "VMP-master" but not "olympvmpx".
local function _hasToken(haystack, token)
    if type(haystack) ~= 'string' or haystack == '' then return false end
    -- \1 sentinels give the pattern a non-alphanumeric boundary at both ends.
    return ('\1' .. haystack:lower() .. '\1'):find('[^%w]' .. token .. '[^%w]') ~= nil
end

--- Reduce an arbitrary override string to a safe, loggable id.
local function _sanitiseId(value)
    value = _lower(value):gsub('[^%w%-_%.]', '')
    if #value > 24 then value = value:sub(1, 24) end
    return value
end

-- ── Detection ───────────────────────────────────────────────────────────────

--- Resolve the running platform.
--- @return string id, boolean detected, string source, string serverVersion
local function _detect()
    local server  = _isServer()
    local version = _convar('version', '')
    if version == '' then
        version = _convar('sv_version', '')
    end

    -- 1. Explicit operator override. Never second-guessed.
    local override = _sanitiseId((_convar(OVERRIDE_CONVAR, 'auto'):gsub('%s+', '')))
    if override ~= '' and override ~= 'auto' then
        local known = OVERRIDE_ALIASES[override]
        -- An unrecognised id is still honoured: it is recorded verbatim and the
        -- runtime stays on the FiveM-compatible path (see _apply).
        return known or override, true, 'convar:' .. OVERRIDE_CONVAR, version
    end

    -- 2. Platform already resolved by the server and replicated to us.
    if not server then
        local resolved = _sanitiseId(_convar(RESOLVED_CONVAR, ''))
        if resolved ~= '' and resolved ~= 'auto' then
            return resolved, true, 'convar:' .. RESOLVED_CONVAR, version
        end
    end

    -- 3. Game family. The server knows it from `gamename`; the client has to
    --    probe, because `gamename` is not replicated.
    local gameName = _lower(_convar('gamename', ''))
    if gameName == '' then
        gameName = _lower(_callNative('GetGameName'))
    end
    if gameName == 'rdr3' then
        return PLATFORM_REDM, true, 'convar:gamename', version
    end
    if gameName == '' and not server and not _hasNative('SetPedComponentVariation') then
        -- No GTA5 ped-component natives means this is the RDR3 client runtime.
        return PLATFORM_REDM, true, 'native-probe', version
    end

    -- 4. Master/heartbeat endpoint. The most reliable fork signal there is:
    --    each platform ships its own default and the binary name ("FXServer")
    --    is shared, so the build string alone cannot separate them.
    local master = _lower(_convar('sv_master1', ''))
    if master ~= '' then
        if master:find('vmp', 1, true) then
            return PLATFORM_VMP, true, 'convar:sv_master1', version
        end
        if master:find('fivem.net', 1, true) or master:find('cfx.re', 1, true) then
            return PLATFORM_FIVEM, true, 'convar:sv_master1', version
        end
    end

    -- 5. Build string, when a fork stamps itself into it.
    if _hasToken(version, PLATFORM_VMP) then
        return PLATFORM_VMP, true, 'convar:version', version
    end

    -- 6. Licensing handshake residue. Stock FXServer does not populate this
    --    pair; it appears only once a fork's own registration has succeeded.
    if server and _convar('sv_sessionId', '') ~= '' and _convar('sv_secret', '') ~= '' then
        return PLATFORM_VMP, true, 'convar:sv_sessionId', version
    end

    -- 7. Soft hint: the project name. Weakest signal, checked last.
    if _hasToken(_convar('sv_projectName', ''), PLATFORM_VMP) then
        return PLATFORM_VMP, true, 'convar:sv_projectName', version
    end

    if version ~= '' then
        local v = version:lower()
        if v:find('fxserver', 1, true) or v:find('fivem', 1, true) or v:find('cfx', 1, true) then
            return PLATFORM_FIVEM, true, 'convar:version', version
        end
    end

    -- 8. Nothing matched. Assume a FiveM-compatible CitizenFX build and carry
    --    on — an unnamed platform is never a reason to fail startup.
    return PLATFORM_FIVEM, false, 'default', version
end

--- Write a detection result onto ATC.Platform.
local function _apply(id, detected, source, version)
    ATC.Platform.Id     = id
    ATC.Platform.Name   = PLATFORM_NAMES[id] or id
    ATC.Platform.IsVMP  = (id == PLATFORM_VMP)
    ATC.Platform.IsRedM = (id == PLATFORM_REDM)
    -- IsFiveM doubles as "runs the stock FiveM/CitizenFX gta5 contract", so an
    -- unrecognised id lands here rather than leaving every flag false.
    ATC.Platform.IsFiveM       = not ATC.Platform.IsVMP and not ATC.Platform.IsRedM
    ATC.Platform.Detected      = detected == true
    ATC.Platform.Source        = source or 'default'
    ATC.Platform.ServerVersion = version or ''
end

--- Publish the server's verdict so clients skip detection entirely.
local function _replicate()
    if not _isServer() then return end
    if not ATC.Platform.Detected then return end
    _callNative('SetConvarReplicated', RESOLVED_CONVAR, ATC.Platform.Id)
end

-- ── Public API ──────────────────────────────────────────────────────────────

--- Short human-readable line for console output and log fields.
--- @return string
function ATC.Platform.Describe()
    local text = ATC.Platform.Name or 'Unknown'
    if ATC.Platform.Detected then
        text = text .. ' (via ' .. (ATC.Platform.Source or 'default') .. ')'
    else
        text = text .. ' (assumed — no platform signal)'
    end
    if ATC.Platform.ServerVersion and ATC.Platform.ServerVersion ~= '' then
        text = text .. ' — ' .. ATC.Platform.ServerVersion
    end
    return text
end

--- Plain copy, safe to hand to telemetry payloads or the NUI.
--- @return table
function ATC.Platform.Get()
    return {
        id            = ATC.Platform.Id,
        name          = ATC.Platform.Name,
        isFiveM       = ATC.Platform.IsFiveM,
        isVMP         = ATC.Platform.IsVMP,
        isRedM        = ATC.Platform.IsRedM,
        detected      = ATC.Platform.Detected,
        source        = ATC.Platform.Source,
        serverVersion = ATC.Platform.ServerVersion,
    }
end

--- Re-run detection. Useful after the licensing handshake has completed, or
--- from an admin command after atc_platform was changed at runtime.
--- @return string id
function ATC.Platform.Refresh()
    _apply(_detect())
    _replicate()
    return ATC.Platform.Id
end

-- ── Boot ────────────────────────────────────────────────────────────────────

_apply(_detect())
_replicate()

if _isServer() then
    if ATC.Platform.Detected then
        print('^2[ATC:PLATFORM] ' .. ATC.Platform.Describe() .. '^7')
    else
        print('^3[ATC:PLATFORM] ' .. ATC.Platform.Describe() ..
              '. Set atc_platform in server.cfg to pin it.^7')
    end

    -- Some signals (the licensing handshake in particular) only land after the
    -- first resources are already running. Re-check once, quietly, and only
    -- speak up if that turns an assumption into a real detection.
    if not ATC.Platform.Detected and _hasNative('SetTimeout') then
        pcall(SetTimeout, 10000, function()
            if ATC.Platform.Detected then return end
            ATC.Platform.Refresh()
            if ATC.Platform.Detected then
                print('^2[ATC:PLATFORM] ' .. ATC.Platform.Describe() .. '^7')
            end
        end)
    end
end
