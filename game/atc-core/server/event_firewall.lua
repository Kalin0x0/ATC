-- ATC Core — Event Firewall v0
-- Whitelist-based server event filter with rate limiting and logging.
-- All client→server events must be registered here before use.

ATC = ATC or {}
ATC.Firewall = ATC.Firewall or {}

local _registry = {}            -- eventName → config
local _rateCounts = {}          -- 'source:event' → { count, windowStart }

-- ── Internal helpers ────────────────────────────────────────────────────────

local function _rateLimitKey(source, eventName)
    return tostring(source) .. ':' .. eventName
end

local function _checkRateLimit(source, eventName, config)
    if not config.rateLimit then return true end

    local key = _rateLimitKey(source, eventName)
    local now = GetGameTimer()

    if not _rateCounts[key] then
        _rateCounts[key] = { count = 0, windowStart = now }
    end

    local bucket = _rateCounts[key]

    -- Reset window if expired
    if (now - bucket.windowStart) >= config.rateLimit.window then
        bucket.count       = 0
        bucket.windowStart = now
    end

    bucket.count = bucket.count + 1

    if bucket.count > config.rateLimit.max then
        ATC.Log.Security('firewall', 'Rate limit exceeded', {
            source    = source,
            event     = eventName,
            count     = bucket.count,
            maxAllowed = config.rateLimit.max,
            windowMs  = config.rateLimit.window,
        })
        ATC.Security.AddRiskPoints(source, 'RATE_LIMIT_EXCEEDED', nil, { event = eventName })
        return false
    end

    return true
end

-- ── Public API ───────────────────────────────────────────────────────────────

--- Register an event in the whitelist.
--- @param eventName string Full ATC event name
--- @param config table { clientAllowed, requireSession, rateLimit, schemaId }
function ATC.Firewall.Register(eventName, config)
    _registry[eventName] = {
        clientAllowed  = config.clientAllowed  ~= false,    -- default true
        requireSession = config.requireSession ~= false,    -- default true
        rateLimit      = config.rateLimit or { window = 2000, max = 10 },
        schemaId       = config.schemaId,
    }
    ATC.Log.Debug('firewall', 'Event registered', { event = eventName })
end

--- Check whether an event from a given source is allowed.
--- Returns: allowed (bool), reason (string|nil)
function ATC.Firewall.Check(eventName, source)
    local rule = _registry[eventName]

    if not rule then
        ATC.Log.Security('firewall', 'Unknown event blocked', {
            event  = eventName,
            source = source,
        })
        ATC.Security.AddRiskPoints(source, 'EVENT_NOT_WHITELISTED', nil, { event = eventName })
        return false, 'EVENT_NOT_WHITELISTED'
    end

    if not rule.clientAllowed then
        ATC.Log.Security('firewall', 'Client-disallowed event blocked', {
            event  = eventName,
            source = source,
        })
        ATC.Security.AddRiskPoints(source, 'CLIENT_NOT_ALLOWED', nil, { event = eventName })
        return false, 'CLIENT_NOT_ALLOWED'
    end

    if rule.requireSession then
        local session = ATC.Sessions and ATC.Sessions.Get(source)
        if not session then
            ATC.Log.Security('firewall', 'Event requires session — no session found', {
                event  = eventName,
                source = source,
            })
            ATC.Security.AddRiskPoints(source, 'NO_SESSION', nil, { event = eventName })
            return false, 'NO_SESSION'
        end
    end

    if not _checkRateLimit(source, eventName, rule) then
        return false, 'RATE_LIMIT_EXCEEDED'
    end

    return true, nil
end

--- Safe RegisterNetEvent wrapper.
--- Registers the event in the firewall AND sets up the handler with automatic checks.
--- @param eventName string Full ATC event name
--- @param config table Firewall config (see Register)
--- @param handler function function(source, payload)
function ATC.Firewall.On(eventName, config, handler)
    ATC.Firewall.Register(eventName, config)
    RegisterNetEvent(eventName)
    AddEventHandler(eventName, function(payload)
        local src = source
        local allowed, reason = ATC.Firewall.Check(eventName, src)
        if not allowed then
            ATC.Log.Warn('firewall', 'Handler skipped — event denied', {
                event  = eventName,
                source = src,
                reason = reason,
            })
            return
        end
        handler(src, payload)
    end)
end

--- Clean up stale rate limit windows periodically.
--- Called from main.lua on a timer.
function ATC.Firewall.CleanupRateLimits()
    local now     = GetGameTimer()
    local cleaned = 0
    for key, bucket in pairs(_rateCounts) do
        if (now - bucket.windowStart) > 60000 then
            _rateCounts[key] = nil
            cleaned = cleaned + 1
        end
    end
    if cleaned > 0 then
        ATC.Log.Debug('firewall', 'Rate limit buckets cleaned', { count = cleaned })
    end
end

-- Core event registrations live in server/main.lua via ATC.Firewall.On,
-- which is the single authoritative source for handler + whitelist config.
