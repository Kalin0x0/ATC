-- ATC Core — Client Combat
-- Monitors player death state, manages the client-side dead lock, and provides
-- revive / respawn entry points.
-- The server is authoritative for all damage values; the client never writes HP.

ATC              = ATC              or {}
ATC.CombatClient = ATC.CombatClient or {}

local _dead             = false
local _deathTime        = nil
local RESPAWN_TIMEOUT   = 900000   -- 15 minutes in ms — server can override via atc:vitals:update

-- ── Public API ────────────────────────────────────────────────────────────────

--- Returns true while the player is in the dead state.
function ATC.CombatClient.IsDead()
    return _dead
end

--- Client-side revive: lifts the dead lock and restores the ped.
--- Called by the server via 'atc:combat:revive'; never by client code directly.
function ATC.CombatClient.Revive()
    if not _dead then return end
    _dead      = false
    _deathTime = nil

    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)

    SetEntityInvincible(ped, false)
    FreezeEntityPosition(ped, false)

    NetworkResurrectLocalPlayer(
        coords.x, coords.y, coords.z,
        GetEntityHeading(ped),
        true, false
    )

    SetEntityHealth(ped, 200)

    SendNUIMessage({ type = 'ATC_PLAYER_REVIVED' })
end

-- ── Death monitor thread ──────────────────────────────────────────────────────

CreateThread(function()
    while true do
        Wait(500)

        if ATC.Characters and ATC.Characters.IsSpawned() then
            local ped = PlayerPedId()

            -- Transition into dead state
            if IsEntityDead(ped) and not _dead then
                _dead      = true
                _deathTime = GetGameTimer()

                -- Freeze the ped so it cannot be moved while downed
                SetEntityInvincible(ped, true)
                FreezeEntityPosition(ped, true)

                -- Notify server (server validates, logs, and may trigger EMS dispatch)
                TriggerServerEvent('atc:combat:player:died', {})

                SendNUIMessage({
                    type    = 'ATC_PLAYER_DEAD',
                    payload = { respawnTimeout = RESPAWN_TIMEOUT },
                })
            end

            -- Once the timeout elapses the player may choose to respawn themselves
            if _dead and _deathTime and (GetGameTimer() - _deathTime) >= RESPAWN_TIMEOUT then
                SendNUIMessage({ type = 'ATC_RESPAWN_AVAILABLE' })
            end
        end
    end
end)

-- ── Network events ────────────────────────────────────────────────────────────

-- Server-authorised revive (by EMS, admin, or respawn grant)
RegisterNetEvent('atc:combat:revive')
AddEventHandler('atc:combat:revive', function()
    ATC.CombatClient.Revive()
end)

-- ── NUI callbacks ─────────────────────────────────────────────────────────────

-- Player clicks the respawn button in the death screen
RegisterNUICallback('atc:combat:respawn', function(_data, cb)
    if _dead then
        TriggerServerEvent('atc:player:request:respawn', {})
    end
    cb('ok')
end)

-- ── Nearby revive command ─────────────────────────────────────────────────────

RegisterCommand('atc_revive_nearby', function()
    -- Only non-dead players can attempt a revive
    if _dead then return end

    local myPed    = PlayerPedId()
    local myCoords = GetEntityCoords(myPed)
    local nearest, nearestDist = nil, 3.0

    for _, playerId in ipairs(GetActivePlayers()) do
        if playerId ~= PlayerId() then
            local targetPed = GetPlayerPed(playerId)
            if IsEntityDead(targetPed) then
                local dist = #(myCoords - GetEntityCoords(targetPed))
                if dist < nearestDist then
                    nearestDist = dist
                    nearest     = GetPlayerServerId(playerId)
                end
            end
        end
    end

    if nearest then
        TriggerServerEvent('atc:combat:revive:attempt', { targetSource = nearest })
    end
end, false)

RegisterKeyMapping(
    'atc_revive_nearby',
    ATC.Locale.T('combat.revive_nearby') or 'Revive Nearby',
    'keyboard',
    'e'
)
