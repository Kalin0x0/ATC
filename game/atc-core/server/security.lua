-- ATC Core — Security & Risk Score Engine
-- Tracks per-player risk scores and enforces automatic kick/ban thresholds.

ATC = ATC or {}
ATC.Security = ATC.Security or {}

local _riskStore = {}  -- identifier → { score, events }

local VIOLATION_POINTS = {
    EVENT_NOT_WHITELISTED      = 10,
    CLIENT_NOT_ALLOWED         = 10,
    NO_SESSION                 = 5,
    RATE_LIMIT_EXCEEDED        = 3,
    SCHEMA_VALIDATION_FAILED   = 15,
    COORD_MISMATCH             = 20,
    ITEM_NOT_OWNED             = 5,
    ECONOMY_ANOMALY            = 25,
    INVENTORY_DUPE_DETECTED    = 50,
    BLOCKED_EVENT              = 5,
}

local function _getKey(source)
    local session = ATC.Sessions and ATC.Sessions.Get(source)
    return session and session.identifier or ('src:' .. tostring(source))
end

local function _getOrCreate(key)
    if not _riskStore[key] then
        _riskStore[key] = { score = 0, events = {} }
    end
    return _riskStore[key]
end

-- Risk level thresholds must match TS ATC_RISK_THRESHOLDS in @atc/shared-types.
-- Keep these in sync: normal=0, elevated=30, high=60, critical=85.
-- Action thresholds (kick/ban) are separate and live in ATC.Config.Security.
local _RISK_THRESHOLDS = { critical = 85, high = 60, elevated = 30 }

local function _getRiskLevel(score)
    if score >= _RISK_THRESHOLDS.critical then return 'critical' end
    if score >= _RISK_THRESHOLDS.high     then return 'high'     end
    if score >= _RISK_THRESHOLDS.elevated then return 'elevated' end
    return 'normal'
end

--- Add risk points to a player. Triggers kick/ban if thresholds exceeded.
--- @param source number FiveM player source
--- @param violationType string Key from VIOLATION_POINTS or custom string
--- @param customPoints number|nil Override point value
--- @param details table|nil Additional context for logging
function ATC.Security.AddRiskPoints(source, violationType, customPoints, details)
    local points = customPoints or VIOLATION_POINTS[violationType] or 5
    local key    = _getKey(source)
    local risk   = _getOrCreate(key)

    risk.score = risk.score + points
    table.insert(risk.events, {
        type      = violationType,
        points    = points,
        timestamp = os.time(),
        details   = details,
    })

    local level = _getRiskLevel(risk.score)

    ATC.Log.Security('security', 'Risk points added', {
        source        = source,
        identifier    = key,
        violationType = violationType,
        points        = points,
        totalScore    = risk.score,
        level         = level,
    })

    if risk.score >= ATC.Config.Security.AutoBanThreshold then
        ATC.Security.AutoBan(source, 'Risk score exceeded: ' .. risk.score)
    elseif risk.score >= ATC.Config.Security.AutoKickThreshold then
        ATC.Security.AutoKick(source, 'Risk score exceeded: ' .. risk.score)
    elseif level == 'elevated' then
        ATC.Log.Warn('security', 'Player risk elevated — monitoring', {
            source = source, key = key, score = risk.score,
        })
    end
end

--- Get the current risk data for a player.
--- @param source number FiveM player source
--- @return table { score, events, level }
function ATC.Security.GetRisk(source)
    local key  = _getKey(source)
    local risk = _riskStore[key] or { score = 0, events = {} }
    return {
        identifier = key,
        score      = risk.score,
        events     = risk.events,
        level      = _getRiskLevel(risk.score),
    }
end

--- Reset risk score (e.g. after manual admin review)
function ATC.Security.ResetRisk(source)
    local key = _getKey(source)
    _riskStore[key] = { score = 0, events = {} }
    ATC.Log.Audit('security', 'Risk score reset', { source = source, key = key })
end

--- Auto-kick a player due to security threshold.
function ATC.Security.AutoKick(source, reason)
    ATC.Log.Security('security', 'Auto-kick triggered', { source = source, reason = reason })
    DropPlayer(source, '[ATC Security] ' .. reason)
end

--- Auto-ban a player due to extreme risk score.
--- Phase 1: kick only. Phase 2: call API ban endpoint + evidence bundle.
function ATC.Security.AutoBan(source, reason)
    ATC.Log.Security('security', 'Auto-ban triggered (Phase 1: kick only)', {
        source = source,
        reason = reason,
    })
    -- TODO Phase 2: POST /api/v1/admin/bans with evidence bundle
    DropPlayer(source, '[ATC Security] Banned: ' .. reason)
end

-- ─── IAM Bridge — READ ONLY ───────────────────────────────────────────────────
-- These functions expose the IAM platform to Lua server scripts.
-- No mutation is allowed from Lua — all writes go through the TS API only.

local _cachedRoles = nil  -- cached role list from last successful API call

--- Fetch all built-in roles from the API.
--- @param cb function  Called with (ok, roles|nil, err|nil)
function ATC.Security.GetRoles(cb)
    if type(cb) ~= "function" then return end
    ATC.HTTP.Get('/api/v1/security/roles', function(ok, _status, data, err)
        if ok and type(data) == "table" and type(data.roles) == "table" then
            _cachedRoles = data.roles
        end
        cb(ok, ok and data or nil, not ok and err or nil)
    end)
end

--- Return the most recently cached role list without an HTTP round-trip.
--- @return table|nil
function ATC.Security.GetCachedRoles()
    return _cachedRoles
end

--- Check whether a principal has a given capability.
--- Calls POST /api/v1/security/capabilities/check and returns the result via cb.
--- @param params table  { principalId, principalType, roles, permissions, capabilities, denies, capability, trustLevel? }
--- @param cb function   Called with (ok, result|nil, err|nil)
function ATC.Security.CheckCapability(params, cb)
    if type(params) ~= "table" or type(cb) ~= "function" then return end
    ATC.HTTP.Post('/api/v1/security/capabilities/check', params, function(ok, _status, data, err)
        cb(ok, ok and data or nil, not ok and err or nil)
    end)
end

--- Fetch a page of audit events.
--- @param query table  { limit?, offset?, actorId?, action?, result? }
--- @param cb function  Called with (ok, page|nil, err|nil)
function ATC.Security.GetAuditSummary(query, cb)
    if type(cb) ~= "function" then return end
    local q = type(query) == "table" and query or {}
    local qs = ''
    local sep = '?'
    if q.limit   then qs = qs .. sep .. 'limit='   .. tostring(q.limit);   sep = '&' end
    if q.offset  then qs = qs .. sep .. 'offset='  .. tostring(q.offset);  sep = '&' end
    if q.actorId then qs = qs .. sep .. 'actorId=' .. tostring(q.actorId); sep = '&' end
    if q.action  then qs = qs .. sep .. 'action='  .. tostring(q.action);  sep = '&' end
    if q.result  then qs = qs .. sep .. 'result='  .. tostring(q.result);  end
    ATC.HTTP.Get('/api/v1/security/audit' .. qs, function(ok, _status, data, err)
        cb(ok, ok and data or nil, not ok and err or nil)
    end)
end

-- Update cached roles on startup
CreateThread(function()
    Wait(5000)
    ATC.Security.GetRoles(function(ok, data)
        if ok and data then
            ATC.Log.Info('security', 'IAM roles loaded', { total = data.total })
        end
    end)
end)
