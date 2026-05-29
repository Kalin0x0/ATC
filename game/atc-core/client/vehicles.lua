-- ATC Core — Client Vehicles
-- Tracks the player's vehicle state and streams HUD data to the NUI every 500 ms.
-- Seatbelt state is purely cosmetic client-side; the server enforces consequences.

ATC          = ATC          or {}
ATC.Vehicles = ATC.Vehicles or {}

local _inVehicle      = false
local _currentVehicle = 0
local _state          = {
    speed    = 0.0,
    fuel     = 100.0,
    seatbelt = false,
    gear     = 1,
    engineOn = false,
    model    = '',
}

-- ── Public API ────────────────────────────────────────────────────────────────

--- Returns true when the local ped is currently inside a vehicle.
function ATC.Vehicles.IsInVehicle()
    return _inVehicle
end

--- Returns the current vehicle state snapshot (safe to read even when not in a vehicle).
function ATC.Vehicles.GetState()
    return _state
end

--- Returns the vehicle entity handle, or 0 if not in a vehicle.
function ATC.Vehicles.GetCurrentVehicle()
    return _currentVehicle
end

-- ── Vehicle monitor thread ────────────────────────────────────────────────────

CreateThread(function()
    while true do
        Wait(500)

        local ped = PlayerPedId()
        local veh = GetVehiclePedIsIn(ped, false)   -- false = current vehicle only

        if veh ~= 0 and not _inVehicle then
            -- Entered a vehicle
            _inVehicle      = true
            _currentVehicle = veh

            TriggerEvent('atc:vehicle:client:entered', veh)
            SendNUIMessage({ type = 'ATC_VEHICLE_ENTERED' })

        elseif veh == 0 and _inVehicle then
            -- Exited a vehicle — reset state
            _inVehicle      = false
            _currentVehicle = 0
            _state          = {
                speed    = 0,
                fuel     = 100,
                seatbelt = false,
                gear     = 1,
                engineOn = false,
                model    = '',
            }

            TriggerEvent('atc:vehicle:client:exited')
            SendNUIMessage({ type = 'ATC_VEHICLE_EXITED' })
        end

        if _inVehicle then
            -- GetEntitySpeed returns m/s; multiply by 3.6 to get km/h
            _state.speed    = math.floor(GetEntitySpeed(veh) * 3.6)
            _state.fuel     = math.floor(GetVehicleFuelLevel(veh))
            _state.gear     = GetVehicleCurrentGear(veh)
            _state.engineOn = GetIsVehicleEngineRunning(veh)
            -- model is set once on entry; reading every tick is wasteful
            if _state.model == '' then
                _state.model = GetDisplayNameFromVehicleModel(GetEntityModel(veh))
            end

            SendNUIMessage({ type = 'ATC_VEHICLE_UPDATE', payload = _state })
        end
    end
end)

-- ── Seatbelt toggle ───────────────────────────────────────────────────────────

RegisterCommand('atc_seatbelt', function()
    if not _inVehicle then return end
    _state.seatbelt = not _state.seatbelt
    SendNUIMessage({
        type    = 'ATC_SEATBELT_TOGGLE',
        payload = { seatbelt = _state.seatbelt },
    })
end, false)

RegisterKeyMapping(
    'atc_seatbelt',
    ATC.Locale.T('vehicle.seatbelt') or 'Toggle Seatbelt',
    'keyboard',
    'b'
)
