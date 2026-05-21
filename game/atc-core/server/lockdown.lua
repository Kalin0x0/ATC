-- Phase 70: Final Runtime Consolidation, Deterministic Simulation Closure & Production Lockdown

local BASE = 'http://localhost:30120/api/v1/lockdown'

-- Runtime Lockdown
AddEventHandler('atc:lockdown:initiate', function(data, cb)
    PerformHttpRequest(BASE, function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:lockdown:activate', function(id, cb)
    PerformHttpRequest(BASE .. '/' .. id .. '/activate', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:lockdown:lift', function(id, cb)
    PerformHttpRequest(BASE .. '/' .. id .. '/lift', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:lockdown:fail', function(id, cb)
    PerformHttpRequest(BASE .. '/' .. id .. '/fail', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

-- Deterministic Closure
AddEventHandler('atc:lockdown:closure:start', function(data, cb)
    PerformHttpRequest(BASE .. '/closure', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:lockdown:closure:complete', function(id, cb)
    PerformHttpRequest(BASE .. '/closure/' .. id .. '/complete', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:lockdown:closure:abort', function(id, cb)
    PerformHttpRequest(BASE .. '/closure/' .. id .. '/abort', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

-- Production Integrity
AddEventHandler('atc:lockdown:integrity:create', function(data, cb)
    PerformHttpRequest(BASE .. '/integrity', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:lockdown:integrity:pass', function(id, cb)
    PerformHttpRequest(BASE .. '/integrity/' .. id .. '/pass', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:lockdown:integrity:fail', function(id, cb)
    PerformHttpRequest(BASE .. '/integrity/' .. id .. '/fail', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

-- Runtime Seals
AddEventHandler('atc:lockdown:seal:apply', function(data, cb)
    PerformHttpRequest(BASE .. '/seal', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:lockdown:seal:verify', function(id, cb)
    PerformHttpRequest(BASE .. '/seal/' .. id .. '/verify', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:lockdown:seal:break', function(id, cb)
    PerformHttpRequest(BASE .. '/seal/' .. id .. '/break', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

-- Distributed Finalization
AddEventHandler('atc:lockdown:finalization:start', function(data, cb)
    PerformHttpRequest(BASE .. '/finalization', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:lockdown:finalization:commit', function(id, cb)
    PerformHttpRequest(BASE .. '/finalization/' .. id .. '/commit', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:lockdown:finalization:rollback', function(id, cb)
    PerformHttpRequest(BASE .. '/finalization/' .. id .. '/rollback', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

-- Cleanup
AddEventHandler('atc:lockdown:cleanup', function(thresholdMs)
    PerformHttpRequest(BASE .. '/cleanup', function() end,
        'POST', json.encode({ thresholdMs = thresholdMs or 300000 }),
        { ['Content-Type'] = 'application/json' })
end)

-- Scheduled cleanup every 5 minutes
CreateThread(function()
    while true do
        Wait(300000)
        TriggerEvent('atc:lockdown:cleanup', 300000)
    end
end)
