-- ATC Core — Client Character System
-- Manages character state, selection flow, and world spawn.

ATC            = ATC            or {}
ATC.Characters = ATC.Characters or {}

local _currentCharacter = nil   -- { characterId, firstName, lastName, spawned, model }

local DEFAULT_SPAWN    = vector3(-269.4, -955.3, 31.2)
local DEFAULT_HEADING  = 0.0
local DEFAULT_MODEL    = 'mp_m_freemode_01'

-- ── Internal helpers ──────────────────────────────────────────────────────────

--- Block until the model hash is loaded, then return it.
--- We cap the wait at 5 s to avoid an infinite hang on bad model names.
local function LoadModel(modelName)
    local hash = GetHashKey(modelName)
    if not IsModelValid(hash) then
        hash = GetHashKey(DEFAULT_MODEL)
    end
    local waited = 0
    RequestModel(hash)
    while not HasModelLoaded(hash) and waited < 5000 do
        Wait(100)
        waited = waited + 100
    end
    return hash
end

--- Full client-side spawn sequence: fade → teleport → set model → fade in.
local function SpawnCharacter(character)
    local ped = PlayerPedId()

    DoScreenFadeOut(500)
    Wait(500)

    -- Resurrect in-place first so the ped is usable before we teleport
    NetworkResurrectLocalPlayer(
        DEFAULT_SPAWN.x, DEFAULT_SPAWN.y, DEFAULT_SPAWN.z,
        DEFAULT_HEADING, true, false
    )

    -- Load and apply model (use default; character.model may specify a custom later)
    local modelName = (character and character.model) or DEFAULT_MODEL
    local modelHash = LoadModel(modelName)
    SetPlayerModel(PlayerId(), modelHash)
    SetModelAsNoLongerNeeded(modelHash)

    ped = PlayerPedId()  -- refresh after model change

    SetEntityCoords(ped, DEFAULT_SPAWN.x, DEFAULT_SPAWN.y, DEFAULT_SPAWN.z,
        false, false, false, true)
    SetEntityHeading(ped, DEFAULT_HEADING)
    SetEntityHealth(ped, 200)

    DoScreenFadeIn(500)

    if _currentCharacter then
        _currentCharacter.spawned = true
    end
end

-- ── Public API ────────────────────────────────────────────────────────────────

--- Returns the currently active character table, or nil.
function ATC.Characters.GetCurrent()
    return _currentCharacter
end

--- Returns true after the spawn sequence has completed.
function ATC.Characters.IsSpawned()
    return _currentCharacter ~= nil and _currentCharacter.spawned == true
end

--- Ask the server to select a character.
--- cb(ok: boolean) is called after the server responds.
function ATC.Characters.Select(characterId, cb)
    TriggerServerEvent(ATC.Events.CHARACTER.SELECT, { characterId = characterId })
    -- Result arrives via the CHARACTER.SELECTED net-event; cb is not wired here
    -- because the NUI layer drives the UI response directly.
    if cb then cb(true) end
end

-- ── Network events ────────────────────────────────────────────────────────────

-- Server confirming (or rejecting) a character selection request
RegisterNetEvent(ATC.Events.CHARACTER.SELECTED)
AddEventHandler(ATC.Events.CHARACTER.SELECTED, function(data)
    if not data then return end

    if data.success then
        _currentCharacter = {
            characterId = data.characterId,
            firstName   = data.firstName   or '',
            lastName    = data.lastName    or '',
            spawned     = false,
            model       = data.model       or DEFAULT_MODEL,
        }

        SpawnCharacter(_currentCharacter)

        SendNUIMessage({
            type    = 'ATC_CHARACTER_SELECTED',
            payload = {
                characterId = _currentCharacter.characterId,
                firstName   = _currentCharacter.firstName,
                lastName    = _currentCharacter.lastName,
            },
        })
    else
        SendNUIMessage({
            type    = 'ATC_CHARACTER_SELECT_FAILED',
            payload = { reason = data.reason or 'unknown' },
        })
    end
end)

-- After SERVER_READY the character may already be cached server-side (reconnect).
-- We ask for a state push so the client re-hydrates without re-selecting.
RegisterNetEvent(ATC.Events.CORE.SERVER_READY)
AddEventHandler(ATC.Events.CORE.SERVER_READY, function()
    TriggerServerEvent('atc:character:state:request')
end)

-- Server response to atc:character:state:request
RegisterNetEvent('atc:character:state:response')
AddEventHandler('atc:character:state:response', function(data)
    if not data or not data.characterId then return end

    _currentCharacter = {
        characterId = data.characterId,
        firstName   = data.firstName or '',
        lastName    = data.lastName  or '',
        spawned     = data.spawned   or false,
        model       = data.model     or DEFAULT_MODEL,
    }

    -- If the server already considers the character spawned (e.g., after a
    -- reconnect), run the spawn flow again to place the ped correctly.
    if _currentCharacter.spawned then
        SpawnCharacter(_currentCharacter)
    end

    SendNUIMessage({
        type    = 'ATC_CHARACTER_SELECTED',
        payload = {
            characterId = _currentCharacter.characterId,
            firstName   = _currentCharacter.firstName,
            lastName    = _currentCharacter.lastName,
        },
    })
end)

-- ── NUI callbacks ─────────────────────────────────────────────────────────────

RegisterNUICallback('atc:character:select', function(data, cb)
    if not data or not data.characterId then
        cb('error')
        return
    end
    TriggerServerEvent(ATC.Events.CHARACTER.SELECT, { characterId = data.characterId })
    cb('ok')
end)

-- ── Cleanup ───────────────────────────────────────────────────────────────────

AddEventHandler('onResourceStop', function(resourceName)
    if resourceName == GetCurrentResourceName() then
        ATC.Characters = nil
    end
end)
