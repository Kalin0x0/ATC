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

-- Accepted by claimTerritorySchema.claimType on the API. Whitelist, not a
-- passthrough: anything else falls back to 'capture'.
local CLAIM_TYPES = {
    capture     = true,
    purchase    = true,
    grant       = true,
    inheritance = true,
}

--- Announce a confirmed ownership change to every connected client.
--- Needs nothing from the API response — zoneId and factionId are already known
--- here — so it is a plain local fan-out any caller can invoke (claim pipeline,
--- admin tooling, a resync).
--- @param zoneId       string
--- @param factionId    string
--- @param principalId  string|nil  principal credited with the claim (log only)
local function announceZoneClaimed(zoneId, factionId, principalId)
    TriggerClientEvent('atc:territory:claimed', -1, {
        zoneId    = zoneId,
        factionId = factionId,
    })
    ATC.Log.Info('territory', 'Zone claimed', {
        zoneId    = zoneId,
        factionId = factionId,
        claimedBy = principalId,
    })
end

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

    local claimType = (type(payload.claimType) == 'string' and CLAIM_TYPES[payload.claimType])
        and payload.claimType
        or 'capture'

    local principalId = ATC.Accounts.GetPrincipalId(src)
    if not principalId then
        -- claimedByPrincipalId is required by the API; without it the claim
        -- cannot be recorded and no ownership change has happened.
        ATC.Log.Warn('territory', 'Claim event from a source with no principal', {
            source = src,
            zoneId = zoneId,
        })
        return
    end

    -- The claim route is POST /api/v1/factions/territories/claim with the
    -- territory id in the body; there is no /territories/{id}/claim endpoint
    -- (atc-core's ATC.Factions.ClaimTerritory targets the same route).
    -- Body matches claimTerritorySchema: territoryId, factionId,
    -- claimedByPrincipalId, claimType and claimNonce are all required; notes is
    -- optional and omitted.
    ATC.HTTP.Post('/api/v1/factions/territories/claim', {
        territoryId          = zoneId,
        factionId            = factionId,
        claimedByPrincipalId = principalId,
        claimType            = claimType,
        claimNonce           = ATC.SDK.Id.Generate('territory-claim'),
    }, function(ok, status, _data)
        if ok then
            -- Zone ownership is API-owned state and a claim can be refused
            -- (409 already claimed, 422 immutable), so the announcement stays on
            -- the success path: telling every client a zone changed hands when it
            -- did not would desync them from the authoritative owner.
            announceZoneClaimed(zoneId, factionId, principalId)
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
--- @param claimerSource  number      FiveM server id of the capturing player
--- @param factionId      string
--- @param zoneId         string
--- @param claimType      string|nil  'capture'|'purchase'|'grant'|'inheritance'
---                                   (defaults to 'capture')
function ATC.Territory.Claim(claimerSource, factionId, zoneId, claimType)
    -- Re-uses the Firewall event so all checks (session, rate-limit) still apply.
    TriggerEvent('atc:territory:claim', claimerSource, {
        factionId = factionId,
        zoneId    = zoneId,
        claimType = claimType,
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
