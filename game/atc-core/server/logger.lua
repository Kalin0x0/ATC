-- ATC Core — Structured Logger
-- Provides consistent, JSON-formatted log output with level filtering.

ATC = ATC or {}
ATC.Log = ATC.Log or {}

local _LEVELS = { trace = 0, debug = 1, info = 2, warn = 3, error = 4, security = 5, audit = 6 }
local _MIN_LEVEL = _LEVELS[GetConvar('atc_log_level', 'info')] or _LEVELS.info

local _COLORS = {
    trace    = '^5',  -- cyan
    debug    = '^2',  -- green
    info     = '^7',  -- white
    warn     = '^3',  -- yellow
    error    = '^1',  -- red
    security = '^1',  -- red
    audit    = '^4',  -- blue
}

local function _serialize(data)
    if not data then return '' end
    local ok, encoded = pcall(json.encode, data)
    return ok and (' ' .. encoded) or ' [unserializable]'
end

local function _write(level, category, message, data)
    if (_LEVELS[level] or 0) < _MIN_LEVEL then return end

    local color  = _COLORS[level] or '^7'
    local ts     = os.date('!%Y-%m-%dT%H:%M:%SZ')
    local prefix = string.format('%s[ATC:%s]^7 ', color, level:upper())

    -- Human-readable console line
    local line = string.format('%s[%s][%s] %s%s', prefix, ts, category, message, _serialize(data))
    print(line)

    -- TODO Phase 2: ship structured JSON to API telemetry endpoint
end

--- Log at INFO level
function ATC.Log.Info(category, message, data)
    _write('info', category, message, data)
end

--- Log at WARN level
function ATC.Log.Warn(category, message, data)
    _write('warn', category, message, data)
end

--- Log at ERROR level
function ATC.Log.Error(category, message, data)
    _write('error', category, message, data)
end

--- Log a security event — always written regardless of log level.
--- Uses a dedicated write path that bypasses the level filter.
function ATC.Log.Security(category, message, data)
    local color  = _COLORS.security
    local ts     = os.date('!%Y-%m-%dT%H:%M:%SZ')
    local prefix = string.format('%s[ATC:SECURITY]^7 ', color)
    print(string.format('%s[%s][%s] %s%s', prefix, ts, category, message, _serialize(data)))
    -- TODO Phase 2: ship to API telemetry endpoint
end

--- Log an audit event — always written regardless of log level.
function ATC.Log.Audit(category, message, data)
    local color  = _COLORS.audit
    local ts     = os.date('!%Y-%m-%dT%H:%M:%SZ')
    local prefix = string.format('%s[ATC:AUDIT]^7 ', color)
    print(string.format('%s[%s][%s] %s%s', prefix, ts, category, message, _serialize(data)))
    -- TODO Phase 2: persist to immutable audit_log table via API
end

--- Log at DEBUG level (only when atc_debug=true or log level is debug/trace)
function ATC.Log.Debug(category, message, data)
    _write('debug', category, message, data)
end

--- Log at TRACE level (very verbose)
function ATC.Log.Trace(category, message, data)
    _write('trace', category, message, data)
end
