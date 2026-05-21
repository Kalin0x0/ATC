-- Phase 62: Autonomous Civilization, Governance & Political Runtime Bridge
-- Server-side only. All governance operations are server-authoritative.

local function checkRateLimit(source)
    if not source or source == 0 then return true end
    if not _G._govRateLimits then _G._govRateLimits = {} end
    local now = GetGameTimer()
    local key = tostring(source)
    if not _G._govRateLimits[key] then
        _G._govRateLimits[key] = { count = 0, window = now }
    end
    local entry = _G._govRateLimits[key]
    if (now - entry.window) > 60000 then
        entry.count = 0
        entry.window = now
    end
    entry.count = entry.count + 1
    return entry.count <= 30
end

-- atc:governance:create (Server-only)
AddEventHandler('atc:governance:create', function(governanceType, regionId, governanceNonce, governanceData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        governanceId    = ATC.SDK.Id.Generate(),
        governanceType  = governanceType,
        ownerServerId   = GetConvar('atc_server_id', 'default'),
        regionId        = regionId,
        governanceNonce = governanceNonce,
        governanceData  = governanceData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/governance/create',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('governance', 'governance create failed: ' .. tostring(status))
            else
                TriggerEvent('atc:governance:created', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:governance:suspend (Server-only)
AddEventHandler('atc:governance:suspend', function(id)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/governance/' .. id .. '/suspend',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('governance', 'governance suspend failed: ' .. tostring(status))
            else
                TriggerEvent('atc:governance:suspended', json.decode(body))
            end
        end,
        'POST',
        json.encode({}),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:governance:election:start (Server-only)
AddEventHandler('atc:governance:election:start', function(electionType, regionId, electionNonce, candidateData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        electionId    = ATC.SDK.Id.Generate(),
        electionType  = electionType,
        ownerServerId = GetConvar('atc_server_id', 'default'),
        regionId      = regionId,
        electionNonce = electionNonce,
        candidateData = candidateData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/governance/elections/start',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('governance', 'election start failed: ' .. tostring(status))
            else
                TriggerEvent('atc:governance:election:started', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:governance:election:close (Server-only)
AddEventHandler('atc:governance:election:close', function(id, resultData)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/governance/elections/' .. id .. '/close',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('governance', 'election close failed: ' .. tostring(status))
            else
                TriggerEvent('atc:governance:election:closed', json.decode(body))
            end
        end,
        'POST',
        json.encode({ resultData = resultData }),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:governance:legislation:enact (Server-only)
AddEventHandler('atc:governance:legislation:enact', function(legislationType, regionId, legislationNonce, legislationData, expiresAt)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        legislationId    = ATC.SDK.Id.Generate(),
        legislationType  = legislationType,
        ownerServerId    = GetConvar('atc_server_id', 'default'),
        regionId         = regionId,
        legislationNonce = legislationNonce,
        legislationData  = legislationData or {},
        expiresAt        = expiresAt,
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/governance/legislation/enact',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('governance', 'legislation enact failed: ' .. tostring(status))
            else
                TriggerEvent('atc:governance:legislation:enacted', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:governance:legislation:repeal (Server-only)
AddEventHandler('atc:governance:legislation:repeal', function(id)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/governance/legislation/' .. id .. '/repeal',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('governance', 'legislation repeal failed: ' .. tostring(status))
            else
                TriggerEvent('atc:governance:legislation:repealed', json.decode(body))
            end
        end,
        'POST',
        json.encode({}),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:governance:influence:upsert (Server-only)
AddEventHandler('atc:governance:influence:upsert', function(entityId, influenceType, influenceScore, regionId, influenceData)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        entityId       = entityId,
        influenceType  = influenceType,
        influenceScore = influenceScore,
        ownerServerId  = GetConvar('atc_server_id', 'default'),
        regionId       = regionId,
        influenceData  = influenceData or {},
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/governance/influence',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('governance', 'influence upsert failed: ' .. tostring(status))
            else
                TriggerEvent('atc:governance:influence:updated', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:governance:policy:apply (Server-only)
AddEventHandler('atc:governance:policy:apply', function(policyType, regionId, policyNonce, policyData, expiresAt)
    local token = ATC.SDK.Auth.GetServerToken()
    local payload = {
        policyId      = ATC.SDK.Id.Generate(),
        policyType    = policyType,
        ownerServerId = GetConvar('atc_server_id', 'default'),
        regionId      = regionId,
        policyNonce   = policyNonce,
        policyData    = policyData or {},
        expiresAt     = expiresAt,
    }
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/governance/policies/apply',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('governance', 'policy apply failed: ' .. tostring(status))
            else
                TriggerEvent('atc:governance:policy:applied', json.decode(body))
            end
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:governance:policy:revoke (Server-only)
AddEventHandler('atc:governance:policy:revoke', function(id)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/governance/policies/' .. id .. '/revoke',
        function(status, body)
            if status ~= 200 then
                ATC.Log.Warn('governance', 'policy revoke failed: ' .. tostring(status))
            else
                TriggerEvent('atc:governance:policy:revoked', json.decode(body))
            end
        end,
        'POST',
        json.encode({}),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- atc:governance:cleanup (Server-only, scheduled)
AddEventHandler('atc:governance:cleanup', function(thresholdMs)
    local token = ATC.SDK.Auth.GetServerToken()
    PerformHttpRequest(
        ATC.Config.ApiBase .. '/api/v1/governance/cleanup',
        function(status, _body)
            if status ~= 200 then
                ATC.Log.Warn('governance', 'cleanup failed: ' .. tostring(status))
            end
        end,
        'POST',
        json.encode({ thresholdMs = thresholdMs or 300000 }),
        { ['Content-Type'] = 'application/json', ['Authorization'] = 'Bearer ' .. token }
    )
end)

-- Scheduled cleanup every 5 minutes
CreateThread(function()
    while true do
        Wait(300000)
        TriggerEvent('atc:governance:cleanup', 300000)
    end
end)
