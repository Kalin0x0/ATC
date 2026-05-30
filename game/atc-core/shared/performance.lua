-- ATC Performance utilities — tick budget tracking, thread management
ATC = ATC or {}
ATC.Performance = ATC.Performance or {}

local _threadStats = {}
local _budgetMs    = 5.0  -- max ms per frame for ATC threads

-- Track a named thread's tick time
function ATC.Performance.TrackThread(name, fn)
    return function()
        local start = GetGameTimer()
        fn()
        local elapsed = GetGameTimer() - start
        _threadStats[name] = { lastMs=elapsed, name=name }
        if elapsed > _budgetMs and ATC.Config and ATC.Config.Debug then
            ATC.Log.Warn('performance', 'Thread over budget', { thread=name, ms=elapsed })
        end
    end
end

-- Get stats (called by telemetry)
function ATC.Performance.GetStats()
    return _threadStats
end

-- Enforced tick budget for critical threads
local _BUDGET_MS = 10  -- hard cap per thread tick

--- Wrap a thread function to enforce budget and yield if over budget
function ATC.Performance.GuardedThread(name, intervalMs, fn)
    CreateThread(function()
        while true do
            local t0 = GetGameTimer()
            local ok, err = pcall(fn)
            if not ok then
                ATC.Log.Warn('performance', 'Thread error', { thread=name, err=tostring(err) })
            end
            local elapsed = GetGameTimer() - t0
            if elapsed > _BUDGET_MS then
                ATC.Log.Debug('performance', 'Thread over budget', { thread=name, ms=elapsed, budget=_BUDGET_MS })
            end
            Wait(math.max(0, intervalMs - elapsed))
        end
    end)
end

-- Object pool for frequently allocated tables
local _pool = {}
function ATC.Performance.GetTable()
    return table.remove(_pool) or {}
end
function ATC.Performance.ReleaseTable(t)
    for k in pairs(t) do t[k] = nil end
    if #_pool < 32 then table.insert(_pool, t) end
end
