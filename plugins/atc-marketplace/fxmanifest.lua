fx_version 'cerulean'
game 'gta5'

name 'atc-marketplace'
description 'ATC Marketplace - Player-to-player trading (Phase 95)'
version '0.1.0'
author 'Atlantic Community'

lua54 'yes'

dependency 'atc-core'

server_scripts {
    'server/init.lua',
}

client_scripts {
    'client/init.lua',
}

ui_page 'ui/index.html'

files {
    'ui/index.html',
    'ui/css/*.css',
    'ui/js/*.js',
}
