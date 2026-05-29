fx_version 'cerulean'
game 'gta5'

name 'atc-bridge-esx'
description 'ESX → ATC compatibility bridge'
version '0.1.0'
author 'Atlantic Community'

lua54 'yes'

dependencies {
    'es_extended',
    'atc-core',
}

server_scripts {
    'server/init.lua',
}

client_scripts {
    'client/init.lua',
}
