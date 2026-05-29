fx_version 'cerulean'
game 'gta5'

name 'atc-core'
description 'ATC Core Resource — Atlantic Core Framework v0.1.0'
version '0.1.0'
author 'Atlantic Community'
url 'https://github.com/atlantic-community/atc'

lua54 'yes'

shared_scripts {
    'shared/config.lua',
    'shared/events.lua',
    'shared/locales.lua',
}

server_scripts {
    'server/logger.lua',
    'server/security.lua',
    'server/event_firewall.lua',
    'server/sessions.lua',
    'server/accounts.lua',
    'server/plugins.lua',
    'server/http.lua',
    'server/tasks.lua',
    'server/ops.lua',
    'server/telemetry.lua',
    'server/characters.lua',
    'server/economy.lua',
    'server/commerce.lua',
    'server/inventory.lua',
    'server/items_runtime.lua',
    'server/vitals.lua',
    'server/decay.lua',
    'server/status_effects.lua',
    'server/jobs.lua',
    'server/law.lua',
    'server/dispatch.lua',
    'server/medical.lua',
    'server/ems_runtime.lua',
    'server/vehicles.lua',
    'server/property.lua',
    'server/combat.lua',
    'server/criminal.lua',
    'server/world.lua',
    'server/vehicle_runtime.lua',
    'server/market.lua',
    'server/factions.lua',
    'server/housing.lua',
    'server/npc.lua',
    'server/city.lua',
    'server/survival.lua',
    'server/crafting.lua',
    'server/logistics.lua',
    'server/transport.lua',
    'server/comms.lua',
    'server/disaster.lua',
    'server/missions.lua',
    'server/reputation.lua',
    'server/ai_runtime.lua',
    'server/replication.lua',
    'server/reconciliation.lua',
    'server/world_orchestrator.lua',
    'server/combat_runtime.lua',
    'server/narrative.lua',
    'server/runtime_resilience.lua',
    'server/observability.lua',
    'server/cluster_runtime.lua',
    'server/persistence.lua',
    'server/federation.lua',
    'server/security_runtime.lua',
    'server/economy_regulation.lua',
    'server/governance.lua',
    'server/ecology.lua',
    'server/meta_runtime.lua',
    'server/runtime_protocol.lua',
    'server/evolution.lua',
    'server/world_integrity.lua',
    'server/global_governance.lua',
    'server/continuity.lua',
    'server/lockdown.lua',
    'server/runtime_certification.lua',
    'server/runtime_sovereignty.lua',
    'server/core_finalization.lua',
    'server/runtime_gateway.lua',
    'server/runtime_hardening.lua',
    'server/runtime_sustainment.lua',
    'server/developer_platform.lua',
    'server/release_governance.lua',
    'server/enterprise_readiness.lua',
    'server/core_closure.lua',
    'server/main.lua',
}

client_scripts {
    'client/locale.lua',
    'client/sdk.lua',
    'client/characters.lua',
    'client/economy.lua',
    'client/vitals.lua',
    'client/status_effects.lua',
    'client/inventory.lua',
    'client/combat.lua',
    'client/vehicles.lua',
    'client/jobs.lua',
    'client/hud.lua',
    'client/main.lua',
}

ui_page 'ui/index.html'

files {
    'ui/index.html',
    'ui/css/*.css',
    'ui/js/*.js',
}
