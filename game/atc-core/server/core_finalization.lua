-- Phase 73: ATC Core Deterministic Runtime Completion & Permanent Production Seal

local BASE = 'http://localhost:30120/api/v1/core-finalization'

-- Core Finalization
AddEventHandler('atc:core_finalization:initiate', function(data, cb)
    PerformHttpRequest(BASE, function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:core_finalization:activate', function(id, cb)
    PerformHttpRequest(BASE .. '/' .. id .. '/activate', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:core_finalization:begin_completing', function(id, cb)
    PerformHttpRequest(BASE .. '/' .. id .. '/begin-completing', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:core_finalization:complete', function(id, cb)
    PerformHttpRequest(BASE .. '/' .. id .. '/complete', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:core_finalization:fail', function(id, cb)
    PerformHttpRequest(BASE .. '/' .. id .. '/fail', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

-- Deterministic Sealing
AddEventHandler('atc:core_finalization:sealing:create', function(data, cb)
    PerformHttpRequest(BASE .. '/sealing', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:core_finalization:sealing:begin', function(id, cb)
    PerformHttpRequest(BASE .. '/sealing/' .. id .. '/begin', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:core_finalization:sealing:apply', function(id, cb)
    PerformHttpRequest(BASE .. '/sealing/' .. id .. '/apply', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:core_finalization:sealing:break', function(id, cb)
    PerformHttpRequest(BASE .. '/sealing/' .. id .. '/break', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

-- Production Completion
AddEventHandler('atc:core_finalization:completion:create', function(data, cb)
    PerformHttpRequest(BASE .. '/completion', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:core_finalization:completion:progress', function(id, cb)
    PerformHttpRequest(BASE .. '/completion/' .. id .. '/progress', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:core_finalization:completion:complete', function(id, cb)
    PerformHttpRequest(BASE .. '/completion/' .. id .. '/complete', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:core_finalization:completion:abort', function(id, cb)
    PerformHttpRequest(BASE .. '/completion/' .. id .. '/abort', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

-- Coordination
AddEventHandler('atc:core_finalization:coordination:upsert', function(data, cb)
    PerformHttpRequest(BASE .. '/coordination', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:core_finalization:coordination:progress', function(id, cb)
    PerformHttpRequest(BASE .. '/coordination/' .. id .. '/progress', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:core_finalization:coordination:complete', function(id, cb)
    PerformHttpRequest(BASE .. '/coordination/' .. id .. '/complete', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

-- Distributed Final Seal
AddEventHandler('atc:core_finalization:seal:apply', function(data, cb)
    PerformHttpRequest(BASE .. '/seal', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:core_finalization:seal:lock', function(id, cb)
    PerformHttpRequest(BASE .. '/seal/' .. id .. '/lock', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:core_finalization:seal:break', function(id, cb)
    PerformHttpRequest(BASE .. '/seal/' .. id .. '/break', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:core_finalization:seal:expire', function(id, cb)
    PerformHttpRequest(BASE .. '/seal/' .. id .. '/expire', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

-- Cleanup
AddEventHandler('atc:core_finalization:cleanup', function(thresholdMs)
    PerformHttpRequest(BASE .. '/cleanup', function() end,
        'POST', json.encode({ thresholdMs = thresholdMs or 300000 }),
        { ['Content-Type'] = 'application/json' })
end)

-- Scheduled cleanup every 5 minutes
CreateThread(function()
    while true do
        Wait(300000)
        TriggerEvent('atc:core_finalization:cleanup', 300000)
    end
end)
