fx_version 'cerulean'
game 'gta5'

name 'atc-housing'
description 'ATC Housing Plugin — Property ownership, access control and lock management'
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
