-- ATC Core — Shared Configuration
-- Loaded on both server and client sides

ATC = ATC or {}

ATC.Config = {
    Name       = 'Atlantic Core',
    Version    = '0.1.0',
    ApiVersion = '1',

    -- API connection (server-side only; read on server, ignored on client)
    ApiUrl      = GetConvar('atc_api_url', 'http://localhost:3000'),
    ApiToken    = GetConvar('atc_api_token', ''),
    ServerToken = GetConvar('atc_server_token', ''),
    ServerId    = GetConvar('atc_server_id', 'atc-main-01'),

    -- Fail-open: if true, allow player join even when API is unreachable
    -- Default false = block on API failure (safer)
    FailOpen       = GetConvar('atc_fail_open', 'false') == 'true',
    ApiTimeoutMs   = tonumber(GetConvar('atc_api_timeout_ms', '5000')) or 5000,

    -- Localization
    DefaultLocale    = GetConvar('atc_locale', 'en'),
    SupportedLocales = { 'en', 'de', 'fa' },

    -- Debug mode
    Debug = GetConvar('atc_debug', 'false') == 'true',

    -- Security thresholds (server-side only)
    Security = {
        AutoKickThreshold  = tonumber(GetConvar('atc_risk_kick_threshold', '85'))  or 85,
        AutoBanThreshold   = tonumber(GetConvar('atc_risk_ban_threshold', '100')) or 100,
        NotifyAdminThreshold = tonumber(GetConvar('atc_risk_notify_threshold', '60')) or 60,
    },
}

-- Validate tokens on server side
if IsDuplicityVersion() then
    if ATC.Config.ServerToken == '' then
        print('^3[ATC:WARN] atc_server_token is not set. Set it in server.cfg.^7')
    end
    if ATC.Config.ApiToken == '' then
        print('^3[ATC:WARN] atc_api_token is not set. API calls will fail. Set it in server.cfg.^7')
    end
end
