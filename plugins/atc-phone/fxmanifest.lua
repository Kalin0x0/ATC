fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name        'atc-phone'
description 'ATC Phone Plugin — in-game smartphone: contacts, messages, bank, GPS, 911'
version     '0.1.0'
author      'Naiemi Group'
url         'https://github.com/Kalin0x0/ATC'

dependency 'atc-core'

server_scripts {
    'server/init.lua'
}

client_scripts {
    'client/init.lua'
}

ui_page 'ui/index.html'

files {
    'ui/**'
}
