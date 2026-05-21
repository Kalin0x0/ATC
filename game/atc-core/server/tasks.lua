-- ATC Core — Task Runtime Bridge (Phase 15)
-- Read-only bridge exposing task runtime metrics received from the TypeScript
-- task runtime via events. No task execution happens in Lua.
-- All state is populated by 'atc:task:*' events pushed from the API.
-- Client-side access is blocked entirely.

ATC = ATC or {}
ATC.Tasks = ATC.Tasks or {}

-- ─── Internal state cache ─────────────────────────────────────────────────────

local _metrics = {
    queuedTotal    = 0,
    completedTotal = 0,
    failedTotal    = 0,
    retriedTotal   = 0,
    activeWorkers  = 0,
    avgRuntimeMs   = 0.0,
}

local _queues       = {}  -- name → { depth, deadLetterSize, processingCount }
local _recentTasks  = {}  -- ring buffer, last 50 task events
local _maxRecent    = 50

-- ─── Internal helpers ─────────────────────────────────────────────────────────

local function _pushRecent(entry)
    table.insert(_recentTasks, entry)
    if #_recentTasks > _maxRecent then
        table.remove(_recentTasks, 1)
    end
end

-- ─── Public read-only API ─────────────────────────────────────────────────────

--- Get aggregate task runtime metrics.
--- @return table { queuedTotal, completedTotal, failedTotal, retriedTotal, activeWorkers, avgRuntimeMs }
function ATC.Tasks.GetMetrics()
    return {
        queuedTotal    = _metrics.queuedTotal,
        completedTotal = _metrics.completedTotal,
        failedTotal    = _metrics.failedTotal,
        retriedTotal   = _metrics.retriedTotal,
        activeWorkers  = _metrics.activeWorkers,
        avgRuntimeMs   = _metrics.avgRuntimeMs,
    }
end

--- Get metrics for a specific queue.
--- @param queueName string Queue name (e.g. 'atc:tasks:default')
--- @return table|nil { name, depth, deadLetterSize, processingCount } or nil if unknown
function ATC.Tasks.GetQueue(queueName)
    if type(queueName) ~= "string" then return nil end
    local q = _queues[queueName]
    if not q then return nil end
    return {
        name            = queueName,
        depth           = q.depth or 0,
        deadLetterSize  = q.deadLetterSize or 0,
        processingCount = q.processingCount or 0,
    }
end

--- Get all known queue names.
--- @return string[]
function ATC.Tasks.GetQueueNames()
    local names = {}
    for name, _ in pairs(_queues) do
        table.insert(names, name)
    end
    return names
end

--- Get recent task lifecycle events (last 50).
--- @return table[]
function ATC.Tasks.GetRecentEvents()
    local copy = {}
    for i, e in ipairs(_recentTasks) do
        copy[i] = e
    end
    return copy
end

--- Check if the task runtime is reporting activity.
--- @return boolean
function ATC.Tasks.IsActive()
    return _metrics.activeWorkers > 0
end

-- ─── Event handlers — populate cache from TS task runtime events ──────────────

AddEventHandler('atc:task:queued', function(data)
    if type(data) ~= "table" or type(data.taskId) ~= "string" then return end
    _metrics.queuedTotal = _metrics.queuedTotal + 1
    _pushRecent({ event = 'queued', taskId = data.taskId, type = data.type, pluginId = data.pluginId })
end)

AddEventHandler('atc:task:started', function(data)
    if type(data) ~= "table" then return end
    _metrics.activeWorkers = math.max(0, _metrics.activeWorkers + 1)
    _pushRecent({ event = 'started', taskId = data.taskId, type = data.type })
end)

AddEventHandler('atc:task:completed', function(data)
    if type(data) ~= "table" then return end
    _metrics.completedTotal = _metrics.completedTotal + 1
    _metrics.activeWorkers  = math.max(0, _metrics.activeWorkers - 1)
    if type(data.elapsedMs) == "number" and data.elapsedMs >= 0 then
        -- Weighted rolling average
        local total = _metrics.completedTotal
        _metrics.avgRuntimeMs = ((_metrics.avgRuntimeMs * (total - 1)) + data.elapsedMs) / total
    end
    _pushRecent({ event = 'completed', taskId = data.taskId, type = data.type })
end)

AddEventHandler('atc:task:failed', function(data)
    if type(data) ~= "table" then return end
    _metrics.failedTotal   = _metrics.failedTotal + 1
    _metrics.activeWorkers = math.max(0, _metrics.activeWorkers - 1)
    _pushRecent({ event = 'failed', taskId = data.taskId, type = data.type })
end)

AddEventHandler('atc:task:retrying', function(data)
    if type(data) ~= "table" then return end
    _metrics.retriedTotal  = _metrics.retriedTotal + 1
    _metrics.activeWorkers = math.max(0, _metrics.activeWorkers - 1)
    _pushRecent({ event = 'retrying', taskId = data.taskId, type = data.type, retryCount = data.retryCount })
end)

AddEventHandler('atc:task:cancelled', function(data)
    if type(data) ~= "table" then return end
    _pushRecent({ event = 'cancelled', taskId = data.taskId, type = data.type })
end)

-- Queue depth updates pushed from TS runtime
AddEventHandler('atc:task:queue:update', function(data)
    if type(data) ~= "table" or type(data.name) ~= "string" then return end
    _queues[data.name] = {
        depth           = data.depth or 0,
        deadLetterSize  = data.deadLetterSize or 0,
        processingCount = data.processingCount or 0,
    }
end)

-- ─── Guard: no client access ──────────────────────────────────────────────────
-- Task data is internal infrastructure — never exposed to clients.

if ATC.Log then
    ATC.Log.Info('tasks', 'Task runtime bridge initialised (read-only, server-side)')
end
