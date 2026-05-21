local BASE = 'http://localhost:30120/api/v1/developer-platform'

-- ── Developer Platform ────────────────────────────────────────────────────────

AddEventHandler('atc:developer:platform:create', function(data, cb)
  PerformHttpRequest(BASE, function(status, body)
    if cb then cb(status, body) end
  end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:developer:platform:activate', function(id, cb)
  PerformHttpRequest(BASE .. '/' .. id .. '/activate', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:developer:platform:deprecate', function(id, cb)
  PerformHttpRequest(BASE .. '/' .. id .. '/deprecate', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

-- ── SDK Registry ──────────────────────────────────────────────────────────────

AddEventHandler('atc:developer:sdk:register', function(data, cb)
  PerformHttpRequest(BASE .. '/sdk', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:developer:sdk:deprecate', function(sdkId, cb)
  PerformHttpRequest(BASE .. '/sdk/' .. sdkId .. '/deprecate', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:developer:sdk:retire', function(sdkId, cb)
  PerformHttpRequest(BASE .. '/sdk/' .. sdkId .. '/retire', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

-- ── Plugin Compatibility ──────────────────────────────────────────────────────

AddEventHandler('atc:developer:compatibility:create', function(data, cb)
  PerformHttpRequest(BASE .. '/compatibility', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:developer:compatibility:validate', function(id, cb)
  PerformHttpRequest(BASE .. '/compatibility/' .. id .. '/validate', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:developer:compatibility:pass', function(id, cb)
  PerformHttpRequest(BASE .. '/compatibility/' .. id .. '/pass', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:developer:compatibility:fail', function(id, cb)
  PerformHttpRequest(BASE .. '/compatibility/' .. id .. '/fail', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

-- ── Extension Lifecycle ───────────────────────────────────────────────────────

AddEventHandler('atc:developer:extension:create', function(data, cb)
  PerformHttpRequest(BASE .. '/extension', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:developer:extension:activate', function(id, cb)
  PerformHttpRequest(BASE .. '/extension/' .. id .. '/activate', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:developer:extension:suspend', function(id, cb)
  PerformHttpRequest(BASE .. '/extension/' .. id .. '/suspend', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:developer:extension:deactivate', function(id, cb)
  PerformHttpRequest(BASE .. '/extension/' .. id .. '/deactivate', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

-- ── Contract Validation ───────────────────────────────────────────────────────

AddEventHandler('atc:developer:contract:create', function(data, cb)
  PerformHttpRequest(BASE .. '/contract', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:developer:contract:validate', function(id, cb)
  PerformHttpRequest(BASE .. '/contract/' .. id .. '/validate', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:developer:contract:pass', function(id, cb)
  PerformHttpRequest(BASE .. '/contract/' .. id .. '/pass', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:developer:contract:fail', function(id, cb)
  PerformHttpRequest(BASE .. '/contract/' .. id .. '/fail', function(status, body)
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
