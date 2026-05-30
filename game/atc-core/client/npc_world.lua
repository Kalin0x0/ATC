-- =============================================================================
-- ATC NPC World — Phase 96 (Client)
-- Applies density multipliers and panic reactions locally.
-- =============================================================================

ATC                = ATC                or {}
ATC.NPCWorldClient = ATC.NPCWorldClient or {}

-- ---------------------------------------------------------------------------
-- Local state
-- ---------------------------------------------------------------------------
local _density = 'medium'
local _mood    = 'calm'

-- Map density label → ped/vehicle density as absolute count hint (0-50 scale).
-- FiveM multipliers are 0.0-1.0; we normalise against 50 as the ceiling.
local DENSITY_MAP = {
    verylow = 5,
    low     = 10,
    medium  = 25,
    high    = 50,
}

-- ---------------------------------------------------------------------------
-- Apply density multipliers this frame
-- ---------------------------------------------------------------------------
local function _applyDensity(density)
    local val = DENSITY_MAP[density] or 25
    local mul = val / 50.0

    SetVehicleDensityMultiplierThisFrame(mul)
    SetPedDensityMultiplierThisFrame(mul)
    SetRandomVehicleDensityMultiplierThisFrame(mul)
    SetScenarioPedDensityMultiplierThisFrame(mul, mul)
    SetParkedVehicleDensityMultiplierThisFrame(mul)
end

-- ---------------------------------------------------------------------------
-- Network events
-- ---------------------------------------------------------------------------
RegisterNetEvent('atc:world:npc:schedule')
AddEventHandler('atc:world:npc:schedule', function(data)
    if not data then return end
    _density = data.density or _density
    _mood    = data.mood    or _mood
end)

RegisterNetEvent('atc:world:npc:reaction')
AddEventHandler('atc:world:npc:reaction', function(data)
    if not data or data.type ~= 'flee' then return end

    local coord = data.coords
    if not coord then return end

    local radius  = tonumber(data.radius) or 100.0
    local origin  = vector3(coord.x, coord.y, coord.z)
    local myPed   = PlayerPedId()

    -- Trigger panic task for every non-player ped inside the blast radius
    local pedList = GetGamePool('CPed') or {}
    for _, ped in ipairs(pedList) do
        if not IsPedAPlayer(ped) and DoesEntityExist(ped) then
            if #(GetEntityCoords(ped) - origin) < radius then
                TaskSmartFleePed(ped, myPed, 200.0, 30000, false, false)
            end
        end
    end
end)

-- ---------------------------------------------------------------------------
-- Per-frame density application loop (runs every 5 s to avoid per-frame cost)
-- ---------------------------------------------------------------------------
CreateThread(function()
    while true do
        -- Guard: only apply once ATC core is initialised
        if ATC.Core and ATC.Core.IsReady and ATC.Core.IsReady() then
            _applyDensity(_density)
        end
        Wait(5000)
    end
end)

-- ---------------------------------------------------------------------------
-- Public accessor (for other client modules that need to read current mood)
-- ---------------------------------------------------------------------------
function ATC.NPCWorldClient.GetMood()    return _mood    end
function ATC.NPCWorldClient.GetDensity() return _density end
