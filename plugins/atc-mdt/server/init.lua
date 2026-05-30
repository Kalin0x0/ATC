-- ============================================================
-- ATC MDT — Server Init
-- Plugin: atc-mdt v0.1.0
-- ============================================================

-- Open MDT: fetch active dispatch calls and return to client
ATC.Firewall.On('atc:mdt:open', {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { window = 3000, max = 5 }
}, function(src)
    local session = ATC.Sessions.Get(src)
    if not session then return end

    ATC.HTTP.Get('/api/v1/dispatch/calls?status=active', function(ok, _, data)
        TriggerClientEvent('atc:mdt:data', src, {
            calls   = ok and data or {},
            session = session
        })
    end)
end)

-- Person search
ATC.Firewall.On('atc:mdt:search:person', {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { window = 5000, max = 10 }
}, function(src, payload)
    local name = type(payload) == 'table' and tostring(payload.name or ''):sub(1, 64) or ''
    if name == '' then return end

    ATC.HTTP.Get('/api/v1/characters?search=' .. name, function(ok, _, data)
        TriggerClientEvent('atc:mdt:search:result', src, ok and data or {})
    end)
end)

-- Create warrant
ATC.Firewall.On('atc:mdt:warrant:create', {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { window = 10000, max = 5 }
}, function(src, payload)
    local principalId = ATC.Accounts.GetPrincipalId(src)
    if not principalId then return end

    local subjectId = type(payload) == 'table' and payload.subjectId
    local reason    = type(payload) == 'table' and tostring(payload.reason or ''):sub(1, 256) or ''

    if not subjectId or reason == '' then return end

    ATC.HTTP.Post('/api/v1/law/warrants', {
        issuedByPrincipalId  = principalId,
        subjectPrincipalId   = subjectId,
        reason               = reason
    }, function(ok, _, data)
        TriggerClientEvent('atc:mdt:warrant:created', src, {
            success = ok,
            warrant = data
        })
    end)
end)
