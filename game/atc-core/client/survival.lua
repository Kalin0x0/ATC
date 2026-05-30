-- ============================================================
-- ATC — Atlantic Core
-- client/survival.lua — Phase 94: Survival Gameplay (Client)
-- Stress & fatigue state, visual effects, server sync
-- ============================================================

ATC = ATC or {}
ATC.Survival = ATC.Survival or {}

local _stress    = 0   -- 0–100
local _fatigue   = 0   -- 0–100
local _cold      = 0   -- 0–100 (environmental, reserved for future use)

-- ── Accessors ────────────────────────────────────────────────

function ATC.Survival.GetStress()   return _stress  end
function ATC.Survival.GetFatigue()  return _fatigue end
function ATC.Survival.GetCold()     return _cold    end

function ATC.Survival.AddStress(v)
    _stress  = math.max(0, math.min(100, _stress  + (tonumber(v) or 0)))
end

function ATC.Survival.AddFatigue(v)
    _fatigue = math.max(0, math.min(100, _fatigue + (tonumber(v) or 0)))
end

function ATC.Survival.AddCold(v)
    _cold    = math.max(0, math.min(100, _cold    + (tonumber(v) or 0)))
end

-- ── Visual effects loop ───────────────────────────────────────
-- Stress > 80  → hand-shake camera proportional to severity
-- Fatigue > 70 → reduced movement speed (clamped to 0.6)

CreateThread(function()
    while true do
        if ATC.Core and ATC.Core.IsReady() and ATC.Characters and ATC.Characters.IsSpawned() then
            local ped = PlayerPedId()

            -- Stress camera shake
            if _stress > 80 then
                ShakeGameplayCam('HAND_SHAKE', (_stress - 80) / 200.0)
            else
                StopGameplayCamShaking(false)
            end

            -- Fatigue movement penalty
            if _fatigue > 70 then
                SetPedMoveRateOverride(ped, math.max(0.6, 1.0 - (_fatigue - 70) / 300.0))
            else
                SetPedMoveRateOverride(ped, 1.0)
            end
        end
        Wait(2000)
    end
end)

-- ── Server → Client: full state push ─────────────────────────
-- Server sends stress/fatigue after each decay tick or event

RegisterNetEvent('atc:survival:state:update')
AddEventHandler('atc:survival:state:update', function(data)
    if not data then return end
    _stress  = tonumber(data.stress)  or _stress
    _fatigue = tonumber(data.fatigue) or _fatigue

    -- Merge into the HUD tick so the NUI refreshes atomically
    SendNUIMessage({
        type    = 'ATC_HUD_TICK',
        payload = {
            vitals        = ATC.SDK and ATC.SDK.Vitals  and ATC.SDK.Vitals.Get()          or nil,
            wallet        = ATC.SDK and ATC.SDK.Economy and ATC.SDK.Economy.GetWallet()    or nil,
            job           = ATC.SDK and ATC.SDK.Jobs    and ATC.SDK.Jobs.GetActive()       or nil,
            statusEffects = (ATC.StatusEffects and ATC.StatusEffects.GetActive())          or {},
            isDead        = ATC.SDK and ATC.SDK.Combat  and ATC.SDK.Combat.IsDead()        or false,
            inVehicle     = ATC.SDK and ATC.SDK.Vehicles and ATC.SDK.Vehicles.IsInVehicle() or false,
            vehicle       = ATC.SDK and ATC.SDK.Vehicles and ATC.SDK.Vehicles.GetState()   or nil,
            stress        = _stress,
            fatigue       = _fatigue,
        },
    })
end)

-- ── Server → Client: periodic decay tick micro-feedback ──────
-- Server fires this each decay cycle; client shows low-resource warnings

RegisterNetEvent('atc:survival:decay:tick')
AddEventHandler('atc:survival:decay:tick', function()
    local hunger  = ATC.SDK and ATC.SDK.Vitals and ATC.SDK.Vitals.GetHunger()
    local thirst  = ATC.SDK and ATC.SDK.Vitals and ATC.SDK.Vitals.GetThirst()

    if hunger and hunger < 20 then
        SendNUIMessage({
            type    = 'ATC_NOTIFICATION',
            payload = { message = ATC.Locale and ATC.Locale.T('survival.warning.hungry') or 'survival.warning.hungry', level = 'warning', duration = 4000 },
        })
    end

    if thirst and thirst < 20 then
        SendNUIMessage({
            type    = 'ATC_NOTIFICATION',
            payload = { message = ATC.Locale and ATC.Locale.T('survival.warning.thirsty') or 'survival.warning.thirsty', level = 'warning', duration = 4000 },
        })
    end
end)

-- ── Weather-based survival effects ───────────────────────────
-- Runs every 30 s; applies stress debuffs based on active weather.

CreateThread(function()
    while true do
        Wait(30000)
        if not (ATC.Core.IsReady() and ATC.Characters and ATC.Characters.IsSpawned()) then goto skip end
        local weather = GetPrevWeatherTypeHashName()
        -- Rain: wet and cold debuff
        if weather == GetHashKey('CLEARING') or weather == GetHashKey('RAIN') or weather == GetHashKey('THUNDER') then
            if not IsPedInAnyVehicle(PlayerPedId(), false) then
                ATC.Survival.AddStress(5)
                TriggerServerEvent('atc:survival:weather:tick', { weather='rain', outdoor=true })
            end
        end
        -- Snow/cold (modded weather)
        if weather == GetHashKey('SNOWLIGHT') or weather == GetHashKey('BLIZZARD') then
            ATC.Survival.AddStress(10)
            TriggerServerEvent('atc:survival:weather:tick', { weather='cold', outdoor=not IsPedInAnyVehicle(PlayerPedId(), false) })
        end
        ::skip::
    end
end)
