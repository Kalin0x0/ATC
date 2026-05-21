-- ATC Core — Runtime Operations Bridge (Phase 16 + 17)
-- Thin Lua API over the /api/v1/ops/* endpoints.
-- All calls are async and server-side only. No client-side access.

ATC = ATC or {}
ATC.Ops = ATC.Ops or {}

-- ─── Internal state ───────────────────────────────────────────────────────────

local _lastHealthSnapshot   = nil  -- most recent health snapshot (cached from event)
local _lastClusterSnapshot  = nil  -- most recent cluster snapshot (cached from event)
local _lastPluginsSnapshot  = nil  -- most recent plugin list snapshot (cached from event)
local _bridgeReportedAt     = nil  -- ISO timestamp of last ATC.Ops.ReportBridgeStatus()

-- ─── Public API ───────────────────────────────────────────────────────────────

--- Fetch the full runtime health snapshot from the API.
--- @param cb function  Called with (ok, snapshot|nil, err|nil)
function ATC.Ops.GetHealth(cb)
    if type(cb) ~= "function" then return end
    ATC.HTTP.Get('/api/v1/ops/health', function(ok, _status, data, err)
        if ok and type(data) == "table" then
            _lastHealthSnapshot = data
        end
        cb(ok, ok and data or nil, not ok and err or nil)
    end)
end

--- Fetch a diagnostics snapshot (subsystem detail + task/event counts).
--- @param cb function  Called with (ok, diagnostics|nil, err|nil)
function ATC.Ops.GetDiagnostics(cb)
    if type(cb) ~= "function" then return end
    ATC.HTTP.Get('/api/v1/ops/diagnostics', function(ok, _status, data, err)
        cb(ok, ok and data or nil, not ok and err or nil)
    end)
end

--- Return the most recently cached health snapshot without an HTTP round-trip.
--- May be nil if no snapshot has been received yet.
--- @return table|nil
function ATC.Ops.GetCachedHealth()
    return _lastHealthSnapshot
end

--- Report this FiveM server's bridge status to the event bus.
--- Emits 'atc:ops:bridge:status' with the current uptime and resource name.
function ATC.Ops.ReportBridgeStatus()
    local now = os.date('!%Y-%m-%dT%H:%M:%SZ')
    _bridgeReportedAt = now

    local payload = {
        resource    = GetCurrentResourceName(),
        gameType    = 'fivem',
        reportedAt  = now,
        status      = 'online',
    }

    -- Broadcast to the TS event bus via a server event (internal, no client access)
    TriggerEvent('atc:ops:bridge:status', payload)

    if ATC.Log then
        ATC.Log.Info('ops', 'Bridge status reported at ' .. now)
    end
end

--- Get the ISO timestamp of the last bridge status report, or nil.
--- @return string|nil
function ATC.Ops.GetLastReportedAt()
    return _bridgeReportedAt
end

--- Fetch the current cluster snapshot from the API.
--- Returns node registry, stale-node count, leader, and worker counts.
--- @param cb function  Called with (ok, snapshot|nil, err|nil)
function ATC.Ops.GetClusterState(cb)
    if type(cb) ~= "function" then return end
    ATC.HTTP.Get('/api/v1/ops/cluster', function(ok, _status, data, err)
        if ok and type(data) == "table" then
            _lastClusterSnapshot = data
        end
        cb(ok, ok and data or nil, not ok and err or nil)
    end)
end

--- Return the most recently cached cluster snapshot without an HTTP round-trip.
--- May be nil if GetClusterState has not been called yet.
--- @return table|nil
function ATC.Ops.GetCachedClusterState()
    return _lastClusterSnapshot
end

--- Fetch just the current scheduler leader instanceId.
--- @param cb function  Called with (ok, leaderId|nil, err|nil)
function ATC.Ops.GetLeader(cb)
    if type(cb) ~= "function" then return end
    ATC.HTTP.Get('/api/v1/ops/cluster', function(ok, _status, data, err)
        if ok and type(data) == "table" then
            cb(true, data.leader, nil)
        else
            cb(false, nil, err)
        end
    end)
end

--- Fetch the list of active cluster nodes.
--- @param cb function  Called with (ok, nodes|nil, err|nil)
function ATC.Ops.GetNodeInfo(cb)
    if type(cb) ~= "function" then return end
    ATC.HTTP.Get('/api/v1/ops/nodes', function(ok, _status, data, err)
        if ok and type(data) == "table" then
            cb(true, data.nodes, nil)
        else
            cb(false, nil, err)
        end
    end)
end

--- Fetch the list of all registered plugins with their health state.
--- Read-only — does not trigger any lifecycle changes.
--- @param cb function  Called with (ok, plugins|nil, err|nil)
function ATC.Ops.GetPlugins(cb)
    if type(cb) ~= "function" then return end
    ATC.HTTP.Get('/api/v1/ops/plugins', function(ok, _status, data, err)
        if ok and type(data) == "table" then
            _lastPluginsSnapshot = data.plugins
            cb(true, data.plugins, nil)
        else
            cb(false, nil, err)
        end
    end)
end

--- Return the most recently cached plugin list without an HTTP round-trip.
--- May be nil if GetPlugins has not been called yet.
--- @return table|nil
function ATC.Ops.GetCachedPlugins()
    return _lastPluginsSnapshot
end

--- Fetch state and health for a single plugin by its ID.
--- Read-only — does not trigger any lifecycle changes.
--- @param pluginId string  The plugin ID to look up
--- @param cb function      Called with (ok, plugin|nil, err|nil)
function ATC.Ops.GetPlugin(pluginId, cb)
    if type(pluginId) ~= "string" or pluginId == "" then return end
    if type(cb) ~= "function" then return end
    ATC.HTTP.Get('/api/v1/ops/plugins/' .. pluginId, function(ok, _status, data, err)
        cb(ok, ok and data or nil, not ok and err or nil)
    end)
end

--- Fetch the health snapshot for a single plugin.
--- Returns the plugin's state, uptime, crash count, resource usage, and last error.
--- @param pluginId string  The plugin ID to look up
--- @param cb function      Called with (ok, health|nil, err|nil)
function ATC.Ops.GetPluginHealth(pluginId, cb)
    if type(pluginId) ~= "string" or pluginId == "" then return end
    if type(cb) ~= "function" then return end
    ATC.HTTP.Get('/api/v1/ops/plugins/' .. pluginId, function(ok, _status, data, err)
        if ok and type(data) == "table" then
            -- Extract just the health-relevant fields
            local health = {
                pluginId     = data.id,
                state        = data.state,
                healthStatus = data.healthStatus,
                uptimeMs     = data.uptimeMs,
                restartCount = data.restartCount,
                crashCount   = data.crashCount,
                lastError    = data.lastError,
                lastCrashAt  = data.lastCrashAt,
                resourceUsage = data.resourceUsage,
            }
            cb(true, health, nil)
        else
            cb(false, nil, err)
        end
    end)
end

-- ─── Event handlers ───────────────────────────────────────────────────────────

-- Cache incoming health snapshots pushed from the TS layer
AddEventHandler('atc:ops:health:snapshot', function(data)
    if type(data) == "table" and type(data.status) == "string" then
        _lastHealthSnapshot = data
    end
end)

-- Cache incoming cluster snapshots pushed from the TS layer
AddEventHandler('atc:ops:cluster:snapshot', function(data)
    if type(data) == "table" then
        _lastClusterSnapshot = data
    end
end)

-- Cache incoming plugin list snapshots pushed from the TS layer
AddEventHandler('atc:ops:plugins:snapshot', function(data)
    if type(data) == "table" then
        _lastPluginsSnapshot = data
    end
end)

-- ─── Guard: no client access ──────────────────────────────────────────────────

if ATC.Log then
    ATC.Log.Info('ops', 'Runtime operations bridge initialised (server-side)')
end
