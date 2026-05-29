-- ATC Inventory Plugin — Client
-- Receives item effect notifications from the server and plays
-- the corresponding visual/animation effect on the local ped.
-- The client NEVER initiates item mutations — only cosmetic reactions.

-- ── Animation helpers ─────────────────────────────────────────────────────────

--- Play a looping TaskPlayAnim for a fixed duration, then clear it.
--- @param dict  string Animation dictionary
--- @param anim  string Animation name
--- @param durationMs number Duration in ms before clearing
local function _playAnim(dict, anim, durationMs)
    local ped = PlayerPedId()

    -- Request the animation dictionary if not already loaded
    if not HasAnimDictLoaded(dict) then
        RequestAnimDict(dict)
        local timeout = 0
        while not HasAnimDictLoaded(dict) and timeout < 2000 do
            Citizen.Wait(50)
            timeout = timeout + 50
        end
    end

    if not HasAnimDictLoaded(dict) then
        -- Dictionary failed to load — skip silently
        return
    end

    TaskPlayAnim(ped, dict, anim, 1.0, -1.0, durationMs, 49, 0, false, false, false)

    -- Schedule animation clear after duration
    SetTimeout(durationMs, function()
        if IsPedPlayingAnim(ped, dict, anim, 3) then
            ClearPedTasks(ped)
        end
    end)
end

-- ── Effect handler table ──────────────────────────────────────────────────────

local EFFECT_HANDLERS = {

    drink = function()
        -- Short drink animation
        _playAnim('amb@world_human_drinking@beer@male@idle_a', 'idle_c', 3000)
    end,

    eat = function()
        -- Seated eating animation; gracefully falls back on ped task clear
        _playAnim('amb@world_human_seat_wall_eating@male@idle_a', 'idle_a', 4000)
    end,

    heal = function()
        -- Bandage / first aid animation
        _playAnim('anim@heists@prison_heist@bandit@', 'heal_loop', 3500)
    end,

    screen_effect_drink = function()
        -- Subtle post-process effect for drinking (can be paired with 'drink')
        AnimpostfxPlay('DrugsMichaelAliensFight', 800, false)
    end,

}

-- ── Server → Client event ─────────────────────────────────────────────────────

--- Server tells the client which visual effect to play after a successful item use.
RegisterNetEvent('atc:inventory:item:effect')
AddEventHandler('atc:inventory:item:effect', function(data)
    if not data or not data.effectType then return end

    local handler = EFFECT_HANDLERS[data.effectType]
    if handler then
        handler()
    end
end)
