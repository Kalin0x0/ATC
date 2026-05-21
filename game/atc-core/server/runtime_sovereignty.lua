-- Phase 72: Autonomous Runtime Sovereignty, Infinite Cluster Continuity & Global Runtime Finalization

local BASE = 'http://localhost:30120/api/v1/runtime-sovereignty'

-- Runtime Sovereignty
AddEventHandler('atc:sovereignty:establish', function(data, cb)
    PerformHttpRequest(BASE, function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:sovereignty:confirm', function(id, cb)
    PerformHttpRequest(BASE .. '/' .. id .. '/confirm', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:sovereignty:challenge', function(id, cb)
    PerformHttpRequest(BASE .. '/' .. id .. '/challenge', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:sovereignty:revoke', function(id, cb)
    PerformHttpRequest(BASE .. '/' .. id .. '/revoke', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:sovereignty:expire', function(id, cb)
    PerformHttpRequest(BASE .. '/' .. id .. '/expire', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

-- Infinite Cluster Continuity
AddEventHandler('atc:sovereignty:cluster:register', function(data, cb)
    PerformHttpRequest(BASE .. '/cluster', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:sovereignty:cluster:degrade', function(id, cb)
    PerformHttpRequest(BASE .. '/cluster/' .. id .. '/degrade', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:sovereignty:cluster:recover', function(id, cb)
    PerformHttpRequest(BASE .. '/cluster/' .. id .. '/recover', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:sovereignty:cluster:fail', function(id, cb)
    PerformHttpRequest(BASE .. '/cluster/' .. id .. '/fail', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

-- Autonomous Finalization
AddEventHandler('atc:sovereignty:finalization:initiate', function(data, cb)
    PerformHttpRequest(BASE .. '/finalization', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:sovereignty:finalization:process', function(id, cb)
    PerformHttpRequest(BASE .. '/finalization/' .. id .. '/process', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:sovereignty:finalization:complete', function(id, cb)
    PerformHttpRequest(BASE .. '/finalization/' .. id .. '/complete', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:sovereignty:finalization:abort', function(id, cb)
    PerformHttpRequest(BASE .. '/finalization/' .. id .. '/abort', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:sovereignty:finalization:fail', function(id, cb)
    PerformHttpRequest(BASE .. '/finalization/' .. id .. '/fail', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

-- Runtime Succession
AddEventHandler('atc:sovereignty:succession:initiate', function(data, cb)
    PerformHttpRequest(BASE .. '/succession', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:sovereignty:succession:transfer', function(id, cb)
    PerformHttpRequest(BASE .. '/succession/' .. id .. '/transfer', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:sovereignty:succession:complete', function(id, cb)
    PerformHttpRequest(BASE .. '/succession/' .. id .. '/complete', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:sovereignty:succession:fail', function(id, cb)
    PerformHttpRequest(BASE .. '/succession/' .. id .. '/fail', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:sovereignty:succession:revert', function(id, cb)
    PerformHttpRequest(BASE .. '/succession/' .. id .. '/revert', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

-- Coordination
AddEventHandler('atc:sovereignty:coordination:upsert', function(data, cb)
    PerformHttpRequest(BASE .. '/coordination', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:sovereignty:coordination:suspend', function(id, cb)
    PerformHttpRequest(BASE .. '/coordination/' .. id .. '/suspend', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:sovereignty:coordination:expire', function(id, cb)
    PerformHttpRequest(BASE .. '/coordination/' .. id .. '/expire', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

-- Cleanup
AddEventHandler('atc:sovereignty:cleanup', function(thresholdMs)
    PerformHttpRequest(BASE .. '/cleanup', function() end,
        'POST', json.encode({ thresholdMs = thresholdMs or 300000 }),
        { ['Content-Type'] = 'application/json' })
end)

-- Scheduled cleanup every 5 minutes
CreateThread(function()
    while true do
        Wait(300000)
        TriggerEvent('atc:sovereignty:cleanup', 300000)
    end
end)
