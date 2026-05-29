fx_version 'cerulean'
game 'gta5'

name 'atc-identity'
description 'ATC Identity — Character creation and customization'
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
    'ui/**',
}
