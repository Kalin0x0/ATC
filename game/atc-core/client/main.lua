-- ATC Core — Client Entry Point
-- Handles framework initialization on the client and NUI bridge setup.

ATC = ATC or {}
ATC.Core = ATC.Core or {}

local _ready     = false
local _sessionId = nil

-- ── Framework ready check ────────────────────────────────────────────────────

--- Returns true once the server has established a session for this client.
function ATC.Core.IsReady()
    return _ready
end

--- Returns the current session ID (set by server after CLIENT_READY handshake).
function ATC.Core.GetSessionId()
    return _sessionId
end

-- ── Resource start → CLIENT_READY handshake ──────────────────────────────────

AddEventHandler('onClientResourceStart', function(resourceName)
    if resourceName ~= GetCurrentResourceName() then return end

    -- Suggest a language to the server (server validates and may override)
    -- Phase 1: always default to 'en' until a config/NUI language picker exists.
    local suggestedLang = 'en'

    print('[ATC] Client resource started — sending CLIENT_READY')
    TriggerServerEvent(ATC.Events.CORE.CLIENT_READY, {
        language = suggestedLang,
    })
end)

-- ── Server session established ───────────────────────────────────────────────

RegisterNetEvent(ATC.Events.CORE.SERVER_READY)
AddEventHandler(ATC.Events.CORE.SERVER_READY, function(data)
    _ready     = true
    _sessionId = data.sessionId

    -- Apply server-assigned locale
    ATC.Locale.Set(data.language or 'en')

    -- Send locale + direction to NUI (browser)
    SendNUIMessage({
        type = 'ATC_CORE_READY',
        payload = {
            version   = data.version,
            language  = data.language,
            direction = data.direction or 'ltr',
            sessionId = data.sessionId,
        },
    })

    print(string.format(
        '[ATC] Client ready — v%s | lang: %s | dir: %s | session: %s',
        tostring(data.version),
        tostring(data.language),
        tostring(data.direction),
        tostring(data.sessionId)
    ))
end)

-- ── Locale loaded (full translation push from server) ─────────────────────────

RegisterNetEvent(ATC.Events.LOCALE.LOADED)
AddEventHandler(ATC.Events.LOCALE.LOADED, function(data)
    ATC.Locale.Set(data.code)

    SendNUIMessage({
        type = 'ATC_LOCALE_UPDATE',
        payload = {
            code         = data.code,
            direction    = data.direction,
            translations = data.translations,
        },
    })

    print(string.format('[ATC] Locale loaded: %s (%s)', data.code, data.direction))
end)
