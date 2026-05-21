local BASE = 'http://localhost:30120/api/v1/runtime-hardening'

-- ── Runtime Hardening ────────────────────────────────────────────────────────

AddEventHandler('atc:hardening:initiate', function(data, cb)
  PerformHttpRequest(BASE, function(status, body)
    if cb then cb(status, body) end
  end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:hardening:begin', function(id, cb)
  PerformHttpRequest(BASE .. '/' .. id .. '/begin', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:hardening:harden', function(id, cb)
  PerformHttpRequest(BASE .. '/' .. id .. '/harden', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:hardening:violate', function(id, cb)
  PerformHttpRequest(BASE .. '/' .. id .. '/violate', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:hardening:fail', function(id, cb)
  PerformHttpRequest(BASE .. '/' .. id .. '/fail', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

-- ── Immutable Security ───────────────────────────────────────────────────────

AddEventHandler('atc:hardening:security:create', function(data, cb)
  PerformHttpRequest(BASE .. '/security', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:hardening:security:enforce', function(id, cb)
  PerformHttpRequest(BASE .. '/security/' .. id .. '/enforce', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:hardening:security:violate', function(id, cb)
  PerformHttpRequest(BASE .. '/security/' .. id .. '/violate', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

-- ── Security Validation ──────────────────────────────────────────────────────

AddEventHandler('atc:hardening:validation:create', function(data, cb)
  PerformHttpRequest(BASE .. '/validation', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:hardening:validation:begin', function(id, cb)
  PerformHttpRequest(BASE .. '/validation/' .. id .. '/begin', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:hardening:validation:pass', function(id, cb)
  PerformHttpRequest(BASE .. '/validation/' .. id .. '/pass', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:hardening:validation:fail', function(id, cb)
  PerformHttpRequest(BASE .. '/validation/' .. id .. '/fail', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

-- ── Seal Validation ──────────────────────────────────────────────────────────

AddEventHandler('atc:hardening:seal_validation:create', function(data, cb)
  PerformHttpRequest(BASE .. '/seal-validation', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:hardening:seal_validation:begin', function(id, cb)
  PerformHttpRequest(BASE .. '/seal-validation/' .. id .. '/begin', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:hardening:seal_validation:verify', function(id, cb)
  PerformHttpRequest(BASE .. '/seal-validation/' .. id .. '/verify', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:hardening:seal_validation:break', function(id, cb)
  PerformHttpRequest(BASE .. '/seal-validation/' .. id .. '/break', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

-- ── Threat Mitigation ────────────────────────────────────────────────────────

AddEventHandler('atc:hardening:mitigation:create', function(data, cb)
  PerformHttpRequest(BASE .. '/mitigation', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', json.encode(data), { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:hardening:mitigation:begin', function(id, cb)
  PerformHttpRequest(BASE .. '/mitigation/' .. id .. '/begin', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:hardening:mitigation:complete', function(id, cb)
  PerformHttpRequest(BASE .. '/mitigation/' .. id .. '/complete', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('atc:hardening:mitigation:fail', function(id, cb)
  PerformHttpRequest(BASE .. '/mitigation/' .. id .. '/fail', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', '{}', { ['Content-Type'] = 'application/json' })
end)

-- ── Cleanup ──────────────────────────────────────────────────────────────────

AddEventHandler('atc:hardening:cleanup', function(thresholdMs, cb)
  PerformHttpRequest(BASE .. '/cleanup', function(status, body)
    if cb then cb(status, body) end
  end, 'POST', json.encode({ thresholdMs = thresholdMs }), { ['Content-Type'] = 'application/json' })
end)

CreateThread(function()
  while true do
    Wait(300000)
    TriggerEvent('atc:hardening:cleanup', 300000)
  end
end)
