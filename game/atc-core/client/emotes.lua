-- ATC Core — Client Animation & Emote Runtime (Phase 88)
-- Manages emote playback, stop-on-move, NUI wheel integration,
-- and the B-key command binding.

ATC        = ATC        or {}
ATC.Emotes = ATC.Emotes or {}

-- ── Emote dictionary ─────────────────────────────────────────────────────────
-- Keys correspond to the names shown in the emote wheel.
-- loop=true   → TaskPlayAnim flag 1 (loop until ClearPedTasks)
-- loop=false  → TaskPlayAnim flag 0 (play once, duration 3 s)

local EMOTES = {
    wave     = { dict = 'gestures@m@standing@casual',                     anim = 'gesture_wave',               loop = false },
    sit      = { dict = 'amb@world_human_bench_phone@male@base',          anim = 'base',                       loop = true  },
    kneel    = { dict = 'amb@world_human_cop_idles@male@idle_a',          anim = 'idle_a',                     loop = true  },
    lean     = { dict = 'amb@world_human_leaning@male@wall@back@idle_a', anim = 'idle_a',                     loop = true  },
    phone    = { dict = 'cellmodelscenes',                                anim = 'f_phone_text_read_a',        loop = true  },
    dance    = { dict = 'anim@amb@nightclub@dancers@crowddance_facedj@', anim = 'hi_dance_facedj_MALE_A_0',   loop = true  },
    pushups  = { dict = 'amb@world_human_push_ups@male@base',            anim = 'base',                       loop = true  },
    sitchair = { dict = 'amb@world_human_seat_wall@male@idle_a',         anim = 'idle_a',                     loop = true  },
    cheer    = { dict = 'amb@world_human_cheering@male@base',            anim = 'base',                       loop = false },
    smoke    = { dict = 'amb@world_human_smoking@male@idle_a',           anim = 'idle_a',                     loop = true  },
}

local _playing      = false
local _currentEmote = nil

-- ── Helpers ──────────────────────────────────────────────────────────────────

---Async-load an animation dictionary, then call cb().
---Times out after 5 s to avoid an infinite stall.
local function _loadDict(dict, cb)
    if HasAnimDictLoaded(dict) then cb(); return end
    RequestAnimDict(dict)
    CreateThread(function()
        local deadline = GetGameTimer() + 5000
        while not HasAnimDictLoaded(dict) and GetGameTimer() < deadline do
            Wait(50)
        end
        if HasAnimDictLoaded(dict) then
            cb()
        else
            print('[ATC Emotes] WARNING: anim dict load timed out: ' .. dict)
        end
    end)
end

---Build the flat list of emote names for the NUI wheel.
local function _emoteList()
    local list = {}
    for name in pairs(EMOTES) do
        table.insert(list, name)
    end
    table.sort(list)  -- alphabetical order for consistent wheel layout
    return list
end

-- ── Public API ───────────────────────────────────────────────────────────────

---Play a named emote.  Stops any currently-playing emote first.
---@param name string  Key from EMOTES table
function ATC.Emotes.Play(name)
    local e = EMOTES[name]
    if not e then
        print('[ATC Emotes] Unknown emote: ' .. tostring(name))
        return
    end
    ATC.Emotes.Stop()
    _loadDict(e.dict, function()
        local ped      = PlayerPedId()
        local flag     = e.loop and 1 or 0
        local duration = e.loop and -1 or 3000
        TaskPlayAnim(ped, e.dict, e.anim, 2.0, -2.0, duration, flag, 0, false, false, false)
        _playing      = true
        _currentEmote = name
    end)
end

---Stop the current emote and clear ped tasks.
function ATC.Emotes.Stop()
    if not _playing then return end
    ClearPedTasks(PlayerPedId())
    _playing      = false
    _currentEmote = nil
end

---@return boolean  Whether an emote is currently playing
function ATC.Emotes.IsPlaying() return _playing end

---@return string|nil  Name of the active emote, or nil
function ATC.Emotes.Current() return _currentEmote end

-- ── Stop-on-move thread ───────────────────────────────────────────────────────
-- 0.3 m/s is approximately the transition from idle to walking.

CreateThread(function()
    while true do
        if _playing then
            if GetEntitySpeed(PlayerPedId()) > 0.3 then
                ATC.Emotes.Stop()
            end
            Wait(500)
        else
            Wait(1000)
        end
    end
end)

-- ── NUI callbacks ────────────────────────────────────────────────────────────
-- The NUI calls these via fetch POST to 'https://atc-core/<name>'.

RegisterNUICallback('atc:emote:play', function(data, cb)
    if data and data.name then
        ATC.Emotes.Play(data.name)
    end
    cb('ok')
end)

RegisterNUICallback('atc:emote:stop', function(_, cb)
    ATC.Emotes.Stop()
    cb('ok')
end)

-- ── Emote wheel command ───────────────────────────────────────────────────────

RegisterCommand('emotemenu', function()
    -- Block wheel when dead
    if ATC.CombatClient and ATC.CombatClient.IsDead() then return end
    SetNuiFocus(true, true)
    SendNUIMessage({
        type    = 'ATC_EMOTE_WHEEL_OPEN',
        payload = { emotes = _emoteList() }
    })
end, false)

RegisterKeyMapping('emotemenu', 'Open Emote Wheel', 'keyboard', 'B')

-- ── NUI close callback (Escape or button) ────────────────────────────────────

RegisterNUICallback('atc:emote:wheel:close', function(_, cb)
    SetNuiFocus(false, false)
    cb('ok')
end)
