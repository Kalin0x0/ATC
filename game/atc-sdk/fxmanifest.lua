fx_version 'cerulean'
game 'gta5'

name 'atc-sdk'
description 'ATC SDK — public API for external plugins'
version '0.1.0'
author 'Naiemi Group'
url 'https://github.com/Kalin0x0/ATC'

lua54 'yes'

dependency 'atc-core'

-- Every FiveM resource has its own Lua state, so atc-core's ATC table is not
-- visible here just because atc-core is a dependency — 'dependency' only orders
-- startup. The '@atc-core/...' entries below load those files into this
-- resource's state, which is correct for the stateless ones listed here:
-- config and events are constants, and logger and http are pure wrappers, so a
-- second instance behaves identically to atc-core's.
--
-- Stateful modules are deliberately NOT included. A copy of sessions.lua would
-- carry an empty _sessions table and answer nil for every connected player,
-- which is worse than failing loudly. Those are read through atc-core's
-- exports instead (see server/sdk.lua and client/sdk.lua).
--
-- ATC.HTTP has to be included rather than exported: a FiveM export cannot carry
-- a Lua callback across the resource boundary, and every HTTP helper takes one.

shared_scripts {
    '@atc-core/shared/config.lua',
    '@atc-core/shared/events.lua',
    'shared/sdk.lua',
}

server_scripts {
    '@atc-core/server/logger.lua',
    '@atc-core/server/http.lua',
    'server/sdk.lua',
    'server/exports.lua',
}

client_scripts {
    'client/sdk.lua',
    'client/exports.lua',
}
