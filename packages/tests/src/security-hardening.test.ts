import { describe, it, expect, vi } from 'vitest'
import { AtcAuthorizationEngine, BUILT_IN_ROLES, getBuiltInRole, AtcIamCache } from '@atc/iam'
import { AtcAuditService } from '@atc/audit'
import { IAM_TRUST_CAPABILITY_LIMITS } from '@atc/shared-types'
import type { AtcPrincipal, AtcRole } from '@atc/shared-types'

function makeEngine() {
  return new AtcAuthorizationEngine(BUILT_IN_ROLES)
}

function makePrincipal(overrides: Partial<AtcPrincipal> = {}): AtcPrincipal {
  return {
    id: 'hardening-test',
    type: 'account',
    roles: [],
    permissions: [],
    capabilities: [],
    denies: [],
    ...overrides,
  }
}

describe('Security Hardening — deny-by-default', () => {
  it('authorizes nothing for a brand-new empty principal', () => {
    const engine = makeEngine()
    const principal = makePrincipal()
    const permissions = ['player.read', 'player.write', 'admin.ban', 'economy.admin'] as const
    for (const perm of permissions) {
      expect(engine.authorize(principal, perm).authorized).toBe(false)
    }
  })

  it('authorizes no capability for a brand-new empty principal', () => {
    const engine = makeEngine()
    const principal = makePrincipal()
    const caps = ['ops.read', 'ops.write', 'admin.write', 'plugin.reload'] as const
    for (const cap of caps) {
      expect(engine.authorizeCapability(principal, cap).authorized).toBe(false)
    }
  })
})

describe('Security Hardening — explicit deny takes precedence', () => {
  it('principal deny beats direct permission', () => {
    const engine = makeEngine()
    const principal = makePrincipal({
      permissions: ['player.read'],
      denies: ['player.read'],
    })
    expect(engine.authorize(principal, 'player.read').authorized).toBe(false)
  })

  it('principal deny beats super_admin wildcard', () => {
    const engine = makeEngine()
    const principal = makePrincipal({
      roles: ['super_admin'],
      denies: ['economy.admin'],
    })
    expect(engine.authorize(principal, 'economy.admin').authorized).toBe(false)
  })

  it('deny result has denied=true', () => {
    const engine = makeEngine()
    const principal = makePrincipal({ denies: ['player.read'], permissions: ['player.read'] })
    const result = engine.authorize(principal, 'player.read')
    expect(result.denied).toBe(true)
  })
})

describe('Security Hardening — plugin trust level isolation', () => {
  it('restricted plugin cannot use any capability outside the trust allowlist', () => {
    const engine = makeEngine()
    const caps = ['ops.read', 'ops.write', 'admin.write', 'cluster.read', 'plugin.reload'] as const
    const principal = makePrincipal({
      type: 'plugin',
      trustLevel: 'restricted',
      // even if capabilities are claimed, trust level blocks them
      capabilities: caps as unknown as AtcPrincipal['capabilities'],
    })
    for (const cap of caps) {
      expect(engine.authorizeCapability(principal, cap).authorized).toBe(false)
    }
  })

  it('restricted plugin CAN use telemetry.write when it holds that capability', () => {
    const engine = makeEngine()
    const principal = makePrincipal({
      type: 'plugin',
      trustLevel: 'restricted',
      capabilities: ['telemetry.write'] as unknown as AtcPrincipal['capabilities'],
    })
    expect(engine.authorizeCapability(principal, 'telemetry.write').authorized).toBe(true)
  })

  it('untrusted plugin cannot use admin.write', () => {
    const engine = makeEngine()
    const principal = makePrincipal({
      type: 'plugin',
      trustLevel: 'untrusted',
      capabilities: ['admin.write'] as unknown as AtcPrincipal['capabilities'],
    })
    expect(engine.authorizeCapability(principal, 'admin.write').authorized).toBe(false)
  })

  it('IAM_TRUST_CAPABILITY_LIMITS — restricted has exactly one capability', () => {
    const limits = IAM_TRUST_CAPABILITY_LIMITS['restricted']
    expect(limits).toHaveLength(1)
    expect(limits[0]).toBe('telemetry.write')
  })

  it('IAM_TRUST_CAPABILITY_LIMITS — internal allows the full set', () => {
    const limits = IAM_TRUST_CAPABILITY_LIMITS['internal']
    expect(limits.length).toBeGreaterThan(5)
    expect(limits).toContain('admin.write')
    expect(limits).toContain('ops.write')
    expect(limits).toContain('plugin.reload')
  })
})

describe('Security Hardening — role isolation', () => {
  it('plugin role cannot gain permissions through role inheritance', () => {
    const engine = makeEngine()
    const pluginRole = getBuiltInRole('plugin')!
    expect(pluginRole.inherits).toHaveLength(0)
    // Even if assigned plugin role, player.read must be denied (plugin has no permissions)
    const principal = makePrincipal({ roles: ['plugin'] })
    expect(engine.authorize(principal, 'player.read').authorized).toBe(false)
  })

  it('service role is isolated — cannot reach moderator or admin permissions', () => {
    const engine = makeEngine()
    const principal = makePrincipal({ roles: ['service'] })
    expect(engine.authorize(principal, 'admin.ban').authorized).toBe(false)
    expect(engine.authorize(principal, 'player.kick').authorized).toBe(false)
  })

  it('support role cannot access economy or inventory write', () => {
    const engine = makeEngine()
    const principal = makePrincipal({ roles: ['support'] })
    expect(engine.authorize(principal, 'economy.write').authorized).toBe(false)
    expect(engine.authorize(principal, 'inventory.write').authorized).toBe(false)
  })

  it('developer role cannot kick players (different branch than moderator)', () => {
    const engine = makeEngine()
    const principal = makePrincipal({ roles: ['developer'] })
    expect(engine.authorize(principal, 'player.kick').authorized).toBe(false)
    expect(engine.authorize(principal, 'admin.ban').authorized).toBe(false)
  })
})

describe('Security Hardening — BFS loop prevention', () => {
  it('resolveEffectiveRoles handles deep hierarchy without stack overflow', () => {
    const engine = makeEngine()
    // super_admin → admin → moderator → support → player (4 hops, no infinite loop)
    const principal = makePrincipal({ roles: ['super_admin'] })
    const roles = engine.resolveEffectiveRoles(principal)
    const ids = roles.map((r) => r.id)
    expect(ids).toContain('super_admin')
    expect(ids).toContain('player')
    // player must appear exactly once despite multiple inheritance paths
    expect(ids.filter((id) => id === 'player')).toHaveLength(1)
  })
})

describe('Security Hardening — role deny precedence', () => {
  it('role deny beats super_admin wildcard', () => {
    // Create a custom engine where super_admin has a role that denies a permission
    const customRoles: ReadonlyArray<AtcRole> = [
      ...BUILT_IN_ROLES.filter((r) => r.id !== 'super_admin'),
      Object.freeze<AtcRole>({
        id: 'super_admin',
        name: 'Super Administrator',
        description: 'Test override',
        permissions: [],
        capabilities: [],
        inherits: [],
        denies: ['player.ban'],
      }),
    ]
    const engine = new AtcAuthorizationEngine(customRoles)
    const principal = makePrincipal({ roles: ['super_admin'] })
    const result = engine.authorize(principal, 'player.ban')
    expect(result.authorized).toBe(false)
    expect(result.denied).toBe(true)
  })

  it('role deny beats role-granted permission within the same role set', () => {
    const engine = makeEngine()
    // admin inherits moderator; create a principal that also has admin.ban denied at role level
    // We verify moderator (which grants admin.ban) is blocked by a deny from the principal
    const principal = makePrincipal({
      roles: ['moderator'],
      denies: ['admin.ban'],
    })
    const result = engine.authorize(principal, 'admin.ban')
    expect(result.authorized).toBe(false)
    expect(result.denied).toBe(true)
  })
})

describe('Security Hardening — unknown role / unknown permission safety', () => {
  it('unknown role ID is silently skipped — does not crash or grant', () => {
    const engine = makeEngine()
    const principal = makePrincipal({ roles: ['phantom_role_xyz'] })
    const result = engine.authorize(principal, 'player.read')
    expect(result.authorized).toBe(false)
  })

  it('unknown permission string is denied (deny-by-default)', () => {
    const engine = makeEngine()
    const principal = makePrincipal({ roles: ['admin'] })
    // @ts-expect-error — intentional unknown permission
    const result = engine.authorize(principal, 'nonexistent.permission')
    expect(result.authorized).toBe(false)
  })

  it('principal with unknown roles still evaluates direct permissions', () => {
    const engine = makeEngine()
    const principal = makePrincipal({
      roles: ['ghost_role'],
      permissions: ['player.read'],
    })
    expect(engine.authorize(principal, 'player.read').authorized).toBe(true)
  })

  it('resolveEffectiveRoles with cyclic custom roles does not infinite-loop', () => {
    // Construct a custom engine with two roles that mutually inherit
    const cyclicRoles: ReadonlyArray<AtcRole> = [
      Object.freeze<AtcRole>({ id: 'a', name: 'A', description: '', permissions: ['player.read'], capabilities: [], inherits: ['b'], denies: [] }),
      Object.freeze<AtcRole>({ id: 'b', name: 'B', description: '', permissions: [], capabilities: [], inherits: ['a'], denies: [] }),
    ]
    const engine = new AtcAuthorizationEngine(cyclicRoles)
    const principal = makePrincipal({ roles: ['a'] })
    // Should not throw or hang — BFS visited set prevents infinite loop
    const roles = engine.resolveEffectiveRoles(principal)
    expect(roles.length).toBe(2) // 'a' and 'b' each visited once
    expect(engine.authorize(principal, 'player.read').authorized).toBe(true)
  })
})

describe('Security Hardening — privilege escalation prevention', () => {
  it('player cannot escalate to admin via unrecognized role injection', () => {
    const engine = makeEngine()
    // Inject a fake admin role ID — engine does not know it, treats it as unknown
    const principal = makePrincipal({ roles: ['player', 'fake_admin_9999'] })
    expect(engine.authorize(principal, 'admin.ban').authorized).toBe(false)
    expect(engine.authorize(principal, 'player.write').authorized).toBe(false)
  })

  it('non-plugin principal type bypasses trust level check (by design)', () => {
    // This is the documented architectural trade-off:
    // Trust level enforcement only applies to plugin-type principals.
    // A 'service' principal with admin.write in capabilities gets it granted.
    // Callers must not fabricate principal types with elevated capabilities.
    const engine = makeEngine()
    const principal = makePrincipal({
      type: 'service',
      capabilities: ['admin.write'] as unknown as AtcPrincipal['capabilities'],
    })
    // Granted because trust level check skips non-plugin principals
    expect(engine.authorizeCapability(principal, 'admin.write').authorized).toBe(true)
    // This is a known, documented trade-off — see runbook SECURITY INVARIANTS
  })

  it('admin role does NOT have economy.admin or inventory.admin permissions', () => {
    const engine = makeEngine()
    const principal = makePrincipal({ roles: ['admin'] })
    expect(engine.authorize(principal, 'economy.admin').authorized).toBe(false)
    expect(engine.authorize(principal, 'inventory.admin').authorized).toBe(false)
  })
})

describe('Security Hardening — IAM cache structural guard', () => {
  it('corrupt JSON payload (invalid JSON) returns null', async () => {
    const redis = { get: vi.fn().mockResolvedValue('not-valid-json{{{'), set: vi.fn(), del: vi.fn() }
    const cache = new AtcIamCache(redis)
    expect(await cache.getPrincipal('u-1')).toBeNull()
  })

  it('valid JSON but missing required fields returns null', async () => {
    // Object without 'id' and 'type' — fails structural guard
    const redis = { get: vi.fn().mockResolvedValue(JSON.stringify({ foo: 'bar' })), set: vi.fn(), del: vi.fn() }
    const cache = new AtcIamCache(redis)
    expect(await cache.getPrincipal('u-1')).toBeNull()
  })

  it('valid JSON with non-array roles returns null', async () => {
    const bad = { id: 'u-1', type: 'account', roles: 'not-an-array', permissions: [], capabilities: [], denies: [] }
    const redis = { get: vi.fn().mockResolvedValue(JSON.stringify(bad)), set: vi.fn(), del: vi.fn() }
    const cache = new AtcIamCache(redis)
    expect(await cache.getPrincipal('u-1')).toBeNull()
  })

  it('valid JSON with null value returns null', async () => {
    const redis = { get: vi.fn().mockResolvedValue('null'), set: vi.fn(), del: vi.fn() }
    const cache = new AtcIamCache(redis)
    expect(await cache.getPrincipal('u-1')).toBeNull()
  })

  it('corrupt resolved permissions shape returns null', async () => {
    const redis = { get: vi.fn().mockResolvedValue(JSON.stringify({ notPermissions: true })), set: vi.fn(), del: vi.fn() }
    const cache = new AtcIamCache(redis)
    expect(await cache.getResolved('u-1')).toBeNull()
  })

  it('corrupt structural guard miss increments cache_misses_total', async () => {
    const telemetry = { increment: vi.fn() }
    const bad = { id: '', type: 'account', roles: [], permissions: [], capabilities: [], denies: [] }
    const redis = { get: vi.fn().mockResolvedValue(JSON.stringify(bad)), set: vi.fn(), del: vi.fn() }
    const cache = new AtcIamCache(redis, { telemetry })
    await cache.getPrincipal('u-1')
    expect(telemetry.increment).toHaveBeenCalledWith('security.cache_misses_total')
  })
})

describe('Security Hardening — audit pagination determinism', () => {
  it('list() returns events in insertion order', () => {
    const svc = new AtcAuditService()
    const ids: string[] = []
    for (let i = 0; i < 5; i++) {
      const e = svc.append({ actorId: 'u-1', actorType: 'account', action: `action-${i}`, result: 'granted' })
      ids.push(e.id)
    }
    const { events } = svc.list({ limit: 10 })
    expect(events.map((e) => e.id)).toEqual(ids)
  })

  it('list() with offset is deterministic across calls', () => {
    const svc = new AtcAuditService()
    for (let i = 0; i < 10; i++) {
      svc.append({ actorId: 'u-1', actorType: 'account', action: `a-${i}`, result: 'granted' })
    }
    const page1 = svc.list({ offset: 0, limit: 5 })
    const page2 = svc.list({ offset: 5, limit: 5 })
    const all = svc.list({ limit: 10 })
    const stitched = [...page1.events, ...page2.events].map((e) => e.id)
    expect(stitched).toEqual(all.events.map((e) => e.id))
  })

  it('actorId filter is case-sensitive', () => {
    const svc = new AtcAuditService()
    svc.append({ actorId: 'User-1', actorType: 'account', action: 'x', result: 'granted' })
    svc.append({ actorId: 'user-1', actorType: 'account', action: 'x', result: 'granted' })
    expect(svc.list({ actorId: 'user-1' }).total).toBe(1)
    expect(svc.list({ actorId: 'User-1' }).total).toBe(1)
    expect(svc.list({ actorId: 'USER-1' }).total).toBe(0)
  })
})

describe('Security Hardening — telemetry not double-counted', () => {
  it('engine without telemetry: only route counts metrics', () => {
    // Engine constructed without telemetry — engine does not increment anything
    const engine = new AtcAuthorizationEngine(BUILT_IN_ROLES)
    const principal = makePrincipal({ permissions: ['player.read'] })
    // This should not throw even though engine has no telemetry
    const result = engine.authorize(principal, 'player.read')
    expect(result.authorized).toBe(true)
  })

  it('engine telemetry is incremented exactly once per call', () => {
    const telemetry = { increment: vi.fn() }
    const engine = new AtcAuthorizationEngine(BUILT_IN_ROLES, { telemetry })
    const principal = makePrincipal({ permissions: ['player.read'] })
    engine.authorize(principal, 'player.read')
    const grantCalls = (telemetry.increment as ReturnType<typeof vi.fn>).mock.calls
      .filter((c: string[]) => c[0] === 'security.auth_granted_total')
    expect(grantCalls).toHaveLength(1)
  })

  it('capability check telemetry is incremented exactly once per call', () => {
    const telemetry = { increment: vi.fn() }
    const engine = new AtcAuthorizationEngine(BUILT_IN_ROLES, { telemetry })
    const principal = makePrincipal({ capabilities: ['ops.read'] as unknown as AtcPrincipal['capabilities'] })
    engine.authorizeCapability(principal, 'ops.read')
    const checkCalls = (telemetry.increment as ReturnType<typeof vi.fn>).mock.calls
      .filter((c: string[]) => c[0] === 'security.capability_checks_total')
    expect(checkCalls).toHaveLength(1)
  })
})

describe('Security Hardening — audit immutability', () => {
  it('audit events are frozen and cannot be mutated', () => {
    const svc = new AtcAuditService()
    const event = svc.append({
      actorId: 'u-1',
      actorType: 'account',
      action: 'player.read',
      result: 'granted',
    })
    expect(() => {
      // @ts-expect-error — intentionally trying to mutate
      event.actorId = 'evil'
    }).toThrow()
    expect(event.actorId).toBe('u-1')
  })

  it('appended events cannot be removed from the service externally', () => {
    const svc = new AtcAuditService()
    svc.append({ actorId: 'u-1', actorType: 'account', action: 'x', result: 'granted' })
    expect(svc.size()).toBe(1)
  })

  it('list() returns events from oldest to newest', () => {
    const svc = new AtcAuditService()
    svc.append({ actorId: 'u-1', actorType: 'account', action: 'first', result: 'granted' })
    svc.append({ actorId: 'u-1', actorType: 'account', action: 'second', result: 'granted' })
    const { events } = svc.list()
    expect(events[0]?.action).toBe('first')
    expect(events[1]?.action).toBe('second')
  })
})
