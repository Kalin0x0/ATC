-- ============================================================
-- ATC EMS — Server Init
-- Plugin: atc-ems v0.1.0
-- ============================================================

-- ── Treat downed player ───────────────────────────────────────────────────────
ATC.Firewall.On('atc:ems:treat', {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { window = 5000, max = 10 }
}, function(src, payload)
    local targetSource = tonumber(payload and payload.targetSource)
    if not targetSource then return end

    local targetPed = GetPlayerPed(targetSource)
    if not IsEntityDead(targetPed) then return end

    local targetId = ATC.Sessions.GetCharacterId(targetSource)
    if not targetId then return end

    local treatType = type(payload) == 'table' and tostring(payload.treatType or 'basic') or 'basic'

    ATC.HTTP.Post('/api/v1/medical/treatments', {
        characterId         = targetId,
        treatmentType       = treatType,
        treatedByPrincipalId = ATC.Accounts.GetPrincipalId(src)
    }, function(ok, _, data)
        if ok then
            TriggerClientEvent('atc:combat:revive', targetSource)
            TriggerClientEvent('atc:ems:treated', src, { success = true })
            TriggerClientEvent('atc:ems:treated', targetSource, { revived = true })
        else
            TriggerClientEvent('atc:ems:treated', src, { success = false })
        end
    end)
end)

-- ── Get patient vitals ────────────────────────────────────────────────────────
ATC.Firewall.On('atc:ems:patient:info', {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { window = 3000, max = 10 }
}, function(src, payload)
    local targetSource = tonumber(payload and payload.targetSource)
    if not targetSource then return end

    local targetId = ATC.Sessions.GetCharacterId(targetSource)
    if not targetId then return end

    ATC.HTTP.Get('/api/v1/characters/' .. targetId .. '/vitals', function(ok, _, data)
        TriggerClientEvent('atc:ems:patient:response', src, ok and data or nil)
    end)
end)
