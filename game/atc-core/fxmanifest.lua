fx_version 'cerulean'
game 'gta5'

name 'atc-core'
description 'ATC Core Resource — Atlantic Core Framework v0.1.0'
version '0.1.0'
author 'Atlantic Community'
url 'https://github.com/atlantic-community/atc'

lua54 'yes'

shared_scripts {
    'shared/config.lua',
    'shared/events.lua',
    'shared/locales.lua',
}

server_scripts {
    'server/logger.lua',
    'server/security.lua',
    'server/event_firewall.lua',
    'server/sessions.lua',
    'server/plugins.lua',
    'server/http.lua',
    'server/tasks.lua',
    'server/ops.lua',
    'server/telemetry.lua',
    'server/characters.lua',
    'server/economy.lua',
    'server/commerce.lua',
    'server/inventory.lua',
    'server/items_runtime.lua',
    'server/vitals.lua',
    'server/decay.lua',
    'server/status_effects.lua',
    'server/jobs.lua',
    'server/law.lua',
    'server/dispatch.lua',
    'server/medical.lua',
    'server/ems_runtime.lua',
    'server/vehicles.lua',
    'server/property.lua',
    'server/combat.lua',
    'server/criminal.lua',
    'server/world.lua',
    'server/vehicle_runtime.lua',
    'server/market.lua',
    'server/factions.lua',
    'server/main.lua',
}

client_scripts {
    'client/locale.lua',
    'client/main.lua',
}
