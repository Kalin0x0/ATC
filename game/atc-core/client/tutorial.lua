-- ============================================================
-- ATC — Atlantic Core
-- client/tutorial.lua — First-spawn intro & onboarding tutorial
-- ============================================================

ATC = ATC or {}
ATC.Tutorial = ATC.Tutorial or {}

local _shown = false

local TUTORIAL_STEPS = {
    { title = 'Welcome to Atlantic Core', text = 'Atlantic Core (ATC) is an MMO-grade FiveM platform. Use the controls below to get started.', duration = 6000 },
    { title = 'Character & Identity',     text = 'Select or create your character. Your identity persists across sessions.', duration = 5000 },
    { title = 'Phone & Communication',    text = 'Press NUMPAD0 to open your phone. Use it for contacts, banking, and 911 calls.', duration = 5000 },
    { title = 'Inventory',               text = 'Press TAB to open your inventory. Use items, manage slots, and drag/drop to reorganise.', duration = 5000 },
    { title = 'Hotbar',                  text = 'Keys 1-5 select hotbar slots. Press CAPS LOCK to use the selected item.', duration = 5000 },
    { title = 'Emotes & Interaction',    text = 'Press B for the emote wheel. Press E near highlighted objects to interact.', duration = 5000 },
    { title = 'Jobs & Duty',             text = 'Press F6 to go on/off duty. Your job salary is paid automatically.', duration = 5000 },
    { title = 'Voice & Radio',           text = 'Speak near others to be heard. Hold INPUT_TALK to broadcast on your radio channel.', duration = 5000 },
}

local function _runTutorial()
    _shown = true
    SetPauseMenuActive(false)
    DoScreenFadeOut(300)
    Wait(400)
    SetEntityCoords(PlayerPedId(), -269.4, -955.3, 31.2)
    DoScreenFadeIn(800)
    for _, step in ipairs(TUTORIAL_STEPS) do
        SendNUIMessage({ type='ATC_NOTIFICATION', payload={ message='['..step.title..'] '..step.text, level='info', duration=step.duration } })
        Wait(step.duration + 500)
    end
    -- Add minimap blips for key locations
    ATC.Minimap.AddBlip('tutorial_bank',     vector3(150.26,  -1040.58, 29.37), 'Bank',     108, 2)
    ATC.Minimap.AddBlip('tutorial_shop',     vector3(24.47,   -1346.64, 29.50), '24/7',     52,  5)
    ATC.Minimap.AddBlip('tutorial_police',   vector3(441.68,  -982.44,  30.69), 'Police',   60, 29)
    ATC.Minimap.AddBlip('tutorial_hospital', vector3(295.84,  -1447.53, 29.99), 'Hospital', 61,  1)
    SendNUIMessage({ type='ATC_NOTIFICATION', payload={ message='Tutorial complete! Enjoy ATC.', level='success', duration=5000 } })
end

-- Show tutorial on first spawn only
AddEventHandler(ATC.Events.CHARACTER.SELECTED, function(data)
    if data and data.success and not _shown then
        Wait(3000)
        _runTutorial()
    end
end)

function ATC.Tutorial.Show() _shown=false; _runTutorial() end

RegisterCommand('tutorial', function() ATC.Tutorial.Show() end, false)
