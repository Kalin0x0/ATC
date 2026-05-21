-- ATC Core — Plugin State Bridge (Phase 13)
-- Combines Phase 1 Lua plugin registration with Phase 13 health state bridge.
-- The TypeScript registry is authoritative; this file caches states received
-- from API events and exposes a read-only view to other Lua resources.
-- No plugin code is executed here. No client access.

ATC = ATC or {}
ATC.Plugins = ATC.Plugins or {}

-- ─── Phase 1 Lua-side manifest registry ───────────────────────────────────

local _luaRegistry  = {}  -- id → { manifest, status, registeredAt }
local _loadOrder    = {}

--- Register a FiveM resource plugin with ATC Core (Lua side only).
--- @param manifest table Must have id, name, version, apiVersion
--- @return boolean success
function ATC.Plugins.Register(manifest)
    if type(manifest) ~= "table" or type(manifest.id) ~= "string" then
        if ATC.Log then ATC.Log.Error('plugins', 'Plugin registration failed — missing or invalid id') end
        return false
    end

    if not manifest.version or not manifest.apiVersion then
        if ATC.Log then ATC.Log.Error('plugins', 'Plugin registration failed — missing version/apiVersion', { id = manifest.id }) end
        return false
    end

    if ATC.Config and manifest.apiVersion ~= ATC.Config.ApiVersion then
        if ATC.Log then ATC.Log.Warn('plugins', 'Plugin API version mismatch', { id = manifest.id }) end
    end

    if _luaRegistry[manifest.id] then
        if ATC.Log then ATC.Log.Warn('plugins', 'Plugin already registered', { id = manifest.id }) end
        return false
    end

    _luaRegistry[manifest.id] = {
        manifest     = manifest,
        status       = 'registered',
        registeredAt = os.time(),
    }
    table.insert(_loadOrder, manifest.id)

    if ATC.Log then
        ATC.Log.Info('plugins', 'Plugin registered', { id = manifest.id, version = manifest.version })
    end

    return true
end

function ATC.Plugins.SetStatus(id, status, errorMsg)
    if not _luaRegistry[id] then return end
    _luaRegistry[id].status = status
    if errorMsg then _luaRegistry[id].errorMessage = errorMsg end
end

function ATC.Plugins.IsReady(id)
    return _luaRegistry[id] ~= nil and _luaRegistry[id].status == 'ready'
end

function ATC.Plugins.GetLoadOrder()
    return _loadOrder
end

function ATC.Plugins.MarkReady(id)
    ATC.Plugins.SetStatus(id, 'ready')
    TriggerEvent(ATC.Events and ATC.Events.CORE and ATC.Events.CORE.PLUGIN_READY or 'atc:core:plugin:ready', { id = id })
end

-- ─── Phase 13 TypeScript registry state bridge (read-only) ────────────────

local _runtimeStates = {}  -- [pluginId] = { id, status, healthStatus, restartCount, failures, lastError, apiCalls, deniedCalls, activeSubscriptions, activeTimers, uptimeMs }

local function _safeStr(v, fallback)
    return (type(v) == "string" and #v > 0) and v or (fallback or "unknown")
end

local function _safeInt(v, fallback)
    return type(v) == "number" and math.floor(v) or (fallback or 0)
end

--- Returns all known runtime plugin states (from TypeScript registry via events).
function ATC.Plugins.GetAll()
    local result = {}
    -- Merge Lua registry
    for id, entry in pairs(_luaRegistry) do
        result[id] = { id = id, status = entry.status, source = "lua" }
    end
    -- Overlay TypeScript runtime states
    for id, state in pairs(_runtimeStates) do
        result[id] = {
            id           = state.id,
            status       = state.status,
            healthStatus = state.healthStatus,
            restartCount = state.restartCount,
            failures     = state.failures,
            lastError    = state.lastError,
            source       = "typescript",
        }
    end
    return result
end

--- Returns the TypeScript runtime state for a single plugin (nil if unknown).
function ATC.Plugins.GetRuntime(pluginId)
    if type(pluginId) ~= "string" then return nil end
    local s = _runtimeStates[pluginId]
    if not s then return nil end
    return {
        id                  = s.id,
        status              = s.status,
        healthStatus        = s.healthStatus,
        restartCount        = s.restartCount,
        failures            = s.failures,
        lastError           = s.lastError,
        apiCalls            = s.apiCalls,
        deniedCalls         = s.deniedCalls,
        activeSubscriptions = s.activeSubscriptions,
        activeTimers        = s.activeTimers,
        uptimeMs            = s.uptimeMs,
    }
end

--- Returns true if plugin is active and not failed.
function ATC.Plugins.IsRunning(pluginId)
    local s = _runtimeStates[pluginId]
    if not s then return false end
    return s.status == "active" and s.healthStatus ~= "failed"
end

--- Returns the health status string for a runtime plugin.
function ATC.Plugins.GetHealth(pluginId)
    local s = _runtimeStates[pluginId]
    return s and _safeStr(s.healthStatus, "unknown") or "unknown"
end

-- ─── Event handlers ────────────────────────────────────────────────────────

AddEventHandler("atc:plugin:update", function(payload)
    if type(payload) ~= "table" then return end
    local id = payload.pluginId
    if type(id) ~= "string" or #id == 0 then return end
    _runtimeStates[id] = {
        id                  = id,
        status              = _safeStr(payload.status, "unknown"),
        healthStatus        = _safeStr(payload.healthStatus, "unknown"),
        restartCount        = _safeInt(payload.restartCount, 0),
        failures            = _safeInt(payload.failures, 0),
        lastError           = type(payload.lastError) == "string" and payload.lastError or nil,
        apiCalls            = _safeInt(payload.apiCalls, 0),
        deniedCalls         = _safeInt(payload.deniedCalls, 0),
        activeSubscriptions = _safeInt(payload.activeSubscriptions, 0),
        activeTimers        = _safeInt(payload.activeTimers, 0),
        uptimeMs            = _safeInt(payload.uptimeMs, 0),
    }
end)

AddEventHandler("atc:plugin:failed", function(payload)
    if type(payload) ~= "table" then return end
    local id = payload.pluginId
    if type(id) ~= "string" or #id == 0 then return end
    if _runtimeStates[id] then
        _runtimeStates[id].status = "failed"
        if type(payload.error) == "string" then _runtimeStates[id].lastError = payload.error end
    end
    if ATC.Log then
        pcall(function() ATC.Log.Error('plugins', 'Plugin failed: ' .. id, { error = tostring(payload.error or "") }) end)
    end
end)

AddEventHandler("atc:plugin:disabled", function(payload)
    if type(payload) ~= "table" then return end
    local id = payload.pluginId
    if type(id) ~= "string" or #id == 0 then return end
    if _runtimeStates[id] then _runtimeStates[id].status = "disabled" end
    if ATC.Log then
        pcall(function() ATC.Log.Warn('plugins', 'Plugin disabled: ' .. id, { reason = tostring(payload.reason or "") }) end)
    end
end)

AddEventHandler("atc:plugin:reloaded", function(payload)
    if type(payload) ~= "table" then return end
    local id = payload.pluginId
    if type(id) ~= "string" or #id == 0 then return end
    if _runtimeStates[id] then
        _runtimeStates[id].status = "active"
        _runtimeStates[id].restartCount = (_runtimeStates[id].restartCount or 0) + 1
    end
end)

AddEventHandler("atc:plugin:started", function(payload)
    if type(payload) ~= "table" then return end
    local id = payload.pluginId
    if type(id) ~= "string" or #id == 0 then return end
    if _runtimeStates[id] then _runtimeStates[id].status = "active" end
end)
