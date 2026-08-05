-- ============================================================
-- ATC — Atlantic Core
-- server/sdk.lua — server-side ATC.SDK surface
--
-- The runtime bridges under game/atc-core/server call ATC.SDK.* throughout,
-- but ATC.SDK was only ever created in client/sdk.lua. On the server the table
-- did not exist, so every one of those calls raised
-- "attempt to index a nil value (field 'SDK')" and the handler died on its
-- first line. This file defines that surface for the server.
--
-- It is a thin facade: nothing here owns state that another module owns. It
-- delegates to ATC.Config, ATC.Log, ATC.HTTP and ATC.Sessions, so behaviour
-- stays identical to calling those directly.
--
-- Note the two HTTP shapes, both of which the existing callers use:
--   ATC.SDK.HTTP.Post(path, payload)      -> synchronous, returns ok, err, ...
--   ATC.SDK.Post(path, payload, callback) -> asynchronous, callback style
-- Both are genuine call sites in this codebase, so both are supported.
-- ============================================================

ATC     = ATC or {}
ATC.SDK = ATC.SDK or {}

-- ── Auth ────────────────────────────────────────────────────────────────────
-- The server token identifies this game server to the ATC API. It comes from
-- the atc_server_token convar via ATC.Config; see infra/server.cfg.example.

ATC.SDK.Auth = ATC.SDK.Auth or {}

--- Returns the configured server token, or '' when unset.
--- Never returns nil: callers embed it in payloads without checking.
function ATC.SDK.Auth.GetServerToken()
    return (ATC.Config and ATC.Config.ServerToken) or ''
end

--- Returns the API bearer token, or '' when unset.
function ATC.SDK.Auth.GetApiToken()
    return (ATC.Config and ATC.Config.ApiToken) or ''
end

-- ── Server identity ─────────────────────────────────────────────────────────

ATC.SDK.Server = ATC.SDK.Server or {}

--- Unique id of this server instance (atc_server_id convar).
function ATC.SDK.Server.GetId()
    return (ATC.Config and ATC.Config.ServerId) or 'default'
end

--- Base URL of the ATC API.
function ATC.SDK.Server.GetApiBase()
    return (ATC.Config and ATC.Config.ApiBase) or 'http://localhost:3000'
end

-- ── Logging ─────────────────────────────────────────────────────────────────
-- Delegates to ATC.Log (server/logger.lua). Guarded so a load-order change
-- degrades to print() instead of taking the calling handler down with it.

ATC.SDK.Log = ATC.SDK.Log or {}

local function _log(level, category, message, data)
    if ATC.Log and type(ATC.Log[level]) == 'function' then
        return ATC.Log[level](category, message, data)
    end
    print(('[ATC:%s] [%s] %s'):format(level:upper(), tostring(category), tostring(message)))
end

function ATC.SDK.Log.Info(category, message, data)  _log('Info',  category, message, data) end
function ATC.SDK.Log.Warn(category, message, data)  _log('Warn',  category, message, data) end
function ATC.SDK.Log.Error(category, message, data) _log('Error', category, message, data) end
function ATC.SDK.Log.Debug(category, message, data) _log('Debug', category, message, data) end

-- ── Identifiers ─────────────────────────────────────────────────────────────
-- The API validates these as z.string().min(1).max(128), so the format is free.
-- Server id + timestamp + sequence + random keeps them unique across restarts
-- and across servers sharing one API.

ATC.SDK.Id = ATC.SDK.Id or {}

local _idSeq = 0

--- Generates a unique identifier string.
--- @param prefix string|nil Optional prefix; defaults to this server's id.
function ATC.SDK.Id.Generate(prefix)
    _idSeq = _idSeq + 1
    if _idSeq > 0xFFFFFF then _idSeq = 1 end

    local base = prefix or ATC.SDK.Server.GetId()
    if type(base) ~= 'string' or base == '' then base = 'atc' end
    -- Keep well inside the API's 128-character limit.
    if #base > 64 then base = base:sub(1, 64) end

    return ('%s-%x-%x-%04x'):format(base, os.time(), _idSeq, math.random(0, 0xFFFF))
end

-- ── Players ─────────────────────────────────────────────────────────────────
-- Reads the session table (server/sessions.lua). GetPlayers() hands back
-- strings, so the source is normalised before lookup.

ATC.SDK.Player = ATC.SDK.Player or {}

local function _session(src)
    if not (ATC.Sessions and type(ATC.Sessions.Get) == 'function') then return nil end
    local key = tonumber(src) or src
    return ATC.Sessions.Get(key) or ATC.Sessions.Get(tostring(src))
end

--- Persistent player identity: the selected character id, or nil.
function ATC.SDK.Player.GetId(src)
    local s = _session(src)
    return s and s.characterId or nil
end

--- Full character table for the source, or nil when none is selected.
function ATC.SDK.Player.GetCharacter(src)
    local s = _session(src)
    return s and s.characterData or nil
end

--- Session id for the source, or nil.
function ATC.SDK.Player.GetSessionId(src)
    local s = _session(src)
    return s and s.id or nil
end

-- ── Rate limiting ───────────────────────────────────────────────────────────
-- Fixed window per (source, key). server/event_firewall.lua rate-limits events
-- by name; this is the per-handler variant the runtime bridges ask for, e.g.
-- ATC.SDK.RateLimit.Check(source, 'combat:ballistic', 60).

ATC.SDK.RateLimit = ATC.SDK.RateLimit or {}

local _buckets    = {}
local _lastPrune  = 0
local WINDOW_SECS = 60

local function _prune(now)
    -- Buckets are keyed per source; a player who disconnects would otherwise
    -- leave one behind forever. Sweep at most once per window.
    if (now - _lastPrune) < WINDOW_SECS then return end
    _lastPrune = now
    for k, b in pairs(_buckets) do
        if (now - b.start) >= (WINDOW_SECS * 2) then _buckets[k] = nil end
    end
end

--- @param src number|string Event source
--- @param key string Logical action name
--- @param max number|nil Maximum calls per 60s window (default 60)
--- @return boolean allowed true when the call is within the limit
function ATC.SDK.RateLimit.Check(src, key, max)
    local limit = tonumber(max) or 60
    if limit <= 0 then return false end

    local now    = os.time()
    local bucket = _buckets[tostring(src) .. ':' .. tostring(key)]
    _prune(now)

    if not bucket or (now - bucket.start) >= WINDOW_SECS then
        _buckets[tostring(src) .. ':' .. tostring(key)] = { count = 1, start = now }
        return true
    end

    bucket.count = bucket.count + 1
    return bucket.count <= limit
end

-- ── HTTP ────────────────────────────────────────────────────────────────────
-- Wraps ATC.HTTP (server/http.lua), which is callback-based:
--   callback(ok, status, data, err)
--
-- Callers here use `local ok, err = ATC.SDK.HTTP.Post(...)`, so the synchronous
-- form resolves the callback through a promise. That only works inside a
-- Citizen coroutine — which every AddEventHandler body is. Outside one,
-- Citizen.Await would raise, so the call falls back to fire-and-forget: the
-- request still goes out, and the caller is told nothing failed, because at
-- that point nothing is known to have failed. Reporting a false error there
-- would be worse than reporting none.

ATC.SDK.HTTP = ATC.SDK.HTTP or {}

local function _canAwait()
    if promise == nil or Citizen == nil or type(Citizen.Await) ~= 'function' then
        return false
    end
    local co, isMain = coroutine.running()
    return co ~= nil and isMain ~= true
end

-- Runs `start(resolve)` and waits for its callback.
-- Returns ok, err, data, status.
local function _sync(start)
    if not _canAwait() then
        start(function() end)
        return true, nil, nil, 0
    end

    local p = promise.new()
    start(function(ok, status, data, err)
        p:resolve({ ok = ok, status = status, data = data, err = err })
    end)

    local awaited, res = pcall(Citizen.Await, p)
    if not awaited or type(res) ~= 'table' then
        return false, 'ATC.SDK.HTTP: request did not complete', nil, 0
    end
    return res.ok == true, res.err, res.data, res.status or 0
end

local function _httpReady()
    return ATC.HTTP ~= nil
end

function ATC.SDK.HTTP.Get(path)
    if not _httpReady() then return false, 'ATC.HTTP unavailable' end
    return _sync(function(cb) ATC.HTTP.Get(path, cb) end)
end

function ATC.SDK.HTTP.Post(path, payload)
    if not _httpReady() then return false, 'ATC.HTTP unavailable' end
    return _sync(function(cb) ATC.HTTP.Post(path, payload or {}, cb) end)
end

function ATC.SDK.HTTP.Delete(path)
    if not _httpReady() then return false, 'ATC.HTTP unavailable' end
    return _sync(function(cb) ATC.HTTP.Delete(path, cb) end)
end

function ATC.SDK.HTTP.Patch(path, payload)
    if not _httpReady() then return false, 'ATC.HTTP unavailable' end
    return _sync(function(cb) ATC.HTTP.Patch(path, payload or {}, cb) end)
end

-- ── HTTP, callback form ─────────────────────────────────────────────────────
-- ATC.SDK.Post/Get/Delete are the asynchronous shorthand used by the other
-- half of the bridges. The callback is optional and receives ATC.HTTP's
-- signature unchanged: (ok, status, data, err).

local function _async(method, path, payload, callback)
    local cb = (type(callback) == 'function') and callback or function() end
    if not _httpReady() then
        cb(false, 0, nil, 'ATC.HTTP unavailable')
        return
    end
    if method == 'Get' or method == 'Delete' then
        ATC.HTTP[method](path, cb)
    else
        ATC.HTTP[method](path, payload or {}, cb)
    end
end

function ATC.SDK.Get(path, callback)             _async('Get',    path, nil,     callback) end
function ATC.SDK.Post(path, payload, callback)   _async('Post',   path, payload, callback) end
function ATC.SDK.Delete(path, callback)          _async('Delete', path, nil,     callback) end
function ATC.SDK.Patch(path, payload, callback)  _async('Patch',  path, payload, callback) end
