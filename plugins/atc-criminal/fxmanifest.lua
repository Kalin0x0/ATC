fx_version 'cerulean'
game 'gta5'

name        'atc-criminal'
description 'ATC Criminal Gameplay — Robberies, Drugs, Territory'
version     '0.1.0'
author      'Naiemi Group'
url         'https://github.com/Kalin0x0/ATC'

lua54 'yes'

dependency 'atc-core'

ui_page 'ui/index.html'

files {
    'ui/index.html',
}

server_scripts {
    'server/init.lua'
}

client_scripts {
    'client/init.lua'
}
