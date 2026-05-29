fx_version 'cerulean'
game 'gta5'

name 'atc-vehicles'
description 'ATC Vehicles Plugin — Garage management, vehicle spawning and impound'
version '1.0.0'
author 'Atlantic Community'

lua54 'yes'

dependency 'atc-core'

shared_scripts {
    'shared/config.lua',
}

server_scripts {
    'server/init.lua',
}

client_scripts {
    'client/init.lua',
}
