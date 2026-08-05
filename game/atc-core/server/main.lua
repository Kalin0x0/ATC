-- ATC Core — Server Entry Point
-- Initializes framework, registers built-in event handlers, and starts lifecycle.

-- Framework identity below stays as-is — it is attribution, not server branding.
-- The extra banner line reports what the operator configured (server brand) and
-- what the runtime detected (FiveM / VMP / RedM). Both lookups are guarded so a
-- load-order problem degrades the banner instead of failing startup.
local function _brand()
    if ATC.Branding and type(ATC.Branding.Title) == 'function' then
        local ok, name = pcall(ATC.Branding.Title)
        if ok and type(name) == 'string' and name ~= '' then
            return name
        end
    end
    if ATC.Config and type(ATC.Config.Name) == 'string' and ATC.Config.Name ~= '' then
        return ATC.Config.Name
    end
    return 'Atlantic Core'
end

local function _platform()
    if ATC.Platform and type(ATC.Platform.Describe) == 'function' then
        local ok, text = pcall(ATC.Platform.Describe)
        if ok and type(text) == 'string' and text ~= '' then
            return text, ATC.Platform.Id
        end
    end
    if ATC.Platform and type(ATC.Platform.Name) == 'string' and ATC.Platform.Name ~= '' then
        return ATC.Platform.Name, ATC.Platform.Id
    end
    return 'unknown (platform detection unavailable)', nil
end

-- Player-facing message prefix, derived from the atc_brand_short convar so a
-- self-hosted server rebrands its connect/kick text. Guarded the same way as
-- _brand() above: these strings sit on the deferral and DropPlayer paths, so a
-- missing or erroring ATC.Branding must degrade to the shipped literal rather
-- than break a connect or swallow a kick.
local function _tag()
    if ATC.Branding and type(ATC.Branding.Tag) == 'function' then
        local ok, tag = pcall(ATC.Branding.Tag)
        if ok and type(tag) == 'string' and tag ~= '' then
            return tag
        end
    end
    return '[ATC]'
end

local _brandName = _brand()
local _platformText, _platformId = _platform()

ATC.Log.Info('core', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
ATC.Log.Info('core', ' Atlantic Core (ATC) starting...', {
    version    = ATC.Config.Version,
    apiVersion = ATC.Config.ApiVersion,
    serverId   = ATC.Config.ServerId,
    debug      = ATC.Config.Debug,
})
ATC.Log.Info('core', ' Server: ' .. _brandName .. '  |  Platform: ' .. _platformText, {
    brand    = _brandName,
    platform = _platformId,
})
ATC.Log.Info('core', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

-- ── Player connecting ────────────────────────────────────────────────────────

AddEventHandler('playerConnecting', function(name, setKickReason, deferrals)
    local src = source
    deferrals.defer()
    deferrals.update(_tag() .. ' Verifying account...')

    -- Guard: API token must be set or we cannot verify anything
    if ATC.Config.ApiToken == '' then
        ATC.Log.Error('sessions', 'API token not configured — cannot verify player', { source = src })
        if ATC.Config.FailOpen then
            deferrals.done()
        else
            deferrals.done(_tag() .. ' Server configuration error. Please try again later.')
        end
        return
    end

    Citizen.SetTimeout(0, function()
        local identifier = GetPlayerIdentifierByType(src, 'license')

        if not identifier then
            ATC.Log.Warn('sessions', 'Player connecting without license identifier', {
                source = src, name = name,
            })
            deferrals.done(_tag() .. ' A valid Rockstar license is required to connect.')
            return
        end

        ATC.Log.Info('sessions', 'Player connecting', {
            source = src, name = name,
        })

        -- Collect secondary identifiers (stripped of type prefix)
        local identifiers = {}
        local identifierTypes = { 'license', 'license2', 'discord', 'steam', 'fivem' }
        for _, idType in ipairs(identifierTypes) do
            local value = GetPlayerIdentifierByType(src, idType)
            if value then
                -- Strip type prefix: "license:abc" → "abc"
                identifiers[idType] = value:match('^[^:]+:(.+)$') or value
            end
        end

        local language = ATC.Config.DefaultLocale

        -- Upsert account and check ban
        deferrals.update(_tag() .. ' Checking account...')
        ATC.HTTP.Post('/api/v1/accounts', {
            primaryIdentifier = identifier,
            identifiers       = identifiers,
            preferredLanguage = language,
        }, function(ok, status, data, err)
            if not ok then
                ATC.Log.Error('sessions', 'Account upsert API error', {
                    source = src, status = status,
                })
                if ATC.Config.FailOpen then
                    ATC.Log.Warn('sessions', 'Fail-open: allowing player despite API error', { source = src })
                    deferrals.done()
                else
                    deferrals.done(_tag() .. ' Could not verify your account. Please try again later.')
                end
                return
            end

            local accountId     = data and data.accountId
            local accountStatus = data and data.status

            if accountStatus == 'banned' or accountStatus == 'suspended' then
                ATC.Log.Security('ban', 'Banned player attempted connection', {
                    source    = src,
                    accountId = accountId,
                })
                deferrals.done(_tag() .. ' You are banned from this server.')
                return
            end

            ATC.Log.Info('sessions', 'Account verified', {
                source    = src,
                accountId = accountId,
                created   = data and data.created,
            })

            -- Stash accountId so CLIENT_READY can create the API session
            ATC.Sessions.StorePending(src, { accountId = accountId })

            deferrals.done()
        end)
    end)
end)

-- ── Player dropped ───────────────────────────────────────────────────────────

AddEventHandler('playerDropped', function(reason)
    local src = source
    ATC.Log.Info('sessions', 'Player dropped', { source = src, reason = reason })
    ATC.Sessions.Remove(src)

    ATC.HTTP.Delete('/api/v1/sessions/' .. src, function(ok, status, _data, err)
        if not ok then
            ATC.Log.Warn('sessions', 'Session end API error', {
                source = src, status = status, err = err,
            })
        end
    end)
end)

-- ── Client ready (atc:core:client:ready) ────────────────────────────────────

ATC.Firewall.On(
    ATC.Events.CORE.CLIENT_READY,
    { clientAllowed = true, requireSession = false, rateLimit = { window = 10000, max = 2 } },
    function(src, payload)
        local identifier = GetPlayerIdentifierByType(src, 'license')

        if not identifier then
            ATC.Log.Error('sessions', 'Client ready but no license identifier', { source = src })
            DropPlayer(src, _tag() .. ' No valid license identifier.')
            return
        end

        -- Resolve language (client suggestion, validated server-side)
        local requestedLang = payload and payload.language
        local language = (requestedLang and ATC.Locales.IsSupported(requestedLang))
            and requestedLang
            or ATC.Config.DefaultLocale

        local pending   = ATC.Sessions.ConsumePending(src)
        local accountId = pending and pending.accountId

        -- Create in-memory session first (with best-guess id, replaced below)
        local session = ATC.Sessions.Create(src, identifier, {
            language  = language,
            accountId = accountId,
        })

        -- Persist to REST API and upgrade session.id with the API-assigned value.
        -- Best-effort: if the API fails, session still works but character select won't be persisted.
        if accountId then
            ATC.HTTP.Post('/api/v1/sessions', {
                accountId         = accountId,
                source            = src,
                name              = GetPlayerName(src) or 'Unknown',
                primaryIdentifier = identifier,
                language          = language,
            }, function(ok, status, apiData, err)
                if ok and apiData and apiData.sessionId then
                    ATC.Sessions.Update(src, { id = apiData.sessionId })
                    ATC.Log.Debug('sessions', 'API session created', {
                        source = src, sessionId = apiData.sessionId,
                    })
                else
                    ATC.Log.Warn('sessions', 'API session creation failed', {
                        source = src, status = status, err = err,
                    })
                end
            end)
        end

        -- Send session data back to client
        TriggerClientEvent(ATC.Events.CORE.SERVER_READY, src, {
            version   = ATC.Config.Version,
            language  = session.language,
            direction = ATC.Locales.GetMeta(session.language).direction,
            sessionId = session.id,
        })

        ATC.Log.Info('core', 'Client session established', {
            source     = src,
            identifier = identifier,
            language   = session.language,
        })
    end
)

-- ── Character select (atc:character:select) ──────────────────────────────────

ATC.Firewall.On(
    ATC.Events.CHARACTER.SELECT,
    { clientAllowed = true, requireSession = true, rateLimit = { window = 60000, max = 3 } },
    function(src, payload)
        local characterId = payload and payload.characterId

        -- Validate: must be a 26-character alphanumeric ULID string
        if type(characterId) ~= 'string' or #characterId ~= 26 or not characterId:match('^[0-9A-Za-z]+$') then
            ATC.Log.Warn('characters', 'Invalid characterId in select payload', { source = src })
            return
        end

        ATC.Characters.Select(src, characterId, function(ok, data)
            if not ok then
                TriggerClientEvent(ATC.Events.CHARACTER.SELECTED, src, {
                    success     = false,
                    characterId = nil,
                })
                return
            end

            -- Emit server-side character selected event for plugins to hook into
            TriggerEvent(ATC.Events.PLAYER.CHARACTER_SELECTED, src, data)

            TriggerClientEvent(ATC.Events.CHARACTER.SELECTED, src, {
                success     = true,
                characterId = characterId,
                firstName   = data and data.firstName,
                lastName    = data and data.lastName,
            })
        end)
    end
)

-- ── Locale request ───────────────────────────────────────────────────────────

ATC.Firewall.On(
    ATC.Events.LOCALE.REQUEST,
    { clientAllowed = true, requireSession = false, rateLimit = { window = 5000, max = 3 } },
    function(src, payload)
        local requestedLang = payload and payload.language
        local lang = (requestedLang and ATC.Locales.IsSupported(requestedLang))
            and requestedLang
            or ATC.Config.DefaultLocale

        local translations = ATC.Locales.GetTranslations(lang)
        local meta         = ATC.Locales.GetMeta(lang)

        TriggerClientEvent(ATC.Events.LOCALE.LOADED, src, {
            code         = lang,
            direction    = meta.direction,
            translations = translations,
        })

        ATC.Log.Debug('locale', 'Locale sent to client', { source = src, lang = lang })
    end
)

-- ── Periodic maintenance ─────────────────────────────────────────────────────

CreateThread(function()
    while true do
        Wait(60000)  -- every 60 seconds
        ATC.Firewall.CleanupRateLimits()
        ATC.Log.Debug('core', 'Heartbeat', {
            onlinePlayers = ATC.Sessions.Count(),
            plugins       = #ATC.Plugins.GetLoadOrder(),
        })
    end
end)

-- ── Startup complete ─────────────────────────────────────────────────────────

Citizen.SetTimeout(500, function()
    ATC.Log.Info('core', 'ATC Core ready', {
        version       = ATC.Config.Version,
        defaultLocale = ATC.Config.DefaultLocale,
    })
    TriggerEvent(ATC.Events.CORE.SERVER_STARTED, { version = ATC.Config.Version })
end)
