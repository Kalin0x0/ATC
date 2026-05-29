fx_version 'cerulean'
game 'gta5'

name 'atc-bridge-qb'
description 'QB-Core → ATC compatibility bridge'
version '0.1.0'
author 'Atlantic Community'

lua54 'yes'

dependencies {
    'qb-core',
    'atc-core',
}

server_scripts {
    'server/init.lua',
}

client_scripts {
    'client/init.lua',
}
