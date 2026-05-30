-- atc-territory — Server Init
-- Faction zone data relay and claim pipeline.
-- Zone state is owned by the API; server is the authoritative relay.
-- Claim events are server-only (clientAllowed=false) — only internal plugin
-- logic or admin tooling may trigger a capture.

ATC.Territory = ATC.Territory or {}

-- ── Zone List Request ─────────────────────────────────────────────────────────
-- Clients request the full territory list on character select.
-- Response is unicast back to the requesting client only.
ATC.Firewall.On('atc:territory:zones:request', {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { window = 10000, max = 3 },
}, function(src, payload)
    ATC.HTTP.Get('/api/v1/factions/territories', function(ok, status, data)
        if ok then
            TriggerClientEvent('atc:territory:zones:response', src, data)
        else
            ATC.Log.Warn('territory', 'Failed to fetch territory zones', {
                source     = src,
                httpStatus = status,
            })
        end
    end)
end)

-- ── Territory Claim ───────────────────────────────────────────────────────────
-- clientAllowed=false: this event is only ever emitted by server-side game logic
-- (e.g. a capture-point timer expiring) or an admin command.
-- Direct client triggers are blocked by the Firewall.
ATC.Firewall.On('atc:territory:claim', {
    clientAllowed  = false,
    requireSession = true,
    rateLimit      = { window = 60000, max = 1 },
}, function(src, payload)
    if type(payload) ~= 'table' then return end

    local factionId = type(payload.factionId) == 'string' and payload.factionId
    local zoneId    = type(payload.zoneId)    == 'string' and payload.zoneId

    if not factionId or not zoneId then
        ATC.Log.Warn('territory', 'Claim event missing factionId or zoneId', { source = src })
        return
    end

    local principalId = ATC.Accounts.GetPrincipalId(src)

    ATC.HTTP.Post('/api/v1/factions/territories/' .. zoneId .. '/claim', {
        factionId              = factionId,
        claimedByPrincipalId   = principalId,
    }, function(ok, status, data)
        if ok then
            -- Broadcast the new owner to every connected client
            TriggerClientEvent('atc:territory:claimed', -1, {
                zoneId    = zoneId,
                factionId = factionId,
            })
            ATC.Log.Info('territory', 'Zone claimed', {
                zoneId    = zoneId,
                factionId = factionId,
                claimedBy = principalId,
            })
        else
            ATC.Log.Warn('territory', 'Claim API call failed', {
                zoneId     = zoneId,
                factionId  = factionId,
                httpStatus = status,
            })
        end
    end)
end)

-- ── Public SDK Helpers ────────────────────────────────────────────────────────

--- Trigger a territory claim from server-side game logic (e.g. capture timer).
--- @param claimerSource  number   FiveM server id of the capturing player
--- @param factionId      string
--- @param zoneId         string
function ATC.Territory.Claim(claimerSource, factionId, zoneId)
    -- Re-uses the Firewall event so all checks (session, rate-limit) still apply.
    TriggerEvent('atc:territory:claim', claimerSource, {
        factionId = factionId,
        zoneId    = zoneId,
    })
end

-- ── Reputation Request Relay ──────────────────────────────────────────────────
-- Clients request their current reputation/progression data on character select.
-- Territory plugin owns this relay because reputation is faction-scoped.

ATC.Firewall.On('atc:reputation:request', {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { window = 5000, max = 3 }
}, function(src)
    local principalId = ATC.Accounts.GetPrincipalId(src)
    if not principalId then return end
    ATC.HTTP.Get('/api/v1/reputation/principal/' .. principalId, function(ok, _, data)
        TriggerClientEvent('atc:reputation:update', src, ok and data or {})
    end)
end)
