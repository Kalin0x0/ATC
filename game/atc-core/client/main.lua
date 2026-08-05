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

    -- Push server branding before ATC_CORE_READY so the character-select screen
    -- is drawn with the operator's wordmark and accent instead of the shipped
    -- defaults. Guarded: if branding is unavailable the NUI simply keeps the
    -- defaults already in the DOM/CSS.
    if ATC.Branding and type(ATC.Branding.Get) == 'function' then
        local ok, brand = pcall(ATC.Branding.Get)
        if ok and type(brand) == 'table' then
            SendNUIMessage({
                type    = 'ATC_BRANDING',
                payload = brand,
            })
        end
    end

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
