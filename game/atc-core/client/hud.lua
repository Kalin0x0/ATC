-- ATC Core — Client HUD Aggregator
-- Collects state from all subsystems and pushes a consolidated tick to the NUI
-- every 500 ms. The NUI is responsible for deciding what to render.

ATC     = ATC     or {}
ATC.HUD = ATC.HUD or {}

-- ── HUD tick thread ───────────────────────────────────────────────────────────

CreateThread(function()
    while true do
        -- Back off when the framework is not ready or no character is loaded
        if not ATC.Core.IsReady() or not (ATC.Characters and ATC.Characters.IsSpawned()) then
            Wait(1000)
        else
            local payload = {
                vitals        = ATC.SDK.Vitals.Get(),
                wallet        = ATC.SDK.Economy.GetWallet(),
                job           = ATC.SDK.Jobs.GetActive(),
                statusEffects = (ATC.StatusEffects and ATC.StatusEffects.GetActive()) or {},
                isDead        = ATC.SDK.Combat.IsDead(),
                inVehicle     = ATC.SDK.Vehicles.IsInVehicle(),
                vehicle       = ATC.SDK.Vehicles.GetState(),
            }
            SendNUIMessage({ type = 'ATC_HUD_TICK', payload = payload })
            Wait(500)
        end
    end
end)

-- ── Network events ────────────────────────────────────────────────────────────

-- Server (or admin) can toggle HUD visibility
RegisterNetEvent('atc:hud:toggle')
AddEventHandler('atc:hud:toggle', function()
    SendNUIMessage({ type = 'ATC_HUD_TOGGLE' })
end)

-- Server-push notification (info / warning / error / success)
RegisterNetEvent('atc:notify:show')
AddEventHandler('atc:notify:show', function(data)
    if not data or not data.message then return end
    SendNUIMessage({
        type    = 'ATC_NOTIFICATION',
        payload = {
            message  = data.message,
            level    = data.level    or 'info',
            duration = data.duration or 5000,
        },
    })
end)
