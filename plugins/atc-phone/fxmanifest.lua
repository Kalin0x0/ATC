fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name    'atc-phone'
version '0.1.0'

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
