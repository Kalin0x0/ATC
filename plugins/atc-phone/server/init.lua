ATC = ATC or {}
ATC.Phone = {}

-- ── API backing ───────────────────────────────────────────────────────────────
-- The API's /api/v1/comms namespace is a tactical radio system — channels,
-- broadcasts, signals, jamming, encryption. It is not phone messaging: there is
-- no contacts endpoint and no messages endpoint, and no table behind either, so
-- the two requests that used to be here 404'd on every use.
--
-- Banking is unaffected; that endpoint exists and is called normally below.
--
-- A switch, not a TODO: set it to true once those endpoints exist and the
-- requests resume unchanged.
local PHONE_API_ENABLED = false

local _warnedContacts = false
local _warnedMessages = false

--- Deliver a message to the recipient if they are currently online.
--- Pure server-side fan-out — needs no API, which is why it is kept out of the
--- request callback: gating it on a call that cannot succeed meant no message
--- was ever delivered, even between two connected players.
--- @return boolean delivered  true when the recipient was online and reached
local function _deliverMessage(fromCharacterId, toCharacterId, message)
    local delivered = false
    for _, pid in ipairs(GetPlayers()) do
        local p = tonumber(pid)
        if p and ATC.Sessions.GetCharacterId(p) == toCharacterId then
            TriggerClientEvent('atc:phone:message:received', p, {
                from      = fromCharacterId,
                message   = message,
                timestamp = os.time(),
            })
            delivered = true
        end
    end
    return delivered
end

-- ─── Contacts ──────────────────────────────────────────────────────────────────
ATC.Firewall.On('atc:phone:contacts:get', {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { window = 5000, max = 5 },
}, function(src, _payload)
    local characterId = ATC.Sessions.GetCharacterId(src)
    if not characterId then return end

    if not PHONE_API_ENABLED then
        if not _warnedContacts then
            _warnedContacts = true
            ATC.Log.Warn('phone', 'Contacts have no API backing — no contacts endpoint exists. Returning an empty list. See PHONE_API_ENABLED in this file.')
        end
        -- Same payload the old failure path produced, without the doomed request.
        TriggerClientEvent('atc:phone:contacts:response', src, { contacts = {} })
        return
    end

    ATC.HTTP.Get('/api/v1/comms/contacts?characterId=' .. characterId, function(ok, _status, data)
        TriggerClientEvent('atc:phone:contacts:response', src, ok and data or { contacts = {} })
    end)
end)

-- ─── Send Message ──────────────────────────────────────────────────────────────
ATC.Firewall.On('atc:phone:message:send', {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { window = 2000, max = 10 },
}, function(src, payload)
    -- Validate payload shape before processing
    if type(payload) ~= 'table' then return end

    local msg = tostring(payload.message or ''):sub(1, 256)
    local to  = type(payload.to) == 'string' and payload.to or ''

    if msg == '' or to == '' then return end

    local characterId = ATC.Sessions.GetCharacterId(src)
    if not characterId then return end

    if not PHONE_API_ENABLED then
        if not _warnedMessages then
            _warnedMessages = true
            ATC.Log.Warn('phone', 'Messages are not persisted — the API has no messages endpoint. Delivering live to online recipients only; nothing is stored and an offline recipient never receives it. See PHONE_API_ENABLED in this file.')
        end
        -- success reports whether the recipient was actually reached. Without
        -- storage there is no offline delivery, so claiming success for an
        -- offline recipient would be a lie to the sender's UI.
        local delivered = _deliverMessage(characterId, to, msg)
        TriggerClientEvent('atc:phone:message:sent', src, { success = delivered })
        return
    end

    ATC.HTTP.Post('/api/v1/comms/messages', {
        characterId = characterId,
        to          = to,
        message     = msg,
    }, function(ok, _status, _data)
        TriggerClientEvent('atc:phone:message:sent', src, { success = ok })

        if not ok then return end

        _deliverMessage(characterId, to, msg)
    end)
end)

-- ─── Banking ───────────────────────────────────────────────────────────────────
ATC.Firewall.On('atc:phone:bank:get', {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { window = 5000, max = 5 },
}, function(src, _payload)
    -- Wallets are keyed by characterId, not principalId.
    local characterId = ATC.Sessions.GetCharacterId(src)
    if not characterId then return end

    ATC.HTTP.Get('/api/v1/wallets/character/' .. characterId, function(ok, _status, data)
        TriggerClientEvent('atc:phone:bank:response', src, ok and data or nil)
    end)
end)

-- ─── Emergency (911) ───────────────────────────────────────────────────────────
ATC.Firewall.On('atc:phone:911', {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { window = 60000, max = 2 },
}, function(src, payload)
    local message = 'Emergency'
    if type(payload) == 'table' and payload.message then
        message = tostring(payload.message):sub(1, 128)
    end

    local ped    = GetPlayerPed(src)
    local coords = GetEntityCoords(ped)

    TriggerEvent('atc:dispatch:call:new', {
        type     = 'medical',
        priority = 'high',
        message  = message,
        source   = src,
        coords   = coords,
    })

    TriggerClientEvent('atc:phone:911:sent', src, { success = true })
end)

-- ─── Live Location Sharing ───────────────────────────────────────────────────────
-- Player shares coords with a target character, delivered if online
ATC.Firewall.On('atc:phone:location:share', { clientAllowed = true, requireSession = true, rateLimit = { window = 3000, max = 10 } }, function(src, payload)
  local to = type(payload) == 'table' and type(payload.to) == 'string' and payload.to or ''
  local x  = tonumber(payload and payload.x); local y = tonumber(payload and payload.y); local z = tonumber(payload and payload.z)
  if to == '' or not x or not y then return end
  local fromId = ATC.Sessions.GetCharacterId(src)
  if not fromId then return end
  for _, pid in ipairs(GetPlayers()) do
    local p = tonumber(pid)
    if ATC.Sessions.GetCharacterId(p) == to then
      TriggerClientEvent('atc:phone:location:received', p, { from = fromId, x = x, y = y, z = z, ts = os.time() })
    end
  end
  TriggerClientEvent('atc:phone:location:shared', src, { to = to })
end)
