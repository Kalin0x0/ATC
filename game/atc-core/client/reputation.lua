-- ============================================================
-- ATC Core — Client Reputation & Notoriety
-- Mirrors server-side reputation state locally for HUD/NUI use.
-- ============================================================

ATC = ATC or {}
ATC.Reputation = ATC.Reputation or {}

local _state = {
    factionName  = nil,
    factionLabel = nil,
    percent      = 0,
    rankLabel    = 'Civilian',
    notoriety    = 0,  -- 0-100 criminal notoriety
    xp           = 0,
    level        = 1,
}

--- Returns a snapshot of the current reputation display state.
--- @return table
function ATC.Reputation.GetDisplay()
    return {
        factionName  = _state.factionName,
        factionLabel = _state.factionLabel,
        percent      = _state.percent,
        rankLabel    = _state.rankLabel,
        notoriety    = _state.notoriety,
        level        = _state.level,
        xp           = _state.xp,
    }
end

--- Returns the player's current level.
--- @return number
function ATC.Reputation.GetLevel() return _state.level end

--- Returns the player's current criminal notoriety (0–100).
--- @return number
function ATC.Reputation.GetNotoriety() return _state.notoriety end

-- ── Reputation Update ────────────────────────────────────────────────────────

RegisterNetEvent('atc:reputation:update')
AddEventHandler('atc:reputation:update', function(data)
    if not data then return end

    local prevLevel = _state.level

    _state.factionName  = data.factionName  or _state.factionName
    _state.factionLabel = data.factionLabel or _state.factionLabel
    _state.percent      = tonumber(data.percent)   or _state.percent
    _state.rankLabel    = data.rankLabel    or _state.rankLabel
    _state.notoriety    = tonumber(data.notoriety) or _state.notoriety
    _state.xp           = tonumber(data.xp)        or _state.xp
    _state.level        = tonumber(data.level)      or _state.level

    -- Push to NUI HUD
    SendNUIMessage({ type = 'ATC_REPUTATION_UPDATE', payload = _state })

    -- Level-up notification
    if data.levelUp or (_state.level > prevLevel) then
        SendNUIMessage({
            type    = 'ATC_NOTIFICATION',
            payload = {
                message  = 'Level Up! You are now level ' .. tostring(_state.level),
                level    = 'success',
                duration = 6000
            }
        })
        -- Show full level-up toast (handled by hud.js)
        SendNUIMessage({
            type    = 'ATC_LEVELUP',
            payload = { level = _state.level, rankLabel = _state.rankLabel }
        })
    end

    -- Notoriety warning when threshold crossed
    if _state.notoriety > 70 then
        SendNUIMessage({
            type    = 'ATC_NOTIFICATION',
            payload = {
                message  = 'WARNING: High notoriety — police are watching',
                level    = 'warning',
                duration = 4000
            }
        })
    end
end)

-- ── Request reputation after character select ────────────────────────────────

AddEventHandler(ATC.Events.CHARACTER.SELECTED, function(data)
    if data and data.success then
        TriggerServerEvent('atc:reputation:request')
    end
end)
