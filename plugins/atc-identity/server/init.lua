-- ATC Identity Plugin — Server
-- Handles character creation and listing for the identity/selection flow.
-- All mutations are server-authoritative; clients cannot bypass validation.

-- ── Validation helpers ────────────────────────────────────────────────────────

--- Validate a name segment (first or last name).
--- Max 32 chars, letters, spaces and hyphens only.
--- @param name string
--- @return boolean
local function _isValidName(name)
    if type(name) ~= 'string' then return false end
    local trimmed = name:match('^%s*(.-)%s*$')
    if #trimmed < 1 or #trimmed > 32 then return false end
    -- Allow letters (including unicode ranges via %a), spaces and hyphens
    if trimmed:match('[^%a%s%-]') then return false end
    return true
end

--- Validate ISO 8601 date string (YYYY-MM-DD).
--- @param dob string
--- @return boolean
local function _isValidDOB(dob)
    if type(dob) ~= 'string' then return false end
    local y, m, d = dob:match('^(%d%d%d%d)%-(%d%d)%-(%d%d)$')
    if not y then return false end
    y, m, d = tonumber(y), tonumber(m), tonumber(d)
    if m < 1 or m > 12 then return false end
    if d < 1 or d > 31 then return false end
    -- Rough minimum age check: born before 2010
    if y > 2010 then return false end
    return true
end

--- Validate gender value.
--- @param gender string
--- @return boolean
local function _isValidGender(gender)
    return gender == 'male' or gender == 'female' or gender == 'non_binary'
end

-- ── Event: character create ───────────────────────────────────────────────────

ATC.Firewall.On(
    'atc:identity:character:create',
    {
        clientAllowed  = true,
        requireSession = true,
        rateLimit      = { window = 60000, max = 3 },
    },
    function(src, payload)
        if type(payload) ~= 'table' then
            ATC.Log.Warn('identity', 'character:create — invalid payload type', { source = src })
            return
        end

        local firstName   = payload.firstName
        local lastName    = payload.lastName
        local gender      = payload.gender
        local dateOfBirth = payload.dateOfBirth

        -- Server-side validation
        if not _isValidName(firstName) then
            ATC.Log.Warn('identity', 'character:create — invalid firstName', {
                source = src, firstName = tostring(firstName),
            })
            TriggerClientEvent('atc:identity:character:create:error', src, {
                code    = 'INVALID_FIRST_NAME',
                message = 'First name must be 1–32 letters.',
            })
            return
        end

        if not _isValidName(lastName) then
            ATC.Log.Warn('identity', 'character:create — invalid lastName', {
                source = src, lastName = tostring(lastName),
            })
            TriggerClientEvent('atc:identity:character:create:error', src, {
                code    = 'INVALID_LAST_NAME',
                message = 'Last name must be 1–32 letters.',
            })
            return
        end

        if not _isValidGender(gender) then
            ATC.Log.Warn('identity', 'character:create — invalid gender', {
                source = src, gender = tostring(gender),
            })
            TriggerClientEvent('atc:identity:character:create:error', src, {
                code    = 'INVALID_GENDER',
                message = 'Gender must be male, female, or non_binary.',
            })
            return
        end

        if not _isValidDOB(dateOfBirth) then
            ATC.Log.Warn('identity', 'character:create — invalid dateOfBirth', {
                source = src, dateOfBirth = tostring(dateOfBirth),
            })
            TriggerClientEvent('atc:identity:character:create:error', src, {
                code    = 'INVALID_DOB',
                message = 'Date of birth must be YYYY-MM-DD and realistic.',
            })
            return
        end

        local session = ATC.Sessions.Get(src)
        if not session then
            ATC.Log.Warn('identity', 'character:create — no session', { source = src })
            return
        end

        local body = {
            sessionId   = session.id,
            firstName   = firstName,
            lastName    = lastName,
            gender      = gender,
            dateOfBirth = dateOfBirth,
            slot        = 1,
        }

        ATC.HTTP.Post('/api/v1/characters', body, function(ok, status, data, err)
            if not ok then
                ATC.Log.Error('identity', 'character:create — API error', {
                    source = src, status = status, err = err,
                })
                TriggerClientEvent('atc:identity:character:create:error', src, {
                    code    = 'API_ERROR',
                    message = 'Character creation failed. Please try again.',
                })
                return
            end

            ATC.Log.Info('identity', 'Character created', {
                source      = src,
                characterId = data and data.id,
                name        = firstName .. ' ' .. lastName,
            })

            TriggerClientEvent('atc:identity:character:created', src, data)
        end)
    end
)

-- ── Event: character list ─────────────────────────────────────────────────────

ATC.Firewall.On(
    'atc:identity:character:list',
    {
        clientAllowed  = true,
        requireSession = true,
        rateLimit      = { window = 5000, max = 5 },
    },
    function(src, _payload)
        local session = ATC.Sessions.Get(src)
        if not session or not session.accountId then
            ATC.Log.Warn('identity', 'character:list — no accountId in session', { source = src })
            TriggerClientEvent('atc:identity:character:list:response', src, {})
            return
        end

        ATC.HTTP.Get('/api/v1/accounts/' .. session.accountId .. '/characters', function(ok, status, data, err)
            if not ok then
                ATC.Log.Error('identity', 'character:list — API error', {
                    source = src, status = status, err = err,
                })
                TriggerClientEvent('atc:identity:character:list:response', src, {})
                return
            end

            local characters = (data and data.characters) or {}

            ATC.Log.Debug('identity', 'Character list sent to client', {
                source = src, count = #characters,
            })

            TriggerClientEvent('atc:identity:character:list:response', src, characters)
        end)
    end
)

ATC.Log.Info('identity', 'atc-identity server plugin loaded')
