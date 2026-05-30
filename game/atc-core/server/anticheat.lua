-- ATC Anti-Cheat — behavioral, movement, and stat validation
ATC = ATC or {}
ATC.AntiCheat = ATC.AntiCheat or {}

local _violations    = {}  -- source → { count, lastViolation }
local KICK_THRESHOLD = 5
local BAN_THRESHOLD  = 10

local function _recordViolation(source, reason, severity)
    severity = severity or 1
    if not _violations[source] then _violations[source] = { count=0, firstSeen=os.time() } end
    _violations[source].count = _violations[source].count + severity
    _violations[source].lastReason = reason
    local count = _violations[source].count
    ATC.Log.Security('anticheat', 'Violation recorded', { source=source, reason=reason, severity=severity, total=count })
    if count >= BAN_THRESHOLD then
        local identifier = GetPlayerIdentifierByType(source, 'license')
        ATC.HTTP.Post('/api/v1/accounts/ban', { identifier=identifier or 'unknown', reason='[AutoBan] '..reason, expiresAt=nil }, function() end)
        DropPlayer(source, '[ATC] You have been banned: '..reason)
    elseif count >= KICK_THRESHOLD then
        DropPlayer(source, '[ATC] Anti-cheat violation: '..reason)
    else
        -- Warn only
        TriggerClientEvent('atc:anticheat:warning', source, { reason=reason, count=count })
    end
end

-- ── Movement validation ─────────────────────────────────────────────────────
local _lastPos  = {}
local _lastTime = {}

CreateThread(function()
    while true do
        Wait(1000)
        for _, playerId in ipairs(GetPlayers()) do
            local src = tonumber(playerId)
            local ped = GetPlayerPed(src)
            if DoesEntityExist(ped) and not IsEntityDead(ped) then
                local pos  = GetEntityCoords(ped)
                local now  = GetGameTimer()
                local last = _lastPos[src]
                local t    = _lastTime[src]
                if last and t then
                    local dt   = (now - t) / 1000.0
                    local dist = #(pos - last)
                    local speed = dt > 0 and dist / dt or 0
                    -- Max legitimate speed: ~90 m/s (fastest jets)
                    if speed > 150.0 and not IsPedInAnyVehicle(ped, false) then
                        _recordViolation(src, 'speed_hack ('..math.floor(speed)..'m/s on foot)', 2)
                    end
                end
                _lastPos[src]  = pos
                _lastTime[src] = now
            end
        end
    end
end)

-- ── Weapon validation ────────────────────────────────────────────────────────
-- Validate weapon damage reports coming from client
AddEventHandler('atc:combat:damage:request', function(params)
    local src = source
    if type(params) ~= 'table' then return end
    local dmg = tonumber(params.damageAmount) or 0
    -- Damage > 9999 is impossible
    if dmg > 9999 then
        _recordViolation(src, 'invalid_damage ('..tostring(dmg)..')', 3)
        return  -- drop the event
    end
    -- Nonce empty = replay attempt
    if type(params.replayNonce) ~= 'string' or #params.replayNonce < 4 then
        _recordViolation(src, 'missing_nonce', 1)
    end
end)

-- ── Resource injection detection ─────────────────────────────────────────────
AddEventHandler('onResourceStart', function(resourceName)
    -- Alert if unexpected resource starts after server boot
    ATC.Log.Info('anticheat', 'Resource started', { resource=resourceName })
end)

-- ── Client-side cheat detection (client reports) ────────────────────────────
ATC.Firewall.On('atc:anticheat:report', {clientAllowed=true,requireSession=true,rateLimit={window=10000,max=3}}, function(src, payload)
    -- Client detected an anomaly in its own state
    local reason = type(payload)=='table' and tostring(payload.reason or ''):sub(1,128) or 'client_anomaly'
    ATC.Log.Security('anticheat', 'Client self-report', { source=src, reason=reason })
end)

-- ── Player dropped: clean violations ────────────────────────────────────────
AddEventHandler('playerDropped', function()
    local src = source
    _violations[src] = nil
    _lastPos[src]    = nil
    _lastTime[src]   = nil
end)
