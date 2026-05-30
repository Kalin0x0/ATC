-- ============================================================
-- ATC — Atlantic Core
-- client/safezones.lua — Safezone HUD Feedback (Client)
-- Mirrors server zone state; exposes ATC.Safezones.IsInSafezone.
-- ============================================================

ATC           = ATC           or {}
ATC.Safezones = ATC.Safezones or {}

local _inSafezone = false

-- ── Server → Client ──────────────────────────────────────────

RegisterNetEvent('atc:safezone:enter')
AddEventHandler('atc:safezone:enter', function(data)
    _inSafezone = true
    SendNUIMessage({
        type    = 'ATC_NOTIFICATION',
        payload = {
            message  = 'Entered ' .. tostring(data and data.label or 'safezone') .. ' — No combat zone',
            level    = 'info',
            duration = 4000,
        },
    })
end)

RegisterNetEvent('atc:safezone:exit')
AddEventHandler('atc:safezone:exit', function()
    _inSafezone = false
end)

-- ── Public accessor ──────────────────────────────────────────

--- Returns true when the local player is inside a safezone.
--- @return boolean
function ATC.Safezones.IsInSafezone()
    return _inSafezone
end
