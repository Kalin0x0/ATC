-- ATC Jobs Plugin — Client
-- Handles duty toggle command, key mapping and incoming job-state events.
-- No duty state is stored client-side beyond what the server pushes.

ATC           = ATC           or {}
ATC.JobsPlugin = ATC.JobsPlugin or {}

-- ── Local State ───────────────────────────────────────────────────────────────

-- Mirrors the server-confirmed duty state. Read-only outside this file.
local _onDuty   = false
local _jobLabel = nil

-- ── Event Handlers ────────────────────────────────────────────────────────────

--- atc:jobs:duty:update
--- Sent by server after a successful duty toggle.
RegisterNetEvent('atc:jobs:duty:update')
AddEventHandler('atc:jobs:duty:update', function(data)
    if type(data) ~= 'table' then return end

    _onDuty   = data.onDuty   == true
    _jobLabel = type(data.jobLabel) == 'string' and data.jobLabel or _jobLabel

    local message = _onDuty
        and ('On duty' .. (_jobLabel and (' — ' .. _jobLabel) or ''))
        or  'Off duty'

    SendNUIMessage({
        type    = 'ATC_NOTIFICATION',
        payload = {
            message  = message,
            level    = _onDuty and 'success' or 'info',
            duration = 3000,
        },
    })
end)

--- atc:jobs:state:response
--- Sent by server in response to a state:request (e.g. on character select).
RegisterNetEvent('atc:jobs:state:response')
AddEventHandler('atc:jobs:state:response', function(data)
    if type(data) ~= 'table' then return end

    _onDuty   = data.onDuty   == true
    _jobLabel = type(data.jobLabel) == 'string' and data.jobLabel or nil
end)

-- ── Public Accessors ──────────────────────────────────────────────────────────

--- Returns the server-confirmed duty state.
function ATC.JobsPlugin.IsOnDuty()
    return _onDuty
end

--- Returns the current job label string, or nil.
function ATC.JobsPlugin.GetJobLabel()
    return _jobLabel
end

-- ── Commands ──────────────────────────────────────────────────────────────────

--- /duty  (also bound to F6)
--- Sends a duty-toggle request to the server.
RegisterCommand('duty', function()
    if not ATC.Core.IsReady() then
        SendNUIMessage({
            type    = 'ATC_NOTIFICATION',
            payload = {
                message  = 'Not connected — please wait',
                level    = 'warning',
                duration = 2000,
            },
        })
        return
    end

    TriggerServerEvent('atc:jobs:duty:toggle')
end, false)

RegisterKeyMapping('duty', 'Toggle Job Duty', 'keyboard', 'F6')

-- ── NUI / Job Menu Panel ──────────────────────────────────────────────────

--- /jobmenu  (F4)
--- Opens the job management panel with current job and salary data.
RegisterCommand('jobmenu', function()
    SetNuiFocus(true, true)
    SendNUIMessage({ type = 'ATC_JOBS_OPEN', payload = {
        job    = ATC.SDK and ATC.SDK.Jobs and ATC.SDK.Jobs.GetActive and ATC.SDK.Jobs.GetActive()
                 or { jobName = 'unemployed', jobLabel = 'Unemployed', rank = 'recruit', rankLabel = 'Recruit', onDuty = false },
        salary = { hourly = 500, lastPay = 0 },
    }})
end, false)
RegisterKeyMapping('jobmenu', 'Open Job Menu', 'keyboard', 'F4')

RegisterNUICallback('atc:jobs:close', function(_, cb)
    SetNuiFocus(false, false)
    cb('ok')
end)

RegisterNUICallback('atc:jobs:duty', function(data, cb)
    TriggerServerEvent('atc:jobs:duty:toggle')
    cb('ok')
end)
