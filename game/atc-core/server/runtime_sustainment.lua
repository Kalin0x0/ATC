local BASE = 'http://localhost:30120/api/v1/runtime-sustainment'

-- ── Runtime Sustainment ──────────────────────────────────────────────────────

AddEventHandler('atc:sustainment:initiate', function(data, cb)
  PerformHttpRequest(BASE, function(status, body)
    if cb then cb(status, body) end
  end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:sustainment:start', function(id, cb)
  PerformHttpRequest(BASE .. '/' .. id .. '/start', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:sustainment:maintain', function(id, cb)
  PerformHttpRequest(BASE .. '/' .. id .. '/maintain', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:sustainment:complete', function(id, cb)
  PerformHttpRequest(BASE .. '/' .. id .. '/complete', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:sustainment:fail', function(id, cb)
  PerformHttpRequest(BASE .. '/' .. id .. '/fail', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

-- ── Infinite Recovery ────────────────────────────────────────────────────────

AddEventHandler('atc:sustainment:recovery:initiate', function(data, cb)
  PerformHttpRequest(BASE .. '/recovery', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:sustainment:recovery:begin', function(recoveryId, cb)
  PerformHttpRequest(BASE .. '/recovery/' .. recoveryId .. '/begin', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:sustainment:recovery:complete', function(recoveryId, cb)
  PerformHttpRequest(BASE .. '/recovery/' .. recoveryId .. '/complete', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:sustainment:recovery:fail', function(recoveryId, cb)
  PerformHttpRequest(BASE .. '/recovery/' .. recoveryId .. '/fail', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

-- ── Autonomous Maintenance ───────────────────────────────────────────────────

AddEventHandler('atc:sustainment:maintenance:schedule', function(data, cb)
  PerformHttpRequest(BASE .. '/maintenance', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:sustainment:maintenance:run', function(id, cb)
  PerformHttpRequest(BASE .. '/maintenance/' .. id .. '/run', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:sustainment:maintenance:complete', function(id, cb)
  PerformHttpRequest(BASE .. '/maintenance/' .. id .. '/complete', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:sustainment:maintenance:skip', function(id, cb)
  PerformHttpRequest(BASE .. '/maintenance/' .. id .. '/skip', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

-- ── Distributed Sustainment Nodes ────────────────────────────────────────────

AddEventHandler('atc:sustainment:node:register', function(data, cb)
  PerformHttpRequest(BASE .. '/node', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:sustainment:node:degrade', function(sustainmentNodeId, cb)
  PerformHttpRequest(BASE .. '/node/' .. sustainmentNodeId .. '/degrade', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:sustainment:node:recover', function(sustainmentNodeId, cb)
  PerformHttpRequest(BASE .. '/node/' .. sustainmentNodeId .. '/recover', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:sustainment:node:fail', function(sustainmentNodeId, cb)
  PerformHttpRequest(BASE .. '/node/' .. sustainmentNodeId .. '/fail', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

-- ── Runtime Longevity ────────────────────────────────────────────────────────

AddEventHandler('atc:sustainment:longevity:create', function(data, cb)
  PerformHttpRequest(BASE .. '/longevity', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:sustainment:longevity:activate', function(id, cb)
  PerformHttpRequest(BASE .. '/longevity/' .. id .. '/activate', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:sustainment:longevity:archive', function(id, cb)
  PerformHttpRequest(BASE .. '/longevity/' .. id .. '/archive', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:sustainment:longevity:expire', function(id, cb)
  PerformHttpRequest(BASE .. '/longevity/' .. id .. '/expire', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

-- ── Cleanup ──────────────────────────────────────────────────────────────────

AddEventHandler('atc:sustainment:cleanup', function(thresholdMs, cb)
  PerformHttpRequest(BASE .. '/cleanup', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', json.encode({ thresholdMs = thresholdMs }), { ['Content-Type'] = 'application/json' })
end)

CreateThread(function()
  while true do
    Wait(300000)
    TriggerEvent('atc:sustainment:cleanup', 300000)
  end
end)
