-- ATC Housing Plugin — Server
-- All property access is server-authoritative. No client-provided ownership data is trusted.
-- Principal IDs are resolved server-side via ATC.Accounts.GetPrincipalId.

ATC        = ATC        or {}
ATC.Housing = ATC.Housing or {}

-- ── Public API ────────────────────────────────────────────────────────────────

--- Fetch all properties owned by the player's account.
--- Calls GET /api/v1/properties?ownerId=<principalId>
--- @param source   number    FiveM player source
--- @param callback function  function(properties|nil)
function ATC.Housing.GetProperties(source, callback)
    local principalId = ATC.Accounts.GetPrincipalId(source)
    if not principalId then
        ATC.Log.Warn('housing', 'GetProperties — no principal', { source = source })
        if callback then callback(nil) end
        return
    end

    ATC.HTTP.Get('/api/v1/properties?ownerId=' .. principalId, function(ok, status, data, err)
        if not ok then
            ATC.Log.Error('housing', 'GetProperties API error', {
                source = source, status = status, err = err,
            })
            if callback then callback(nil) end
            return
        end
        if callback then callback(data and data.properties or {}) end
    end)
end

-- ── Firewall Events ───────────────────────────────────────────────────────────

--- atc:housing:property:enter
--- Client requests access to a property. Server validates ownership/guest-list via API.
ATC.Firewall.On('atc:housing:property:enter', {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { window = 5000, max = 10 },
}, function(src, payload)
    if type(payload) ~= 'table' then return end

    local propertyId = payload.propertyId
    if type(propertyId) ~= 'string' or #propertyId == 0
        or #propertyId > ATC.Housing.Config.PropertyIdMaxLength then
        ATC.Log.Warn('housing', 'enter — invalid propertyId', {
            source = src, propertyId = tostring(propertyId),
        })
        return
    end

    local principalId = ATC.Accounts.GetPrincipalId(src)
    if not principalId then return end

    ATC.HTTP.Post(
        '/api/v1/properties/' .. propertyId .. '/access/check',
        { principalId = principalId },
        function(ok, status, data, err)
            local allowed = ok and data and data.allowed == true
            if not ok then
                ATC.Log.Error('housing', 'enter — API error', {
                    source = src, propertyId = propertyId, status = status, err = err,
                })
            end
            TriggerClientEvent('atc:housing:property:enter:response', src, {
                allowed    = allowed,
                propertyId = propertyId,
            })
        end
    )
end)

--- atc:housing:property:lock
--- Client requests to lock or unlock a property. Only the owner may change lock state.
ATC.Firewall.On('atc:housing:property:lock', {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { window = 3000, max = 10 },
}, function(src, payload)
    if type(payload) ~= 'table' then return end

    local propertyId = payload.propertyId
    local locked     = payload.locked

    if type(propertyId) ~= 'string' or #propertyId == 0
        or #propertyId > ATC.Housing.Config.PropertyIdMaxLength then
        ATC.Log.Warn('housing', 'lock — invalid propertyId', {
            source = src, propertyId = tostring(propertyId),
        })
        return
    end

    -- Coerce to boolean — never trust raw client boolean as sole auth check.
    local wantLocked = locked == true

    local principalId = ATC.Accounts.GetPrincipalId(src)
    if not principalId then return end

    ATC.HTTP.Post(
        '/api/v1/properties/' .. propertyId .. '/lock',
        { principalId = principalId, locked = wantLocked },
        function(ok, status, data, err)
            if not ok then
                ATC.Log.Error('housing', 'lock — API error', {
                    source = src, propertyId = propertyId, status = status, err = err,
                })
            end
            TriggerClientEvent('atc:housing:property:lock:response', src, {
                success = ok,
                locked  = wantLocked,
            })
        end
    )
end)

ATC.Log.Info('housing', 'atc-housing server initialised')
