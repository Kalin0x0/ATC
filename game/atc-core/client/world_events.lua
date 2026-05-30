-- =============================================================================
-- ATC Dynamic World Events — Phase 99 (Client)
-- Renders minimap blips and HUD notifications for active world events.
-- =============================================================================

ATC = ATC or {}

-- ---------------------------------------------------------------------------
-- Local state
-- ---------------------------------------------------------------------------
local _activeEvents = {}  -- id → event data
local _eventBlips   = {}  -- id → blip handle

-- Blip sprite IDs by event type (GTA V sprite sheet)
local BLIP_SPRITES = {
    police_chase  = 161,  -- Police blip
    drug_deal     = 140,  -- Drug
    protest       = 153,  -- Group of people
    vehicle_crash = 307,  -- Crashed vehicle
    armed_robbery = 84,   -- Robbery
    gang_war      = 179,  -- Gang
}

-- Blip colour IDs by event type
local BLIP_COLOURS = {
    police_chase  = 3,   -- Blue
    drug_deal     = 2,   -- Green
    protest       = 46,  -- Orange
    vehicle_crash = 6,   -- Yellow
    armed_robbery = 1,   -- Red
    gang_war      = 1,   -- Red
}

local DEFAULT_SPRITE = 161
local DEFAULT_COLOUR = 1  -- Red

-- ---------------------------------------------------------------------------
-- Internal: create a minimap blip for a world event
-- ---------------------------------------------------------------------------
local function _createBlip(data)
    if not data.coords then return end

    local sprite = BLIP_SPRITES[data.type] or DEFAULT_SPRITE
    local colour = BLIP_COLOURS[data.type] or DEFAULT_COLOUR

    local blip = AddBlipForCoord(data.coords.x, data.coords.y, data.coords.z)
    SetBlipSprite(blip, sprite)
    SetBlipColour(blip, colour)
    SetBlipScale(blip, 0.7)
    SetBlipDisplay(blip, 4)        -- Minimap + main map
    SetBlipAsShortRange(blip, false)

    -- Set blip name
    BeginTextCommandSetBlipName('STRING')
    AddTextComponentString(data.type or 'World Event')
    EndTextCommandSetBlipName(blip)

    return blip
end

-- ---------------------------------------------------------------------------
-- Network: world event started
-- ---------------------------------------------------------------------------
RegisterNetEvent('atc:world:event:start')
AddEventHandler('atc:world:event:start', function(data)
    if not data or not data.id then return end

    -- Idempotency: ignore if already tracked
    if _activeEvents[data.id] then return end

    _activeEvents[data.id] = data

    local blip = _createBlip(data)
    if blip then
        _eventBlips[data.id] = blip
    end

    -- NUI notification
    SendNUIMessage({
        type    = 'ATC_NOTIFICATION',
        payload = {
            message  = 'World Event: ' .. tostring(data.type or 'unknown'),
            level    = 'warning',
            duration = 6000,
        },
    })
end)

-- ---------------------------------------------------------------------------
-- Network: world event ended
-- ---------------------------------------------------------------------------
RegisterNetEvent('atc:world:event:end')
AddEventHandler('atc:world:event:end', function(data)
    if not data or not data.id then return end

    _activeEvents[data.id] = nil

    local blip = _eventBlips[data.id]
    if blip and DoesBlipExist(blip) then
        RemoveBlip(blip)
    end
    _eventBlips[data.id] = nil
end)

-- ---------------------------------------------------------------------------
-- Public accessor for other client modules
-- ---------------------------------------------------------------------------
function ATC.GetActiveWorldEvents()
    return _activeEvents
end

-- ---------------------------------------------------------------------------
-- Natural disaster feedback
-- ---------------------------------------------------------------------------

RegisterNetEvent('atc:world:disaster')
AddEventHandler('atc:world:disaster', function(data)
    if not data then return end
    SendNUIMessage({
        type    = 'ATC_NOTIFICATION',
        payload = {
            message  = 'DISASTER WARNING: ' .. tostring(data.type or 'event') .. ' in your area!',
            level    = 'error',
            duration = 10000,
        },
    })
    -- Screen shake proportional to intensity
    ShakeGameplayCam('EXPLOSION_SHAKE', 0.3)
    Citizen.SetTimeout(5000, function() StopGameplayCamShaking(false) end)
end)

-- ---------------------------------------------------------------------------
-- Economy event HUD notification
-- ---------------------------------------------------------------------------

RegisterNetEvent('atc:world:economy:event')
AddEventHandler('atc:world:economy:event', function(data)
    if not data then return end
    SendNUIMessage({
        type    = 'ATC_NOTIFICATION',
        payload = {
            message  = tostring(data.message or 'Market event'),
            level    = 'warning',
            duration = 8000,
        },
    })
end)

-- ---------------------------------------------------------------------------
-- Seasonal event client handlers
-- ---------------------------------------------------------------------------
RegisterNetEvent('atc:world:seasonal:start')
AddEventHandler('atc:world:seasonal:start', function(data)
    if not data then return end
    SendNUIMessage({ type='ATC_NOTIFICATION', payload={ message='Seasonal Event: '..tostring(data.name or 'Event')..' has started!', level='success', duration=10000 } })
end)

RegisterNetEvent('atc:world:seasonal:end')
AddEventHandler('atc:world:seasonal:end', function(data)
    SendNUIMessage({ type='ATC_NOTIFICATION', payload={ message='Seasonal event has ended', level='info', duration=5000 } })
end)
