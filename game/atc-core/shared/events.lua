-- ATC Core — Shared Event Name Registry
-- All ATC event names are defined here. Never hardcode event strings elsewhere.

ATC = ATC or {}
ATC.Events = ATC.Events or {}

-- ── Core lifecycle ──────────────────────────────────────────────────────────
ATC.Events.CORE = {
    CLIENT_READY   = 'atc:core:client:ready',    -- client → server: client loaded
    SERVER_READY   = 'atc:core:server:ready',    -- server → client: session established
    PLUGIN_READY   = 'atc:core:plugin:ready',    -- plugin → core:  plugin initialized
    SERVER_STARTED = 'atc:core:server:started',  -- server → all:   framework ready
}

-- ── Player ──────────────────────────────────────────────────────────────────
ATC.Events.PLAYER = {
    CONNECTED          = 'atc:player:connected',
    DISCONNECTED       = 'atc:player:disconnected',
    CHARACTER_SELECTED = 'atc:player:character:selected',
    CHARACTER_CREATED  = 'atc:player:character:created',
    REQUEST_RESPAWN    = 'atc:player:request:respawn',
    REQUEST_CHAR_SELECT = 'atc:player:request:character_select',
}

-- ── Security ────────────────────────────────────────────────────────────────
ATC.Events.SECURITY = {
    VIOLATION_DETECTED = 'atc:security:violation:detected',
    RATELIMIT_EXCEEDED = 'atc:security:ratelimit:exceeded',
    BAN_ISSUED         = 'atc:security:ban:issued',
    BAN_CHECKED        = 'atc:security:ban:checked',
}

-- ── Character ────────────────────────────────────────────────────────────────
ATC.Events.CHARACTER = {
    SELECT   = 'atc:character:select',    -- client → server: player requests character selection
    SELECTED = 'atc:character:selected',  -- server → client: character selection confirmed
}

-- ── Economy ──────────────────────────────────────────────────────────────────
ATC.Events.ECONOMY = {
    BALANCE_REQUEST = 'atc:economy:balance:request',  -- client → server: request current balance
    BALANCE_UPDATE  = 'atc:economy:balance:update',   -- server → client: balance data
    MONEY_CHANGED   = 'atc:economy:money:changed',    -- server → all plugins: balance mutated
}

-- ── Inventory ────────────────────────────────────────────────────────────────
ATC.Events.INVENTORY = {
    REQUEST      = 'atc:inventory:request',       -- client → server: request inventory (read-only)
    UPDATE       = 'atc:inventory:update',         -- server → client: inventory data response
    ITEM_CHANGED = 'atc:inventory:item:changed',  -- server → all plugins: item added/removed/moved
}

-- ── Item Runtime ─────────────────────────────────────────────────────────────
ATC.Events.ITEM = {
    USE     = 'atc:item:use',      -- client → server: player requests to use item in slot
    USED    = 'atc:item:used',     -- server → client: item used successfully
    COOLDOWN = 'atc:item:cooldown', -- server → client: item use rejected (cooldown)
    BROKEN  = 'atc:item:broken',   -- server → plugins: item durability reached zero
}

-- ── Vitals ───────────────────────────────────────────────────────────────────
ATC.Events.VITALS = {
    REQUEST = 'atc:vitals:request',   -- client → server: request current vitals (read-only)
    UPDATE  = 'atc:vitals:update',    -- server → client: vitals data response
    CHANGED = 'atc:vitals:changed',   -- server → all plugins: vitals mutated
}

-- ── Status Effects ────────────────────────────────────────────────────────────
ATC.Events.STATUS = {
    REQUEST = 'atc:status:request',   -- client → server: request current status effects (read-only)
    UPDATE  = 'atc:status:update',    -- server → client: status effects data response
    CHANGED = 'atc:status:changed',   -- server → all plugins: status effects mutated
}

-- ── Locale ──────────────────────────────────────────────────────────────────
ATC.Events.LOCALE = {
    REQUEST = 'atc:locale:request',
    LOADED  = 'atc:locale:loaded',
}

-- ── Combat (client) ───────────────────────────────────────────────────────────
ATC.Events.COMBAT = {
    DAMAGE_REQUEST  = 'atc:combat:damage:request',
    DAMAGE_RESPONSE = 'atc:combat:damage:response',
    WEAPON_EQUIP    = 'atc:combat:weapon:equip:request',
    WEAPON_UNEQUIP  = 'atc:combat:weapon:unequip:request',
    PLAYER_DIED     = 'atc:combat:player:died',
    REVIVE          = 'atc:combat:revive',
    REVIVE_ATTEMPT  = 'atc:combat:revive:attempt',
}

-- ── Jobs ─────────────────────────────────────────────────────────────────────
ATC.Events.JOBS = {
    DUTY_TOGGLE    = 'atc:jobs:duty:toggle',
    DUTY_UPDATE    = 'atc:jobs:duty:update',
    JOB_CHANGED    = 'atc:jobs:job:changed',
    STATE_REQUEST  = 'atc:jobs:state:request',
    STATE_RESPONSE = 'atc:jobs:state:response',
}

-- ── Vehicles ─────────────────────────────────────────────────────────────────
ATC.Events.VEHICLE = {
    CLIENT_ENTERED = 'atc:vehicle:client:entered',
    CLIENT_EXITED  = 'atc:vehicle:client:exited',
    LOCK_REQUEST   = 'atc:vehicle:lock:request',
    LOCK_RESPONSE  = 'atc:vehicle:lock:response',
}

-- ── Dispatch ─────────────────────────────────────────────────────────────────
ATC.Events.DISPATCH = {
    CALL_RECEIVED = 'atc:dispatch:call:received',
    CALL_ACCEPTED = 'atc:dispatch:call:accepted',
}

-- ── HUD ──────────────────────────────────────────────────────────────────────
ATC.Events.HUD = {
    TOGGLE = 'atc:hud:toggle',
    SHOW   = 'atc:hud:show',
    HIDE   = 'atc:hud:hide',
}

-- ── Notification ─────────────────────────────────────────────────────────────
ATC.Events.NOTIFY = {
    SHOW = 'atc:notify:show',
}
