-- =============================================================================
-- ATC AI Simulation — Phase 100
-- Economy AI price-pressure detection and civilian reputation reactions.
-- =============================================================================

ATC             = ATC             or {}
ATC.AISimulation = ATC.AISimulation or {}

-- ---------------------------------------------------------------------------
-- Configuration
-- ---------------------------------------------------------------------------
local ECONOMY_AI_INTERVAL = 1800000   -- 30 minutes (ms)
local SUPPLY_HIGH_THRESHOLD = 50      -- items above this count = oversupply

-- Reputation thresholds for civilian reactions
local REP_FRIENDLY_THRESHOLD = 70
local REP_FEARFUL_THRESHOLD  = 30

-- ---------------------------------------------------------------------------
-- _runEconomyAI
-- Fetches active market listings, measures per-item supply depth,
-- and emits log warnings for oversupplied items.
-- Does NOT mutate prices server-side — price suggestions are advisory only,
-- enforced by the economy_regulation module via policy hooks.
-- ---------------------------------------------------------------------------
local function _runEconomyAI()
    ATC.HTTP.Get('/api/v1/market/listings?status=active', function(ok, _, data)
        if not ok or not data then
            ATC.Log.Warn('ai_simulation', 'Economy AI: failed to fetch listings')
            return
        end

        local listings = (type(data) == 'table' and (data.listings or data)) or {}
        if #listings == 0 then return end

        -- Aggregate supply per item name
        local supply = {}
        for _, listing in ipairs(listings) do
            local item = listing.itemName or 'unknown'
            supply[item] = (supply[item] or 0) + (tonumber(listing.quantity) or 1)
        end

        -- Detect oversupplied items and log advisory
        local oversupplied = {}
        for item, count in pairs(supply) do
            if count > SUPPLY_HIGH_THRESHOLD then
                oversupplied[#oversupplied + 1] = { item = item, count = count }
                ATC.Log.Debug('ai_simulation', 'High supply detected', {
                    item  = item,
                    count = count,
                })
            end
        end

        if #oversupplied > 0 then
            ATC.Log.Info('ai_simulation', 'Economy AI cycle complete', {
                totalListings = #listings,
                oversupplied  = #oversupplied,
            })
        end
    end)
end

-- ---------------------------------------------------------------------------
-- ATC.AISimulation.GetCivilianReaction
-- Async: resolves a principal's reputation score to a reaction label.
-- cb(reaction) where reaction is 'friendly' | 'fearful' | 'neutral'
-- ---------------------------------------------------------------------------
function ATC.AISimulation.GetCivilianReaction(principalId, cb)
    if not principalId or not cb then return end

    ATC.HTTP.Get('/api/v1/reputation/principal/' .. tostring(principalId), function(ok, _, data)
        if not ok or not data then
            cb('neutral')
            return
        end

        local score = tonumber(data.score) or 50

        local reaction
        if score >= REP_FRIENDLY_THRESHOLD then
            reaction = 'friendly'
        elseif score <= REP_FEARFUL_THRESHOLD then
            reaction = 'fearful'
        else
            reaction = 'neutral'
        end

        cb(reaction)
    end)
end

-- ---------------------------------------------------------------------------
-- ATC.AISimulation.EvaluatePlayer
-- Convenience wrapper: fetches reaction and optionally triggers a server event
-- so other modules can react (e.g., narrative triggers, npc stance changes).
-- ---------------------------------------------------------------------------
function ATC.AISimulation.EvaluatePlayer(principalId, src)
    ATC.AISimulation.GetCivilianReaction(principalId, function(reaction)
        ATC.Log.Debug('ai_simulation', 'Civilian reaction evaluated', {
            principalId = principalId,
            reaction    = reaction,
        })

        -- Allow other server-side modules to hook into reputation changes
        TriggerEvent('atc:ai:civilian:reaction', principalId, src, reaction)
    end)
end

-- ---------------------------------------------------------------------------
-- Economy AI background loop
-- ---------------------------------------------------------------------------
CreateThread(function()
    -- Small startup delay so dependent modules (market, economy) are ready
    Wait(60000)

    while true do
        _runEconomyAI()
        Wait(ECONOMY_AI_INTERVAL)
    end
end)

-- ---------------------------------------------------------------------------
-- Event AI: react to world events
-- ---------------------------------------------------------------------------
AddEventHandler('atc:world:event:start', function(data)
    if not data then return end
    -- Increase NPC aggression near criminal events
    if data.type == 'gang_war' or data.type == 'armed_robbery' then
        TriggerClientEvent('atc:ai:threat:elevated', -1, { coords=data.coords, radius=200.0 })
    end
end)

-- ---------------------------------------------------------------------------
-- Tactical AI: coordinate police NPCs
-- ---------------------------------------------------------------------------
ATC.AISimulation.Tactical = {}
function ATC.AISimulation.Tactical.CoordinateResponse(criminalSource, policyType)
    -- Notify on-duty police players
    for _, pid in ipairs(GetPlayers()) do
        local src = tonumber(pid)
        local session = ATC.Sessions.Get(src)
        if session and session.job == 'police' and session.onDuty then
            TriggerClientEvent('atc:ai:tactical:alert', src, { type=policyType, targetSource=criminalSource })
        end
    end
end

-- ---------------------------------------------------------------------------
-- Runtime Balancing: dynamic economy adjustments
-- ---------------------------------------------------------------------------
ATC.AISimulation.Balance = {}
local _balanceConfig = { xpMultiplier=1.0, payMultiplier=1.0, crimeRate='normal' }

function ATC.AISimulation.Balance.Set(config)
    for k, v in pairs(config or {}) do
        _balanceConfig[k] = v
    end
    TriggerClientEvent('atc:ai:balance:update', -1, _balanceConfig)
    ATC.Log.Info('ai_simulation', 'Balance updated', _balanceConfig)
end

function ATC.AISimulation.Balance.Get() return _balanceConfig end

-- Admin command to adjust balance
RegisterCommand('atcbalance', function(source, args)
    if not IsPlayerAceAllowed(tostring(source), 'atc.admin') then return end
    local key = args[1]
    local val = tonumber(args[2])
    if key and val then
        ATC.AISimulation.Balance.Set({ [key]=val })
        TriggerClientEvent('atc:notify:show', source, { message='Balance: '..key..'='..tostring(val), level='info', duration=3000 })
    end
end, true)
