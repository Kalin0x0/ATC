fx_version 'cerulean'
game 'gta5'

name 'atc-sdk'
description 'ATC SDK — public API for external plugins'
version '0.1.0'
author 'Atlantic Community'

lua54 'yes'

dependency 'atc-core'

shared_scripts {
    'shared/sdk.lua',
}

server_scripts {
    'server/sdk.lua',
    'server/exports.lua',
}

client_scripts {
    'client/sdk.lua',
    'client/exports.lua',
}
