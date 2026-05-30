fx_version 'cerulean'
game 'gta5'

name 'atc-admin'
description 'ATC Admin Plugin — in-game admin commands: kick, ban, bring, goto, freeze, spectate'
version '1.0.0'
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
}
