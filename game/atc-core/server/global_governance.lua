-- Phase 68: Unified Runtime Governance, Global Coordination & Cross-System Arbitration

local BASE = 'http://localhost:30120/api/v1/global-governance'

-- Governance Directives
AddEventHandler('atc:governance:directive:create', function(data, cb)
    PerformHttpRequest(BASE .. '/directive', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:governance:directive:activate', function(id, cb)
    PerformHttpRequest(BASE .. '/directive/' .. id .. '/activate', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:governance:directive:resolve', function(id, cb)
    PerformHttpRequest(BASE .. '/directive/' .. id .. '/resolve', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:governance:directive:fail', function(id, cb)
    PerformHttpRequest(BASE .. '/directive/' .. id .. '/fail', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

-- Cross-System Arbitration
AddEventHandler('atc:governance:arbitration:start', function(data, cb)
    PerformHttpRequest(BASE .. '/arbitration', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:governance:arbitration:resolve', function(id, cb)
    PerformHttpRequest(BASE .. '/arbitration/' .. id .. '/resolve', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:governance:arbitration:reject', function(id, cb)
    PerformHttpRequest(BASE .. '/arbitration/' .. id .. '/reject', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

-- Runtime Consensus
AddEventHandler('atc:governance:consensus:propose', function(data, cb)
    PerformHttpRequest(BASE .. '/consensus', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:governance:consensus:commit', function(id, cb)
    PerformHttpRequest(BASE .. '/consensus/' .. id .. '/commit', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:governance:consensus:abort', function(id, cb)
    PerformHttpRequest(BASE .. '/consensus/' .. id .. '/abort', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

-- Policy
AddEventHandler('atc:governance:policy:upsert', function(data, cb)
    PerformHttpRequest(BASE .. '/policy', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:governance:policy:revoke', function(id, cb)
    PerformHttpRequest(BASE .. '/policy/' .. id .. '/revoke', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

-- Ownership
AddEventHandler('atc:governance:ownership:claim', function(data, cb)
    PerformHttpRequest(BASE .. '/ownership', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:governance:ownership:release', function(resourceId, cb)
    PerformHttpRequest(BASE .. '/ownership/' .. resourceId .. '/release', function(status, body)
        if cb then cb(status == 200 and json.decode(body) or nil) end
    end, 'POST', '', { ['Content-Type'] = 'application/json' })
end)

-- Cleanup
AddEventHandler('atc:governance:cleanup', function(thresholdMs)
    PerformHttpRequest(BASE .. '/cleanup', function() end,
        'POST', json.encode({ thresholdMs = thresholdMs or 300000 }),
        { ['Content-Type'] = 'application/json' })
end)

-- Scheduled cleanup every 5 minutes
CreateThread(function()
    while true do
        Wait(300000)
        TriggerEvent('atc:governance:cleanup', 300000)
    end
end)
