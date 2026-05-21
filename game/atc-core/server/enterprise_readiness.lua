local BASE = 'http://localhost:30120/api/v1/enterprise-readiness'

-- ── Enterprise Readiness ──────────────────────────────────────────────────────

AddEventHandler('atc:enterprise:readiness:initiate', function(data, cb)
  PerformHttpRequest(BASE, function(status, body)
    if cb then cb(status, body) end
  end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:enterprise:readiness:assess', function(id, cb)
  PerformHttpRequest(BASE .. '/' .. id .. '/assess', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:enterprise:readiness:confirm', function(id, cb)
  PerformHttpRequest(BASE .. '/' .. id .. '/confirm', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:enterprise:readiness:reject', function(id, cb)
  PerformHttpRequest(BASE .. '/' .. id .. '/reject', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

-- ── Deterministic Audit ───────────────────────────────────────────────────────

AddEventHandler('atc:enterprise:audit:create', function(data, cb)
  PerformHttpRequest(BASE .. '/audit', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:enterprise:audit:begin', function(id, cb)
  PerformHttpRequest(BASE .. '/audit/' .. id .. '/begin', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:enterprise:audit:complete', function(id, cb)
  PerformHttpRequest(BASE .. '/audit/' .. id .. '/complete', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:enterprise:audit:archive', function(id, cb)
  PerformHttpRequest(BASE .. '/audit/' .. id .. '/archive', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

-- ── Integrity Verification ────────────────────────────────────────────────────

AddEventHandler('atc:enterprise:integrity:create', function(data, cb)
  PerformHttpRequest(BASE .. '/integrity', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:enterprise:integrity:begin', function(id, cb)
  PerformHttpRequest(BASE .. '/integrity/' .. id .. '/begin', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:enterprise:integrity:verify', function(id, cb)
  PerformHttpRequest(BASE .. '/integrity/' .. id .. '/verify', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:enterprise:integrity:fail', function(id, cb)
  PerformHttpRequest(BASE .. '/integrity/' .. id .. '/fail', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

-- ── Production Readiness Checkpoint ──────────────────────────────────────────

AddEventHandler('atc:enterprise:readiness:checkpoint:initiate', function(data, cb)
  PerformHttpRequest(BASE .. '/readiness', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:enterprise:readiness:checkpoint:confirm', function(readinessCheckpointId, cb)
  PerformHttpRequest(BASE .. '/readiness/' .. readinessCheckpointId .. '/confirm', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:enterprise:readiness:checkpoint:block', function(readinessCheckpointId, cb)
  PerformHttpRequest(BASE .. '/readiness/' .. readinessCheckpointId .. '/block', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

-- ── Distributed Audit Nodes ───────────────────────────────────────────────────

AddEventHandler('atc:enterprise:audit:node:register', function(data, cb)
  PerformHttpRequest(BASE .. '/audit-node', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:enterprise:audit:node:sync', function(auditNodeId, cb)
  PerformHttpRequest(BASE .. '/audit-node/' .. auditNodeId .. '/sync', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:enterprise:audit:node:complete-sync', function(auditNodeId, cb)
  PerformHttpRequest(BASE .. '/audit-node/' .. auditNodeId .. '/complete-sync', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:enterprise:audit:node:degrade', function(auditNodeId, cb)
  PerformHttpRequest(BASE .. '/audit-node/' .. auditNodeId .. '/degrade', function(status, body)
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
