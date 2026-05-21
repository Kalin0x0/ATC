-- ATC Core — Vitals Decay Loop
-- Server-side only. Passive decay of hunger, thirst, stamina, stress over time.
-- Disabled by default. Enable and configure via ConVars.
--
-- ConVars:
--   atc_vitals_decay_enabled         (0|1, default: 0)
--   atc_vitals_decay_interval_seconds (integer, default: 300)
--   atc_vitals_decay_hunger           (integer 0-100, default: 1)
--   atc_vitals_decay_thirst           (integer 0-100, default: 2)
--   atc_vitals_decay_stamina          (integer 0-100, default: 0)
--   atc_vitals_decay_stress           (integer 0-100, default: 0)

ATC = ATC or {}
ATC.Decay = ATC.Decay or {}

local _isRunning = false
local _stopped   = false

local function _readConfig()
    return {
        enabled         = GetConvarInt('atc_vitals_decay_enabled', 0) == 1,
        intervalSeconds = math.max(1, GetConvarInt('atc_vitals_decay_interval_seconds', 300)),
        hunger          = math.min(100, math.max(0, GetConvarInt('atc_vitals_decay_hunger', 1))),
        thirst          = math.min(100, math.max(0, GetConvarInt('atc_vitals_decay_thirst', 2))),
        stamina         = math.min(100, math.max(0, GetConvarInt('atc_vitals_decay_stamina', 0))),
        stress          = math.min(100, math.max(0, GetConvarInt('atc_vitals_decay_stress', 0))),
    }
end

local function _applyDecayToSource(source, cfg)
    -- Only apply to players with an active character
    local characterId = ATC.Characters.GetSelectedId(source)
    if not characterId then return end

    -- hunger: decrement (lower is worse)
    if cfg.hunger > 0 then
        ATC.Vitals.Mutate(source, 'hunger', 'decrement', cfg.hunger, nil)
    end

    -- thirst: decrement (lower is worse)
    if cfg.thirst > 0 then
        ATC.Vitals.Mutate(source, 'thirst', 'decrement', cfg.thirst, nil)
    end

    -- stamina: decrement
    if cfg.stamina > 0 then
        ATC.Vitals.Mutate(source, 'stamina', 'decrement', cfg.stamina, nil)
    end

    -- stress: increment (higher is worse)
    if cfg.stress > 0 then
        ATC.Vitals.Mutate(source, 'stress', 'increment', cfg.stress, nil)
    end
end

local function _tick(cfg)
    if _isRunning then
        ATC.Log.Warn('decay', 'Decay tick overlap detected — previous tick still running, skipping')
        return
    end
    _isRunning = true

    local players = GetPlayers()
    for _, sourceStr in ipairs(players) do
        local source = tonumber(sourceStr)
        if source then
            local ok, err = pcall(_applyDecayToSource, source, cfg)
            if not ok then
                ATC.Log.Warn('decay', 'Decay tick error for player', {
                    source = source, err = tostring(err),
                })
            end
        end
    end

    _isRunning = false
end

--- Start the decay loop. Reads config from ConVars each interval.
--- Safe to call multiple times; subsequent calls are no-ops if already scheduled.
function ATC.Decay.Start()
    local cfg = _readConfig()
    if not cfg.enabled then
        ATC.Log.Info('decay', 'Vitals decay is disabled (atc_vitals_decay_enabled = 0)')
        return
    end

    local intervalMs = cfg.intervalSeconds * 1000
    ATC.Log.Info('decay', 'Vitals decay loop started', {
        intervalSeconds = cfg.intervalSeconds,
        hunger          = cfg.hunger,
        thirst          = cfg.thirst,
        stamina         = cfg.stamina,
        stress          = cfg.stress,
    })

    local function schedule()
        SetTimeout(intervalMs, function()
            if _stopped then return end
            local liveCfg = _readConfig()
            if not liveCfg.enabled then
                ATC.Log.Info('decay', 'Vitals decay loop stopped (disabled via ConVar)')
                return
            end
            _tick(liveCfg)
            schedule()
        end)
    end

    schedule()
end

-- Auto-start on resource load (respects enabled ConVar)
AddEventHandler('onResourceStart', function(resourceName)
    if GetCurrentResourceName() ~= resourceName then return end
    ATC.Decay.Start()
end)

-- Stop the loop when the resource is unloaded so pending SetTimeouts are no-ops.
AddEventHandler('onResourceStop', function(resourceName)
    if GetCurrentResourceName() ~= resourceName then return end
    _stopped = true
    ATC.Log.Info('decay', 'Vitals decay loop stopped (resource unloading)')
end)
