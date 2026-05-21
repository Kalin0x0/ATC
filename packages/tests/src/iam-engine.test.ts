import { describe, it, expect, vi } from 'vitest'
import { AtcAuthorizationEngine } from '@atc/iam'
import { BUILT_IN_ROLES } from '@atc/iam'
import type { AtcPrincipal } from '@atc/shared-types'

function makeEngine() {
  return new AtcAuthorizationEngine(BUILT_IN_ROLES)
}

function makePrincipal(overrides: Partial<AtcPrincipal> = {}): AtcPrincipal {
  return {
    id: 'user-1',
    type: 'account',
    roles: [],
    permissions: [],
    capabilities: [],
    denies: [],
    ...overrides,
  }
}

describe('AtcAuthorizationEngine — authorize()', () => {
  it('denies by default when principal has no permissions or roles', () => {
    const engine = makeEngine()
    const result = engine.authorize(makePrincipal(), 'player.read')
    expect(result.authorized).toBe(false)
    expect(result.principalId).toBe('user-1')
    expect(result.action).toBe('player.read')
  })

  it('grants when permission is directly on the principal', () => {
    const engine = makeEngine()
    const principal = makePrincipal({ permissions: ['player.read'] })
    const result = engine.authorize(principal, 'player.read')
    expect(result.authorized).toBe(true)
  })

  it('grants when permission comes from an assigned role', () => {
    const engine = makeEngine()
    const principal = makePrincipal({ roles: ['player'] })
    const result = engine.authorize(principal, 'player.read')
    expect(result.authorized).toBe(true)
    expect(result.matchedRole).toBe('player')
  })

  it('grants via role inheritance (moderator → support → player)', () => {
    const engine = makeEngine()
    const principal = makePrincipal({ roles: ['moderator'] })
    const result = engine.authorize(principal, 'player.read')
    expect(result.authorized).toBe(true)
  })

  it('super_admin is granted any permission (wildcard)', () => {
    const engine = makeEngine()
    const principal = makePrincipal({ roles: ['super_admin'] })
    expect(engine.authorize(principal, 'player.admin').authorized).toBe(true)
    expect(engine.authorize(principal, 'economy.admin').authorized).toBe(true)
    expect(engine.authorize(principal, 'territory.write').authorized).toBe(true)
  })

  it('explicit principal deny overrides everything (highest priority)', () => {
    const engine = makeEngine()
    // super_admin but also has an explicit deny
    const principal = makePrincipal({
      roles: ['super_admin'],
      denies: ['player.read'],
    })
    const result = engine.authorize(principal, 'player.read')
    expect(result.authorized).toBe(false)
    expect(result.denied).toBe(true)
  })

  it('plugin role has no permissions — denies non-empty permission', () => {
    const engine = makeEngine()
    const principal = makePrincipal({ roles: ['plugin'] })
    expect(engine.authorize(principal, 'player.read').authorized).toBe(false)
  })

  it('result contains principalId and action', () => {
    const engine = makeEngine()
    const principal = makePrincipal({ id: 'p-99' })
    const result = engine.authorize(principal, 'player.read')
    expect(result.principalId).toBe('p-99')
    expect(result.action).toBe('player.read')
  })

  it('increments telemetry for granted', () => {
    const telemetry = { increment: vi.fn() }
    const engine = new AtcAuthorizationEngine(BUILT_IN_ROLES, { telemetry })
    engine.authorize(makePrincipal({ permissions: ['player.read'] }), 'player.read')
    expect(telemetry.increment).toHaveBeenCalledWith('security.auth_granted_total')
  })

  it('increments telemetry for denied', () => {
    const telemetry = { increment: vi.fn() }
    const engine = new AtcAuthorizationEngine(BUILT_IN_ROLES, { telemetry })
    engine.authorize(makePrincipal(), 'player.read')
    expect(telemetry.increment).toHaveBeenCalledWith('security.auth_denied_total')
  })
})

describe('AtcAuthorizationEngine — authorizeCapability()', () => {
  it('grants when capability is directly on the principal', () => {
    const engine = makeEngine()
    const principal = makePrincipal({ capabilities: ['ops.read'] })
    const result = engine.authorizeCapability(principal, 'ops.read')
    expect(result.authorized).toBe(true)
  })

  it('grants when capability comes from an assigned role', () => {
    const engine = makeEngine()
    const principal = makePrincipal({ roles: ['moderator'] })
    const result = engine.authorizeCapability(principal, 'ops.read')
    expect(result.authorized).toBe(true)
    expect(result.matchedRole).toBe('moderator')
  })

  it('denies by default with no capabilities', () => {
    const engine = makeEngine()
    const principal = makePrincipal({ roles: ['player'] })
    const result = engine.authorizeCapability(principal, 'ops.write')
    expect(result.authorized).toBe(false)
  })

  it('restricted plugin trust level blocks capabilities not in the allowed list', () => {
    const engine = makeEngine()
    // ops.read is in the principal's capabilities, but trust level 'restricted' blocks it
    const principal = makePrincipal({
      type: 'plugin',
      trustLevel: 'restricted',
      capabilities: ['ops.read'],
    })
    expect(engine.authorizeCapability(principal, 'ops.read').authorized).toBe(false)
  })

  it('restricted plugin trust level permits telemetry.write when the principal has it', () => {
    const engine = makeEngine()
    const principal = makePrincipal({
      type: 'plugin',
      trustLevel: 'restricted',
      capabilities: ['telemetry.write'],
    })
    expect(engine.authorizeCapability(principal, 'telemetry.write').authorized).toBe(true)
  })

  it('internal plugin trust level permits all capabilities', () => {
    const engine = makeEngine()
    const principal = makePrincipal({
      type: 'plugin',
      trustLevel: 'internal',
      capabilities: ['admin.write'],
    })
    expect(engine.authorizeCapability(principal, 'admin.write').authorized).toBe(true)
  })

  it('trust level check sets denied=true on result', () => {
    const engine = makeEngine()
    const principal = makePrincipal({
      type: 'plugin',
      trustLevel: 'restricted',
      capabilities: ['ops.read'],
    })
    const result = engine.authorizeCapability(principal, 'ops.read')
    expect(result.denied).toBe(true)
  })

  it('increments capability_checks_total telemetry', () => {
    const telemetry = { increment: vi.fn() }
    const engine = new AtcAuthorizationEngine(BUILT_IN_ROLES, { telemetry })
    engine.authorizeCapability(makePrincipal({ capabilities: ['ops.read'] }), 'ops.read')
    expect(telemetry.increment).toHaveBeenCalledWith('security.capability_checks_total')
  })
})

describe('AtcAuthorizationEngine — resolvePermissions()', () => {
  it('returns empty set for principal with no roles or permissions', () => {
    const engine = makeEngine()
    const resolved = engine.resolvePermissions(makePrincipal())
    expect(resolved.size).toBe(0)
  })

  it('includes permissions from inherited roles', () => {
    const engine = makeEngine()
    const principal = makePrincipal({ roles: ['moderator'] })
    const resolved = engine.resolvePermissions(principal)
    expect(resolved.has('player.read')).toBe(true)
    expect(resolved.has('admin.kick')).toBe(true)
  })

  it('excludes explicitly denied permissions', () => {
    const engine = makeEngine()
    const principal = makePrincipal({
      roles: ['player'],
      denies: ['player.read'],
    })
    const resolved = engine.resolvePermissions(principal)
    expect(resolved.has('player.read')).toBe(false)
  })
})

describe('AtcAuthorizationEngine — resolveEffectiveRoles()', () => {
  it('returns empty array for a principal with no roles', () => {
    const engine = makeEngine()
    const roles = engine.resolveEffectiveRoles(makePrincipal())
    expect(roles).toHaveLength(0)
  })

  it('returns all roles in BFS order including inherited', () => {
    const engine = makeEngine()
    const principal = makePrincipal({ roles: ['moderator'] })
    const roles = engine.resolveEffectiveRoles(principal)
    const ids = roles.map((r) => r.id)
    expect(ids).toContain('moderator')
    expect(ids).toContain('support')
    expect(ids).toContain('player')
  })

  it('does not visit the same role twice (loop prevention)', () => {
    const engine = makeEngine()
    // admin inherits moderator+developer, both inherit player — player must appear once
    const principal = makePrincipal({ roles: ['admin'] })
    const roles = engine.resolveEffectiveRoles(principal)
    const playerRoles = roles.filter((r) => r.id === 'player')
    expect(playerRoles).toHaveLength(1)
  })
})

describe('AtcAuthorizationEngine — isSuperAdmin()', () => {
  it('returns true when super_admin role is assigned', () => {
    const engine = makeEngine()
    expect(engine.isSuperAdmin(makePrincipal({ roles: ['super_admin'] }))).toBe(true)
  })

  it('returns false for admin (not super)', () => {
    const engine = makeEngine()
    expect(engine.isSuperAdmin(makePrincipal({ roles: ['admin'] }))).toBe(false)
  })
})

describe('AtcAuthorizationEngine — isCapabilityAllowedForTrustLevel()', () => {
  it('allows telemetry.write for restricted trust level', () => {
    const engine = makeEngine()
    expect(engine.isCapabilityAllowedForTrustLevel('telemetry.write', 'restricted')).toBe(true)
  })

  it('disallows ops.read for restricted trust level', () => {
    const engine = makeEngine()
    expect(engine.isCapabilityAllowedForTrustLevel('ops.read', 'restricted')).toBe(false)
  })

  it('allows all capabilities for internal trust level', () => {
    const engine = makeEngine()
    expect(engine.isCapabilityAllowedForTrustLevel('admin.write', 'internal')).toBe(true)
    expect(engine.isCapabilityAllowedForTrustLevel('ops.write', 'internal')).toBe(true)
  })
})
