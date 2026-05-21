import type { AtcRole, AtcPermission, AtcPluginCapability } from '@atc/shared-types'

/**
 * Immutable built-in role definitions.
 *
 * Inheritance hierarchy:
 *   super_admin → admin → moderator → support → player
 *   admin → developer
 *   plugin: isolated (no inheritance)
 *   service: isolated (no inheritance)
 *
 * Explicit deny overrides all allows at every level.
 */

const PLAYER_PERMISSIONS: ReadonlyArray<AtcPermission> = [
  'player.read',
]

const SUPPORT_PERMISSIONS: ReadonlyArray<AtcPermission> = [
  ...PLAYER_PERMISSIONS,
  'admin.spectate',
  'admin.teleport',
]

const MODERATOR_PERMISSIONS: ReadonlyArray<AtcPermission> = [
  ...SUPPORT_PERMISSIONS,
  'player.kick',
  'admin.freeze',
  'admin.warn',
  'admin.kick',
  'admin.ban',
]

const DEVELOPER_PERMISSIONS: ReadonlyArray<AtcPermission> = [
  ...PLAYER_PERMISSIONS,
  'admin.read',
  'admin.noclip',
  'admin.god',
]

const ADMIN_PERMISSIONS: ReadonlyArray<AtcPermission> = [
  ...MODERATOR_PERMISSIONS,
  'player.write',
  'player.ban',
  'economy.read',
  'economy.write',
  'inventory.read',
  'inventory.write',
  'admin.noclip',
  'admin.god',
  'admin.evidence',
  'admin.audit',
]

const SUPER_ADMIN_PERMISSIONS: ReadonlyArray<AtcPermission> = [
  ...ADMIN_PERMISSIONS,
  'player.admin',
  'economy.admin',
  'inventory.admin',
  'territory.read',
  'territory.write',
  'housing.read',
  'vehicle.read',
  'social.read',
]

const ADMIN_CAPABILITIES: ReadonlyArray<AtcPluginCapability> = [
  'ops.read',
  'ops.write',
  'cluster.read',
  'cluster.write',
  'plugin.reload',
]

const SUPER_ADMIN_CAPABILITIES: ReadonlyArray<AtcPluginCapability> = [
  ...ADMIN_CAPABILITIES,
  'admin.read',
  'admin.write',
]

export const BUILT_IN_ROLES: ReadonlyArray<AtcRole> = Object.freeze([
  Object.freeze<AtcRole>({
    id: 'super_admin',
    name: 'Super Administrator',
    description: 'Full unrestricted access to all systems and operations',
    permissions: SUPER_ADMIN_PERMISSIONS,
    capabilities: SUPER_ADMIN_CAPABILITIES,
    inherits: ['admin'],
    denies: [],
  }),
  Object.freeze<AtcRole>({
    id: 'admin',
    name: 'Administrator',
    description: 'Full player management, economy, inventory, and ops access',
    permissions: ADMIN_PERMISSIONS,
    capabilities: ADMIN_CAPABILITIES,
    inherits: ['moderator', 'developer'],
    denies: [],
  }),
  Object.freeze<AtcRole>({
    id: 'moderator',
    name: 'Moderator',
    description: 'Player moderation — kick, ban, freeze, warn, spectate',
    permissions: MODERATOR_PERMISSIONS,
    capabilities: ['ops.read', 'cluster.read'],
    inherits: ['support'],
    denies: [],
  }),
  Object.freeze<AtcRole>({
    id: 'developer',
    name: 'Developer',
    description: 'Developer access — god mode, noclip, admin read, ops read',
    permissions: DEVELOPER_PERMISSIONS,
    capabilities: ['ops.read', 'cluster.read', 'ops.write'],
    inherits: ['player'],
    denies: [],
  }),
  Object.freeze<AtcRole>({
    id: 'support',
    name: 'Support',
    description: 'Read-only player access plus spectate and teleport',
    permissions: SUPPORT_PERMISSIONS,
    capabilities: ['ops.read'],
    inherits: ['player'],
    denies: [],
  }),
  Object.freeze<AtcRole>({
    id: 'player',
    name: 'Player',
    description: 'Default player role — read own data only',
    permissions: PLAYER_PERMISSIONS,
    capabilities: [],
    inherits: [],
    denies: [],
  }),
  Object.freeze<AtcRole>({
    id: 'plugin',
    name: 'Plugin',
    description: 'Plugin service account — isolated, capabilities determined by manifest',
    permissions: [],
    capabilities: [],
    inherits: [],
    denies: [],
  }),
  Object.freeze<AtcRole>({
    id: 'service',
    name: 'Service',
    description: 'Internal service account — isolated, access determined by service type',
    permissions: ['player.read'],
    capabilities: ['ops.read', 'cluster.read'],
    inherits: [],
    denies: [],
  }),
])

export function getBuiltInRole(id: string): AtcRole | undefined {
  return BUILT_IN_ROLES.find((r) => r.id === id)
}

export function isBuiltInRole(id: string): boolean {
  return BUILT_IN_ROLES.some((r) => r.id === id)
}
