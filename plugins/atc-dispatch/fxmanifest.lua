fx_version 'cerulean'
game 'gta5'

name 'atc-dispatch'
description 'ATC Dispatch Plugin — 911 calls, internal dispatch routing, LEO notifications'
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
