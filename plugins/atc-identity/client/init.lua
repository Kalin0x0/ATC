-- ATC Identity Plugin — Client
-- Drives the character selection / creation NUI and relays server responses.

-- ── NUI state ─────────────────────────────────────────────────────────────────

local _nuiActive = false

local function _sendNUI(msg)
    SendNUIMessage(msg)
end

-- ── Server → Client events ────────────────────────────────────────────────────

--- Server pushes character list after login / on demand.
RegisterNetEvent('atc:identity:character:list:response')
AddEventHandler('atc:identity:character:list:response', function(characters)
    _nuiActive = true
    SetNuiFocus(true, true)
    _sendNUI({
        type    = 'ATC_IDENTITY_CHARACTER_LIST',
        payload = characters,
    })
end)

--- Server confirms successful character creation.
RegisterNetEvent('atc:identity:character:created')
AddEventHandler('atc:identity:character:created', function(data)
    _sendNUI({
        type    = 'ATC_IDENTITY_CHARACTER_CREATED',
        payload = data,
    })
end)

--- Server reports a creation validation/API error.
RegisterNetEvent('atc:identity:character:create:error')
AddEventHandler('atc:identity:character:create:error', function(err)
    _sendNUI({
        type    = 'ATC_IDENTITY_CHARACTER_CREATE_ERROR',
        payload = err,
    })
end)

-- ── NUI Callbacks ─────────────────────────────────────────────────────────────

--- Player submits the character creation form from NUI.
RegisterNUICallback('atc:identity:character:create', function(data, cb)
    -- Basic client-side guard (non-empty check); full validation is server-side
    if not data or data.firstName == '' or data.lastName == '' then
        cb({ ok = false, error = 'Fields cannot be empty.' })
        return
    end

    TriggerServerEvent('atc:identity:character:create', {
        firstName   = data.firstName,
        lastName    = data.lastName,
        gender      = data.gender,
        dateOfBirth = data.dateOfBirth,
    })

    cb('ok')
end)

--- Player selects an existing character from the list in NUI.
RegisterNUICallback('atc:identity:character:select', function(data, cb)
    if not data or not data.characterId then
        cb({ ok = false, error = 'No character ID provided.' })
        return
    end

    -- Close NUI, release focus, then ask server to activate the character
    SetNuiFocus(false, false)
    _nuiActive = false

    TriggerServerEvent('atc:character:select', { characterId = data.characterId })
    cb('ok')
end)

--- Player closes / dismisses the identity NUI.
RegisterNUICallback('atc:identity:close', function(_data, cb)
    SetNuiFocus(false, false)
    _nuiActive = false
    cb('ok')
end)

-- ── Core lifecycle ────────────────────────────────────────────────────────────

--- When the server confirms the session is ready, request the character list.
--- This opens the character selection screen for the player.
AddEventHandler(ATC.Events.CORE.SERVER_READY, function(_data)
    TriggerServerEvent('atc:identity:character:list')
end)
