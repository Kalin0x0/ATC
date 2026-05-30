-- ============================================================
-- ATC — Atlantic Core
-- client/missions.lua — Phase 90: Mission & Activity UX
-- Blip management, objective tracking, NUI bridge
-- ============================================================

ATC = ATC or {}
ATC.Missions = ATC.Missions or {}

local _activeMissions = {}   -- id → { title, description, objectives[], blip }
local _activeBlips    = {}   -- id → blipHandle (convenience ref)

-- ── Internal helpers ──────────────────────────────────────────

local function _createBlip(coords, label, color)
    local blip = AddBlipForCoord(coords.x, coords.y, coords.z)
    SetBlipScale(blip, 0.8)
    SetBlipColour(blip, color or 5)   -- default yellow
    SetBlipDisplay(blip, 4)
    BeginTextCommandSetBlipName('STRING')
    AddTextComponentString(label or 'Objective')
    EndTextCommandSetBlipName(blip)
    return blip
end

local function _removeBlip(blipHandle)
    if blipHandle and DoesBlipExist(blipHandle) then
        RemoveBlip(blipHandle)
    end
end

-- ── Public API ────────────────────────────────────────────────

--- Start (or restart) a mission. Removes any existing blip for the same id.
--- @param missionData table { id, title, description, coords?, objectives[] }
function ATC.Missions.Start(missionData)
    if not missionData or not missionData.id then return end
    local id = missionData.id

    -- Clean up an existing mission with the same id
    if _activeMissions[id] then ATC.Missions.End(id) end

    local blip = nil
    if missionData.coords then
        blip = _createBlip(
            vector3(missionData.coords.x, missionData.coords.y, missionData.coords.z),
            missionData.title
        )
    end

    _activeMissions[id] = {
        title       = missionData.title,
        description = missionData.description,
        objectives  = missionData.objectives or {},
        blip        = blip,
    }
    _activeBlips[id] = blip

    SendNUIMessage({ type = 'ATC_MISSION_START', payload = missionData })
end

--- Mark a single objective as complete/incomplete.
--- @param missionId     string
--- @param objectiveIndex number  (1-based)
--- @param completed     boolean
function ATC.Missions.UpdateObjective(missionId, objectiveIndex, completed)
    local m = _activeMissions[missionId]
    if not m then return end

    if m.objectives[objectiveIndex] then
        m.objectives[objectiveIndex].completed = completed
    end

    SendNUIMessage({
        type    = 'ATC_MISSION_UPDATE',
        payload = { id = missionId, objectives = m.objectives },
    })
end

--- Remove a mission, its blip, and hide the tracker.
--- @param missionId string
function ATC.Missions.End(missionId)
    local m = _activeMissions[missionId]
    if not m then return end

    _removeBlip(m.blip)
    _activeMissions[missionId] = nil
    _activeBlips[missionId]    = nil

    SendNUIMessage({ type = 'ATC_MISSION_END', payload = { id = missionId } })
end

--- Return shallow copy of all active missions (for external inspection).
function ATC.Missions.GetAll()
    local out = {}
    for id, m in pairs(_activeMissions) do
        out[id] = m
    end
    return out
end

-- ── Server-pushed events ──────────────────────────────────────

RegisterNetEvent('atc:mission:start')
AddEventHandler('atc:mission:start', function(data)
    ATC.Missions.Start(data)
end)

RegisterNetEvent('atc:mission:update')
AddEventHandler('atc:mission:update', function(data)
    if not data then return end
    ATC.Missions.UpdateObjective(data.missionId, data.objectiveIndex, data.completed)
end)

RegisterNetEvent('atc:mission:end')
AddEventHandler('atc:mission:end', function(data)
    if data and data.id then ATC.Missions.End(data.id) end
end)
