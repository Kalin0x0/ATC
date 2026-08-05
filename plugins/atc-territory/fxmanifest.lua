fx_version 'cerulean'
game 'gta5'

name 'atc-territory'
description 'ATC Territory Plugin — faction zone control, capture and broadcast'
version '1.0.0'
author 'Naiemi Group'
url 'https://github.com/Kalin0x0/ATC'

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
