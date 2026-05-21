local BASE = 'http://localhost:30120/api/v1/core-closure'

-- ── Core Closure ──────────────────────────────────────────────────────────────

AddEventHandler('atc:closure:initiate', function(data, cb)
  PerformHttpRequest(BASE, function(status, body)
    if cb then cb(status, body) end
  end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:closure:start', function(id, cb)
  PerformHttpRequest(BASE .. '/' .. id .. '/start', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:closure:seal', function(id, cb)
  PerformHttpRequest(BASE .. '/' .. id .. '/seal', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:closure:fail', function(id, cb)
  PerformHttpRequest(BASE .. '/' .. id .. '/fail', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

-- ── Production Immutability ────────────────────────────────────────────────────

AddEventHandler('atc:closure:immutability:create', function(data, cb)
  PerformHttpRequest(BASE .. '/immutability', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:closure:immutability:activate', function(id, cb)
  PerformHttpRequest(BASE .. '/immutability/' .. id .. '/activate', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:closure:immutability:freeze', function(id, cb)
  PerformHttpRequest(BASE .. '/immutability/' .. id .. '/freeze', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:closure:immutability:violate', function(id, cb)
  PerformHttpRequest(BASE .. '/immutability/' .. id .. '/violate', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

-- ── Production Freeze ─────────────────────────────────────────────────────────

AddEventHandler('atc:closure:freeze:initiate', function(data, cb)
  PerformHttpRequest(BASE .. '/freeze', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:closure:freeze:degrade', function(freezeId, cb)
  PerformHttpRequest(BASE .. '/freeze/' .. freezeId .. '/degrade', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:closure:freeze:recover', function(freezeId, cb)
  PerformHttpRequest(BASE .. '/freeze/' .. freezeId .. '/recover', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

-- ── Distributed Closure Nodes ─────────────────────────────────────────────────

AddEventHandler('atc:closure:node:register', function(data, cb)
  PerformHttpRequest(BASE .. '/node', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:closure:node:sync', function(closureNodeId, cb)
  PerformHttpRequest(BASE .. '/node/' .. closureNodeId .. '/sync', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:closure:node:complete-sync', function(closureNodeId, cb)
  PerformHttpRequest(BASE .. '/node/' .. closureNodeId .. '/complete-sync', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:closure:node:degrade', function(closureNodeId, cb)
  PerformHttpRequest(BASE .. '/node/' .. closureNodeId .. '/degrade', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

-- ── Final Validation ──────────────────────────────────────────────────────────

AddEventHandler('atc:closure:validation:create', function(data, cb)
  PerformHttpRequest(BASE .. '/validation', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:closure:validation:begin', function(id, cb)
  PerformHttpRequest(BASE .. '/validation/' .. id .. '/begin', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:closure:validation:complete', function(id, cb)
  PerformHttpRequest(BASE .. '/validation/' .. id .. '/complete', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:closure:validation:fail', function(id, cb)
  PerformHttpRequest(BASE .. '/validation/' .. id .. '/fail', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

-- ── Scheduled Cleanup ─────────────────────────────────────────────────────────

CreateThread(function()
  while true do
    Wait(300000)
    PerformHttpRequest(BASE .. '/cleanup', function() end, 'POST',
      json.encode({ thresholdMs = 300000 }),
      { ['Content-Type'] = 'application/json' })
  end
end)
