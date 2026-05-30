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

-- Object pool for frequently allocated tables
local _pool = {}
function ATC.Performance.GetTable()
    return table.remove(_pool) or {}
end
function ATC.Performance.ReleaseTable(t)
    for k in pairs(t) do t[k] = nil end
    if #_pool < 32 then table.insert(_pool, t) end
end
