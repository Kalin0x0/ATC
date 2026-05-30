fx_version 'cerulean'
game 'gta5'

name        'atc-ems'
description 'ATC EMS Medical Gameplay'
version     '0.1.0'
author      'Atlantic Core'

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
