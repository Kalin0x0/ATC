-- ATC Core — Client Jobs
-- Caches the player's active job and duty state as pushed by the server.
-- Duty toggling is requested server-side; the client never self-promotes.

ATC      = ATC      or {}
ATC.Jobs = ATC.Jobs or {}

local _activeJob = {
    jobName   = 'unemployed',
    jobLabel  = 'Unemployed',
    rank      = 'recruit',
    rankLabel = 'Recruit',
    onDuty    = false,
}

-- ── Public API ────────────────────────────────────────────────────────────────

--- Returns the active job table.
function ATC.Jobs.GetActive()
    return _activeJob
end

--- Returns true when the player is on duty.
function ATC.Jobs.IsOnDuty()
    return _activeJob.onDuty == true
end

--- Requests a duty toggle from the server. The server will respond with
--- 'atc:jobs:duty:update' which drives the local state change.
function ATC.Jobs.SetDuty(onDuty)
    TriggerServerEvent('atc:jobs:duty:toggle', { onDuty = onDuty })
end

-- ── Internal: apply state ─────────────────────────────────────────────────────

local function ApplyJobState(data)
    if not data then return end
    _activeJob = {
        jobName   = data.jobName   or 'unemployed',
        jobLabel  = data.jobLabel  or 'Unemployed',
        rank      = data.rank      or 'recruit',
        rankLabel = data.rankLabel or 'Recruit',
        onDuty    = data.onDuty    or false,
    }
    SendNUIMessage({ type = 'ATC_JOB_UPDATE', payload = _activeJob })
end

-- ── Network events ────────────────────────────────────────────────────────────

-- Server confirms a duty state change
RegisterNetEvent('atc:jobs:duty:update')
AddEventHandler('atc:jobs:duty:update', function(data)
    if data and data.onDuty ~= nil then
        _activeJob.onDuty = data.onDuty
    end
    SendNUIMessage({ type = 'ATC_JOB_UPDATE', payload = _activeJob })
end)

-- Server notifies of a full job change (fired on character load, job promotion, etc.)
RegisterNetEvent('atc:jobs:job:changed')
AddEventHandler('atc:jobs:job:changed', function(data)
    ApplyJobState(data)
end)

-- Server responds to atc:jobs:state:request with the full job state
RegisterNetEvent('atc:jobs:state:response')
AddEventHandler('atc:jobs:state:response', function(data)
    ApplyJobState(data)
end)

-- When a character is selected, fetch the job state from the server
-- NOTE: RegisterNetEvent for CHARACTER.SELECTED is already called in characters.lua.
AddEventHandler(ATC.Events.CHARACTER.SELECTED, function(data)
    if data and data.success then
        TriggerServerEvent('atc:jobs:state:request')
    end
end)

-- ── NUI callbacks ─────────────────────────────────────────────────────────────

RegisterNUICallback('atc:jobs:duty:toggle', function(_data, cb)
    TriggerServerEvent('atc:jobs:duty:toggle')
    cb('ok')
end)
