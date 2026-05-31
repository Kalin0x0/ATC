fx_version 'cerulean'
game 'gta5'

name 'atc-combat'
description 'ATC Combat Plugin — death, revive, respawn, EMS dispatch bridge'
version '1.0.0'
author 'Atlantic Community'

lua54 'yes'

dependency 'atc-core'

ui_page 'ui/index.html'

files {
    'ui/index.html',
}

server_scripts {
    'server/init.lua',
}

client_scripts {
    'client/init.lua',
}
