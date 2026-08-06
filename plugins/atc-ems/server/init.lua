-- ============================================================
-- ATC EMS — Server Init
-- Plugin: atc-ems v0.1.0
-- ============================================================

-- ── Treat downed player ───────────────────────────────────────────────────────

-- NUI treatment labels → API treatment types. The API validates `type` against
-- a fixed enum (applyTreatmentSchema in packages/operations/src/schemas.ts), so
-- the client-supplied string is mapped to the closest allowed value and is never
-- forwarded verbatim. Anything unrecognised is recorded as 'other'.
local TREATMENT_TYPES = {
    basic        = 'bandage',
    advanced     = 'stabilize',
    defibrillate = 'defibrillator',
}

--- Revive the patient and notify both parties.
--- Pure server → client fan-out: it needs nothing back from the API, so it must
--- never be gated on the treatment record being written.
local function ApplyTreatment(medicSource, targetSource)
    TriggerClientEvent('atc:combat:revive', targetSource)
    TriggerClientEvent('atc:ems:treated', medicSource, { success = true })
    TriggerClientEvent('atc:ems:treated', targetSource, { revived = true })
end

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

    -- The revive is a local effect — apply it first so the patient is never left
    -- downed just because the treatment record could not be persisted.
    ApplyTreatment(src, targetSource)

    -- Persistence only. POST /api/v1/medical/treatments requires
    -- characterId + appliedByPrincipalId + type; with no principal id there is no
    -- valid body to send, so skip the record rather than fire a doomed request.
    local principalId = ATC.Accounts.GetPrincipalId(src)
    if not principalId then
        ATC.Log.Warn('ems', 'Treatment not recorded — no principal id for medic', {
            medic  = src,
            target = targetSource,
        })
        return
    end

    ATC.HTTP.Post('/api/v1/medical/treatments', {
        characterId          = targetId,
        appliedByPrincipalId = principalId,
        type                 = TREATMENT_TYPES[treatType] or 'other',
    }, function(ok, status)
        if not ok then
            ATC.Log.Warn('ems', 'Failed to record treatment', {
                characterId = targetId,
                httpStatus  = status,
            })
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

    -- Vitals are their own resource keyed by character, not a sub-resource of
    -- the character — the same path game/atc-core/server/vitals.lua uses.
    ATC.HTTP.Get('/api/v1/vitals/character/' .. targetId, function(ok, _, data)
        TriggerClientEvent('atc:ems:patient:response', src, ok and data or nil)
    end)
end)

-- ── Ambulance Dispatch ────────────────────────────────────────────────────────

ATC.Firewall.On('atc:ems:ambulance:request', {clientAllowed=true,requireSession=true,rateLimit={window=60000,max=2}}, function(src, payload)
    local x = tonumber(payload and payload.x) or 0
    local y = tonumber(payload and payload.y) or 0
    local z = tonumber(payload and payload.z) or 0
    TriggerEvent('atc:dispatch:call:new', { type='medical', priority='high', message='Ambulance requested', source=src, coords=vector3(x,y,z) })
    TriggerClientEvent('atc:ems:ambulance:dispatched', src, {})
end)

-- ── Hospital Check-in ─────────────────────────────────────────────────────────

ATC.Firewall.On('atc:hospital:checkin', {clientAllowed=true,requireSession=true,rateLimit={window=30000,max=3}}, function(src)
    local characterId = ATC.Sessions.GetCharacterId(src)
    if not characterId then return end
    local principalId = ATC.Accounts.GetPrincipalId(src)
    -- Charge fee
    if ATC.EconomyPlugin then
        ATC.EconomyPlugin.Charge(src, 500, 'hospital_fee', function(chargeOk)
            ATC.HTTP.Post('/api/v1/medical/treatments', { characterId=characterId, treatmentType='hospital', treatedByPrincipalId=principalId or characterId }, function(ok)
                TriggerClientEvent('atc:hospital:checkin:result', src, { success=true })
            end)
        end)
    else
        TriggerClientEvent('atc:hospital:checkin:result', src, { success=true })
    end
end)
