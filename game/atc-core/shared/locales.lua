-- ATC Core — Shared Locale System
-- Loaded on both sides; provides translation tables and helpers.

ATC = ATC or {}
ATC.Locales = ATC.Locales or {}

-- ── Translation tables ──────────────────────────────────────────────────────

local _translations = {
    en = {
        common = {
            loading = 'Loading...',
            error   = 'An error occurred. Please try again.',
            success = 'Success.',
            close   = 'Close',
            confirm = 'Confirm',
            cancel  = 'Cancel',
        },
        auth = {
            connecting      = 'Connecting to server...',
            session_created = 'Session established. Welcome.',
            session_expired = 'Your session has expired. Please reconnect.',
        },
        security = {
            event_blocked = 'Action blocked by server.',
            rate_limited  = 'Too many requests. Please slow down.',
            ban_notice    = 'You have been banned from this server.',
        },
        admin = {
            permission_denied = 'You do not have permission to perform this action.',
            action_logged     = 'This action has been logged.',
            target_not_found  = 'Target player not found.',
        },
        errors = {
            server_unreachable = 'Cannot reach the server. Please try again.',
            internal           = 'An internal error occurred.',
        },
    },

    de = {
        common = {
            loading = 'Laden...',
            error   = 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.',
            success = 'Erfolgreich.',
            close   = 'Schließen',
            confirm = 'Bestätigen',
            cancel  = 'Abbrechen',
        },
        auth = {
            connecting      = 'Verbinde mit Server...',
            session_created = 'Sitzung hergestellt. Willkommen.',
            session_expired = 'Deine Sitzung ist abgelaufen. Bitte erneut verbinden.',
        },
        security = {
            event_blocked = 'Aktion wurde vom Server blockiert.',
            rate_limited  = 'Zu viele Anfragen. Bitte langsamer.',
            ban_notice    = 'Du wurdest von diesem Server gesperrt.',
        },
        admin = {
            permission_denied = 'Du hast keine Berechtigung, diese Aktion durchzuführen.',
            action_logged     = 'Diese Aktion wurde protokolliert.',
            target_not_found  = 'Zielspieler nicht gefunden.',
        },
        errors = {
            server_unreachable = 'Der Server ist nicht erreichbar. Bitte versuche es erneut.',
            internal           = 'Ein interner Fehler ist aufgetreten.',
        },
    },

    fa = {
        common = {
            loading = 'در حال بارگذاری...',
            error   = 'خطایی رخ داده است. لطفاً دوباره امتحان کنید.',
            success = 'موفقیت‌آمیز.',
            close   = 'بستن',
            confirm = 'تأیید',
            cancel  = 'لغو',
        },
        auth = {
            connecting      = 'در حال اتصال به سرور...',
            session_created = 'جلسه برقرار شد. خوش آمدید.',
            session_expired = 'جلسه شما منقضی شده است. لطفاً دوباره وصل شوید.',
        },
        security = {
            event_blocked = 'عمل توسط سرور مسدود شد.',
            rate_limited  = 'درخواست‌های زیاد. لطفاً کمی صبر کنید.',
            ban_notice    = 'شما از این سرور مسدود شده‌اید.',
        },
        admin = {
            permission_denied = 'شما مجوز انجام این عمل را ندارید.',
            action_logged     = 'این عمل ثبت شده است.',
            target_not_found  = 'بازیکن هدف پیدا نشد.',
        },
        errors = {
            server_unreachable = 'سرور در دسترس نیست. لطفاً دوباره امتحان کنید.',
            internal           = 'خطای داخلی رخ داده است.',
        },
    },
}

-- ── Locale metadata ─────────────────────────────────────────────────────────

local _meta = {
    en = { code = 'en', name = 'English', nativeName = 'English', direction = 'ltr' },
    de = { code = 'de', name = 'German',  nativeName = 'Deutsch', direction = 'ltr' },
    fa = { code = 'fa', name = 'Persian', nativeName = 'فارسی',   direction = 'rtl' },
}

-- ── Public API ───────────────────────────────────────────────────────────────

function ATC.Locales.GetTranslations(code)
    return _translations[code] or _translations.en
end

function ATC.Locales.GetMeta(code)
    return _meta[code] or _meta.en
end

function ATC.Locales.IsSupported(code)
    return _translations[code] ~= nil
end

function ATC.Locales.GetSupported()
    return { 'en', 'de', 'fa' }
end

-- ── Translation helper ───────────────────────────────────────────────────────

--- Translate a dot-notation key with optional variable interpolation.
--- Falls back to English, then to the raw key if missing.
--- @param code string Locale code
--- @param key string Dot-notation key e.g. 'auth.connecting'
--- @param vars table|nil Optional { varName = value }
--- @return string
function ATC.Locales.T(code, key, vars)
    local translations = ATC.Locales.GetTranslations(code)
    local parts = {}
    for part in key:gmatch('[^%.]+') do
        table.insert(parts, part)
    end

    local val = translations
    for _, part in ipairs(parts) do
        if type(val) ~= 'table' then
            -- Try English fallback
            val = ATC.Locales.GetTranslations('en')
            for _, p in ipairs(parts) do
                if type(val) ~= 'table' then return key end
                val = val[p]
            end
            break
        end
        val = val[part]
    end

    if type(val) ~= 'string' then return key end

    if vars then
        val = val:gsub('{{(%w+)}}', function(varName)
            local replacement = vars[varName]
            return replacement ~= nil and tostring(replacement) or ('{{' .. varName .. '}}')
        end)
    end

    return val
end
