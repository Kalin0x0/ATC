fx_version 'cerulean'
game      'gta5'
lua54     'yes'

name        'atc-example-shop'
description 'ATC Example Shop — reference plugin demonstrating ATC SDK usage'
version     '0.1.0'
author      'Atlantic Community'

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
