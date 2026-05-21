local BASE = 'http://localhost:30120/api/v1/release-governance'

-- ── Release Governance ────────────────────────────────────────────────────────

AddEventHandler('atc:release:governance:initiate', function(data, cb)
  PerformHttpRequest(BASE, function(status, body)
    if cb then cb(status, body) end
  end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:release:governance:start', function(id, cb)
  PerformHttpRequest(BASE .. '/' .. id .. '/start', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:release:governance:approve', function(id, cb)
  PerformHttpRequest(BASE .. '/' .. id .. '/approve', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:release:governance:reject', function(id, cb)
  PerformHttpRequest(BASE .. '/' .. id .. '/reject', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

-- ── Production Deployment ─────────────────────────────────────────────────────

AddEventHandler('atc:release:deployment:initiate', function(data, cb)
  PerformHttpRequest(BASE .. '/deployment', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:release:deployment:activate', function(deploymentId, cb)
  PerformHttpRequest(BASE .. '/deployment/' .. deploymentId .. '/activate', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:release:deployment:complete', function(deploymentId, cb)
  PerformHttpRequest(BASE .. '/deployment/' .. deploymentId .. '/complete', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:release:deployment:rollback', function(deploymentId, cb)
  PerformHttpRequest(BASE .. '/deployment/' .. deploymentId .. '/rollback', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

-- ── Release Validation ────────────────────────────────────────────────────────

AddEventHandler('atc:release:validation:create', function(data, cb)
  PerformHttpRequest(BASE .. '/validation', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:release:validation:begin', function(id, cb)
  PerformHttpRequest(BASE .. '/validation/' .. id .. '/begin', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:release:validation:pass', function(id, cb)
  PerformHttpRequest(BASE .. '/validation/' .. id .. '/pass', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:release:validation:fail', function(id, cb)
  PerformHttpRequest(BASE .. '/validation/' .. id .. '/fail', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

-- ── Release Orchestration ─────────────────────────────────────────────────────

AddEventHandler('atc:release:orchestration:initiate', function(data, cb)
  PerformHttpRequest(BASE .. '/orchestration', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:release:orchestration:run', function(orchestrationId, cb)
  PerformHttpRequest(BASE .. '/orchestration/' .. orchestrationId .. '/run', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:release:orchestration:complete', function(orchestrationId, cb)
  PerformHttpRequest(BASE .. '/orchestration/' .. orchestrationId .. '/complete', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

-- ── Global Release ────────────────────────────────────────────────────────────

AddEventHandler('atc:release:global:create', function(data, cb)
  PerformHttpRequest(BASE .. '/global', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:release:global:activate', function(id, cb)
  PerformHttpRequest(BASE .. '/global/' .. id .. '/activate', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:release:global:complete', function(id, cb)
  PerformHttpRequest(BASE .. '/global/' .. id .. '/complete', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:release:global:revert', function(id, cb)
  PerformHttpRequest(BASE .. '/global/' .. id .. '/revert', function(status, body)
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
