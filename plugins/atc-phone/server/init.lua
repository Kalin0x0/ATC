ATC = ATC or {}
ATC.Phone = {}

-- ─── Contacts ──────────────────────────────────────────────────────────────────
ATC.Firewall.On('atc:phone:contacts:get', {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { window = 5000, max = 5 },
}, function(src, _payload)
    local characterId = ATC.Sessions.GetCharacterId(src)
    if not characterId then return end

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

    ATC.HTTP.Post('/api/v1/comms/messages', {
        characterId = characterId,
        to          = to,
        message     = msg,
    }, function(ok, _status, _data)
        TriggerClientEvent('atc:phone:message:sent', src, { success = ok })

        if not ok then return end

        -- Deliver to recipient if they are online
        for _, pid in ipairs(GetPlayers()) do
            local p = tonumber(pid)
            if p and ATC.Sessions.GetCharacterId(p) == to then
                TriggerClientEvent('atc:phone:message:received', p, {
                    from      = characterId,
                    message   = msg,
                    timestamp = os.time(),
                })
            end
        end
    end)
end)

-- ─── Banking ───────────────────────────────────────────────────────────────────
ATC.Firewall.On('atc:phone:bank:get', {
    clientAllowed  = true,
    requireSession = true,
    rateLimit      = { window = 5000, max = 5 },
}, function(src, _payload)
    local principalId = ATC.Accounts.GetPrincipalId(src)
    if not principalId then return end

    ATC.HTTP.Get('/api/v1/economy/wallets/' .. principalId, function(ok, _status, data)
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
