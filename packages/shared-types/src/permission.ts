export type AtcPermissionDomain =
  | 'player'
  | 'inventory'
  | 'economy'
  | 'territory'
  | 'housing'
  | 'vehicle'
  | 'social'
  | 'dispatch'
  | 'admin'

export type AtcPermissionAction =
  | 'read'
  | 'write'
  | 'admin'
  | 'spectate'
  | 'ban'
  | 'kick'
  | 'warn'
  | 'freeze'
  | 'teleport'
  | 'noclip'
  | 'god'
  | 'audit'
  | 'evidence'

export type AtcPermission = `${AtcPermissionDomain}.${AtcPermissionAction}`

export type AtcAdminLevel = 0 | 1 | 2 | 3 | 4 | 5

export interface AtcAdminIdentity {
  id: string
  accountId: string
  level: AtcAdminLevel
  permissions: AtcPermission[]
  grantedBy: string | null
  grantedAt: Date
  isActive: boolean
}

export const ATC_ADMIN_LEVEL_PERMISSIONS: Record<AtcAdminLevel, AtcPermission[]> = {
  0: [],
  1: ['player.read', 'admin.spectate', 'admin.teleport'],
  2: ['player.read', 'player.kick', 'admin.spectate', 'admin.teleport', 'admin.freeze', 'admin.warn', 'admin.kick', 'admin.ban'],
  3: ['player.read', 'player.write', 'player.kick', 'economy.read', 'inventory.read', 'admin.spectate', 'admin.teleport', 'admin.freeze', 'admin.warn', 'admin.kick', 'admin.ban', 'admin.noclip', 'admin.god', 'admin.evidence', 'admin.audit'],
  4: ['player.read', 'player.write', 'player.kick', 'player.ban', 'economy.read', 'economy.write', 'economy.admin', 'inventory.read', 'inventory.write', 'admin.spectate', 'admin.teleport', 'admin.freeze', 'admin.warn', 'admin.kick', 'admin.ban', 'admin.noclip', 'admin.god', 'admin.evidence', 'admin.audit'],
  5: ['player.read', 'player.write', 'player.kick', 'player.ban', 'player.admin', 'economy.read', 'economy.write', 'economy.admin', 'inventory.read', 'inventory.write', 'inventory.admin', 'territory.read', 'territory.write', 'housing.read', 'vehicle.read', 'social.read', 'admin.spectate', 'admin.teleport', 'admin.freeze', 'admin.warn', 'admin.kick', 'admin.ban', 'admin.noclip', 'admin.god', 'admin.evidence', 'admin.audit'],
}

export function hasPermission(granted: AtcPermission[], required: AtcPermission): boolean {
  return granted.includes(required)
}
