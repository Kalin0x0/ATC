local BASE = 'http://localhost:30120/api/v1/runtime-gateway'

-- ── Runtime Gateway ──────────────────────────────────────────────────────────

AddEventHandler('atc:gateway:create', function(data, cb)
  PerformHttpRequest(BASE, function(status, body)
    if cb then cb(status, body) end
  end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:gateway:activate', function(id, cb)
  PerformHttpRequest(BASE .. '/' .. id .. '/activate', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:gateway:suspend', function(id, cb)
  PerformHttpRequest(BASE .. '/' .. id .. '/suspend', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:gateway:expire', function(id, cb)
  PerformHttpRequest(BASE .. '/' .. id .. '/expire', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:gateway:fail', function(id, cb)
  PerformHttpRequest(BASE .. '/' .. id .. '/fail', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

-- ── Access Mesh ──────────────────────────────────────────────────────────────

AddEventHandler('atc:gateway:mesh:sync', function(data, cb)
  PerformHttpRequest(BASE .. '/mesh', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:gateway:mesh:degrade', function(meshId, cb)
  PerformHttpRequest(BASE .. '/mesh/' .. meshId .. '/degrade', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:gateway:mesh:recover', function(meshId, cb)
  PerformHttpRequest(BASE .. '/mesh/' .. meshId .. '/recover', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

-- ── Gateway Routing ──────────────────────────────────────────────────────────

AddEventHandler('atc:gateway:routing:configure', function(data, cb)
  PerformHttpRequest(BASE .. '/routing', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:gateway:routing:activate', function(routingId, cb)
  PerformHttpRequest(BASE .. '/routing/' .. routingId .. '/activate', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:gateway:routing:suspend', function(routingId, cb)
  PerformHttpRequest(BASE .. '/routing/' .. routingId .. '/suspend', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

-- ── Runtime Exposure ─────────────────────────────────────────────────────────

AddEventHandler('atc:gateway:exposure:create', function(data, cb)
  PerformHttpRequest(BASE .. '/exposure', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:gateway:exposure:begin', function(id, cb)
  PerformHttpRequest(BASE .. '/exposure/' .. id .. '/begin', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:gateway:exposure:complete', function(id, cb)
  PerformHttpRequest(BASE .. '/exposure/' .. id .. '/complete', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:gateway:exposure:retract', function(id, cb)
  PerformHttpRequest(BASE .. '/exposure/' .. id .. '/retract', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

-- ── Surface Protection ───────────────────────────────────────────────────────

AddEventHandler('atc:gateway:protection:create', function(data, cb)
  PerformHttpRequest(BASE .. '/protection', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:gateway:protection:activate', function(id, cb)
  PerformHttpRequest(BASE .. '/protection/' .. id .. '/activate', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:gateway:protection:breach', function(id, cb)
  PerformHttpRequest(BASE .. '/protection/' .. id .. '/breach', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:gateway:protection:expire', function(id, cb)
  PerformHttpRequest(BASE .. '/protection/' .. id .. '/expire', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

-- ── Cleanup ──────────────────────────────────────────────────────────────────

AddEventHandler('atc:gateway:cleanup', function(thresholdMs, cb)
  PerformHttpRequest(BASE .. '/cleanup', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', json.encode({ thresholdMs = thresholdMs }), { ['Content-Type'] = 'application/json' })
end)

CreateThread(function()
  while true do
    Wait(300000)
    TriggerEvent('atc:gateway:cleanup', 300000)
  end
end)
