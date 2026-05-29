-- ATC Core — Client Status Effects
-- Caches active status effects as pushed by the server.
-- Expiry is evaluated using GetGameTimer so we don't rely on wall-clock drift.

ATC               = ATC               or {}
ATC.StatusEffects = ATC.StatusEffects or {}

local _effects = {}   -- array of { effectType, expiresAtMs, ... } where expiresAtMs is nil = permanent

-- ── Public API ────────────────────────────────────────────────────────────────

--- Returns the raw effects array (including expired ones until next server sync).
function ATC.StatusEffects.Get()
    return _effects
end

--- Returns only effects that have not yet expired.
--- expiresAtMs is measured in game-timer milliseconds (GetGameTimer epoch).
function ATC.StatusEffects.GetActive()
    local now    = GetGameTimer()
    local active = {}
    for _, effect in ipairs(_effects) do
        -- nil expiresAtMs = permanent effect
        if effect.expiresAtMs == nil or effect.expiresAtMs > now then
            active[#active + 1] = effect
        end
    end
    return active
end

--- Returns true if an active effect of the given type exists.
function ATC.StatusEffects.HasEffect(effectType)
    local active = ATC.StatusEffects.GetActive()
    for _, effect in ipairs(active) do
        if effect.effectType == effectType then
            return true
        end
    end
    return false
end

-- ── Internal: replace cache + push to NUI ────────────────────────────────────

local function ApplyAndBroadcast(data)
    _effects = (data and data.effects) or {}
    SendNUIMessage({
        type    = 'ATC_STATUS_UPDATE',
        payload = ATC.StatusEffects.GetActive(),
    })
end

-- ── Network events ────────────────────────────────────────────────────────────

-- Full effects snapshot (response to atc:status:request)
RegisterNetEvent(ATC.Events.STATUS.UPDATE)
AddEventHandler(ATC.Events.STATUS.UPDATE, function(data)
    ApplyAndBroadcast(data)
end)

-- Incremental effects change (effect added/removed/modified)
RegisterNetEvent(ATC.Events.STATUS.CHANGED)
AddEventHandler(ATC.Events.STATUS.CHANGED, function(data)
    ApplyAndBroadcast(data)
end)

-- ── Poll thread ───────────────────────────────────────────────────────────────

-- Keep the cache fresh; the server is authoritative for effect expiry.
CreateThread(function()
    while true do
        Wait(10000)
        if ATC.Core.IsReady() and ATC.Characters and ATC.Characters.IsSpawned() then
            TriggerServerEvent(ATC.Events.STATUS.REQUEST)
        end
    end
end)
