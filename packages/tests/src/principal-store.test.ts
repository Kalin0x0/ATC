import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  PrincipalRepository,
  RoleAssignmentRepository,
  PrincipalCapabilityRepository,
  SecurityEventRepository,
} from '@atc/principal-store'
import type { PrincipalStorePool } from '@atc/principal-store'

// ── Mock pool factory ─────────────────────────────────────────────────────────

type MockConn = {
  execute: ReturnType<typeof vi.fn>
  release: ReturnType<typeof vi.fn>
}

function makePool(conn: Partial<MockConn> = {}): PrincipalStorePool {
  const mockConn: MockConn = {
    execute: conn.execute ?? vi.fn().mockResolvedValue([[],{}]),
    release: conn.release ?? vi.fn(),
  }
  return {
    getConnection: vi.fn().mockResolvedValue(mockConn),
  } as unknown as PrincipalStorePool
}

// A valid stored principal row
const PRINCIPAL_ROW = {
  id: 'p-01HZ9XVFG3QKJM5N8P2R4T6WYZ',
  principal_type: 'account',
  status: 'active',
  display_name: 'Alice',
  account_id: 'a-01HZ9XVFG3QKJM5N8P2R4T6WYZ',
  trust_level: null,
  direct_permissions: '[]',
  direct_denies: '[]',
  metadata: null,
  created_at: new Date('2025-01-01'),
  updated_at: new Date('2025-01-01'),
}

// ── PrincipalRepository ───────────────────────────────────────────────────────

describe('PrincipalRepository — create()', () => {
  it('inserts a principal and returns it', async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce([[], {}])                  // INSERT
      .mockResolvedValueOnce([[PRINCIPAL_ROW], {}])     // SELECT after insert
    const repo = new PrincipalRepository(makePool({ execute }))
    const result = await repo.create({ type: 'account', displayName: 'Alice' })
    expect(result.type).toBe('account')
    expect(result.displayName).toBe('Alice')
    expect(result.status).toBe('active')
  })

  it('increments iam.principal_created_total telemetry', async () => {
    const telemetry = { increment: vi.fn() }
    const execute = vi.fn()
      .mockResolvedValueOnce([[], {}])
      .mockResolvedValueOnce([[PRINCIPAL_ROW], {}])
    const repo = new PrincipalRepository(makePool({ execute }), telemetry)
    await repo.create({ type: 'account', displayName: 'Alice' })
    expect(telemetry.increment).toHaveBeenCalledWith('iam.principal_created_total')
  })

  it('sets trust_level for plugin principals', async () => {
    let capturedArgs: unknown[] = []
    const execute = vi.fn()
      .mockImplementationOnce((_sql: unknown, args: unknown[]) => { capturedArgs = args; return [[], {}] })
      .mockResolvedValueOnce([[{ ...PRINCIPAL_ROW, principal_type: 'plugin', trust_level: 'trusted' }], {}])
    const repo = new PrincipalRepository(makePool({ execute }))
    const result = await repo.create({ type: 'plugin', displayName: 'MyPlugin', trustLevel: 'trusted' })
    expect(capturedArgs[4]).toBe('trusted')
    expect(result.type).toBe('plugin')
  })
})

describe('PrincipalRepository — findById()', () => {
  it('returns null when principal not found', async () => {
    const execute = vi.fn().mockResolvedValue([[], {}])
    const repo = new PrincipalRepository(makePool({ execute }))
    expect(await repo.findById('missing')).toBeNull()
  })

  it('returns the parsed principal when found', async () => {
    const execute = vi.fn().mockResolvedValue([[PRINCIPAL_ROW], {}])
    const repo = new PrincipalRepository(makePool({ execute }))
    const result = await repo.findById(PRINCIPAL_ROW.id)
    expect(result?.id).toBe(PRINCIPAL_ROW.id)
    expect(result?.displayName).toBe('Alice')
    expect(result?.directPermissions).toEqual([])
    expect(result?.directDenies).toEqual([])
  })
})

describe('PrincipalRepository — disable()', () => {
  it('returns true when principal was disabled', async () => {
    const execute = vi.fn().mockResolvedValue([{ affectedRows: 1 }])
    const repo = new PrincipalRepository(makePool({ execute }))
    expect(await repo.disable('p-1')).toBe(true)
  })

  it('returns false when principal was already disabled', async () => {
    const execute = vi.fn().mockResolvedValue([{ affectedRows: 0 }])
    const repo = new PrincipalRepository(makePool({ execute }))
    expect(await repo.disable('p-1')).toBe(false)
  })

  it('increments iam.principal_disabled_total only on success', async () => {
    const telemetry = { increment: vi.fn() }
    const execute = vi.fn().mockResolvedValue([{ affectedRows: 1 }])
    const repo = new PrincipalRepository(makePool({ execute }), telemetry)
    await repo.disable('p-1')
    expect(telemetry.increment).toHaveBeenCalledWith('iam.principal_disabled_total')
  })
})

describe('PrincipalRepository — resolve()', () => {
  it('returns null for disabled principals', async () => {
    const execute = vi.fn().mockResolvedValue([[{ ...PRINCIPAL_ROW, status: 'disabled' }], {}])
    const repo = new PrincipalRepository(makePool({ execute }))
    expect(await repo.resolve('p-1')).toBeNull()
  })

  it('returns null when principal does not exist', async () => {
    const execute = vi.fn().mockResolvedValue([[], {}])
    const repo = new PrincipalRepository(makePool({ execute }))
    expect(await repo.resolve('missing')).toBeNull()
  })

  it('assembles AtcPrincipal from stored record + assignments', async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce([[PRINCIPAL_ROW], {}])             // SELECT principal
      .mockResolvedValueOnce([[{ role_id: 'player' }], {}])     // SELECT roles
      .mockResolvedValueOnce([[{ capability: 'ops.read' }], {}]) // SELECT capabilities
    const repo = new PrincipalRepository(makePool({ execute }))
    const principal = await repo.resolve(PRINCIPAL_ROW.id)
    expect(principal).not.toBeNull()
    expect(principal?.id).toBe(PRINCIPAL_ROW.id)
    expect(principal?.type).toBe('account')
    expect(principal?.roles).toEqual(['player'])
    expect(principal?.capabilities).toContain('ops.read')
    expect(principal?.permissions).toEqual([])
    expect(principal?.denies).toEqual([])
  })

  it('increments iam.principal_resolved_total telemetry', async () => {
    const telemetry = { increment: vi.fn() }
    const execute = vi.fn()
      .mockResolvedValueOnce([[PRINCIPAL_ROW], {}])
      .mockResolvedValueOnce([[], {}])
      .mockResolvedValueOnce([[], {}])
    const repo = new PrincipalRepository(makePool({ execute }), telemetry)
    await repo.resolve(PRINCIPAL_ROW.id)
    expect(telemetry.increment).toHaveBeenCalledWith('iam.principal_resolved_total')
  })
})

describe('PrincipalRepository — list()', () => {
  it('returns empty page when no principals found', async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce([[{ total: 0 }], {}])  // COUNT
      .mockResolvedValueOnce([[], {}])               // SELECT
    const repo = new PrincipalRepository(makePool({ execute }))
    const page = await repo.list()
    expect(page.items).toHaveLength(0)
    expect(page.total).toBe(0)
  })

  it('applies default limit=20 and offset=0', async () => {
    let capturedSql = ''
    const execute = vi.fn()
      .mockResolvedValueOnce([[{ total: 0 }], {}])
      .mockImplementationOnce((sql: unknown) => { capturedSql = String(sql); return [[], {}] })
    const repo = new PrincipalRepository(makePool({ execute }))
    await repo.list()
    expect(capturedSql).toContain('LIMIT')
  })
})

// ── RoleAssignmentRepository ──────────────────────────────────────────────────

const ROLE_ROW = {
  id: 'ra-01',
  principal_id: 'p-1',
  role_id: 'moderator',
  assigned_by: 'admin-1',
  assigned_at: new Date(),
  expires_at: null,
}

describe('RoleAssignmentRepository — assign()', () => {
  it('inserts and returns the assignment', async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce([{ affectedRows: 1 }, {}])  // INSERT IGNORE
      .mockResolvedValueOnce([[ROLE_ROW], {}])            // SELECT after
    const repo = new RoleAssignmentRepository(makePool({ execute }))
    const result = await repo.assign({ principalId: 'p-1', roleId: 'moderator', assignedBy: 'admin-1' })
    expect(result.roleId).toBe('moderator')
    expect(result.principalId).toBe('p-1')
  })

  it('increments iam.role_assigned_total', async () => {
    const telemetry = { increment: vi.fn() }
    const execute = vi.fn()
      .mockResolvedValueOnce([{}, {}])
      .mockResolvedValueOnce([[ROLE_ROW], {}])
    const repo = new RoleAssignmentRepository(makePool({ execute }), telemetry)
    await repo.assign({ principalId: 'p-1', roleId: 'moderator', assignedBy: 'admin-1' })
    expect(telemetry.increment).toHaveBeenCalledWith('iam.role_assigned_total')
  })
})

describe('RoleAssignmentRepository — revoke()', () => {
  it('returns true when assignment deleted', async () => {
    const execute = vi.fn().mockResolvedValue([{ affectedRows: 1 }])
    const repo = new RoleAssignmentRepository(makePool({ execute }))
    expect(await repo.revoke('p-1', 'moderator')).toBe(true)
  })

  it('returns false when assignment not found', async () => {
    const execute = vi.fn().mockResolvedValue([{ affectedRows: 0 }])
    const repo = new RoleAssignmentRepository(makePool({ execute }))
    expect(await repo.revoke('p-1', 'nonexistent')).toBe(false)
  })

  it('increments iam.role_revoked_total only on success', async () => {
    const telemetry = { increment: vi.fn() }
    const execute = vi.fn().mockResolvedValue([{ affectedRows: 1 }])
    const repo = new RoleAssignmentRepository(makePool({ execute }), telemetry)
    await repo.revoke('p-1', 'player')
    expect(telemetry.increment).toHaveBeenCalledWith('iam.role_revoked_total')
  })
})

describe('RoleAssignmentRepository — listByPrincipal()', () => {
  it('returns empty array when no assignments', async () => {
    const execute = vi.fn().mockResolvedValue([[], {}])
    const repo = new RoleAssignmentRepository(makePool({ execute }))
    expect(await repo.listByPrincipal('p-1')).toHaveLength(0)
  })

  it('maps rows to RoleAssignment objects', async () => {
    const execute = vi.fn().mockResolvedValue([[ROLE_ROW], {}])
    const repo = new RoleAssignmentRepository(makePool({ execute }))
    const result = await repo.listByPrincipal('p-1')
    expect(result[0]?.roleId).toBe('moderator')
    expect(result[0]?.expiresAt).toBeNull()
  })
})

// ── PrincipalCapabilityRepository ────────────────────────────────────────────

const CAP_ROW = {
  id: 'ca-01',
  principal_id: 'p-1',
  capability: 'ops.read',
  granted_by: 'admin-1',
  granted_at: new Date(),
  expires_at: null,
}

describe('PrincipalCapabilityRepository — grant()', () => {
  it('inserts and returns the assignment', async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce([{}, {}])         // INSERT IGNORE
      .mockResolvedValueOnce([[CAP_ROW], {}])   // SELECT
    const repo = new PrincipalCapabilityRepository(makePool({ execute }))
    const result = await repo.grant({ principalId: 'p-1', capability: 'ops.read', grantedBy: 'admin-1' })
    expect(result.capability).toBe('ops.read')
  })

  it('increments iam.capability_granted_total', async () => {
    const telemetry = { increment: vi.fn() }
    const execute = vi.fn()
      .mockResolvedValueOnce([{}, {}])
      .mockResolvedValueOnce([[CAP_ROW], {}])
    const repo = new PrincipalCapabilityRepository(makePool({ execute }), telemetry)
    await repo.grant({ principalId: 'p-1', capability: 'ops.read', grantedBy: 'admin-1' })
    expect(telemetry.increment).toHaveBeenCalledWith('iam.capability_granted_total')
  })
})

describe('PrincipalCapabilityRepository — revoke()', () => {
  it('returns true when capability revoked', async () => {
    const execute = vi.fn().mockResolvedValue([{ affectedRows: 1 }])
    const repo = new PrincipalCapabilityRepository(makePool({ execute }))
    expect(await repo.revoke('p-1', 'ops.read')).toBe(true)
  })

  it('returns false when capability not found', async () => {
    const execute = vi.fn().mockResolvedValue([{ affectedRows: 0 }])
    const repo = new PrincipalCapabilityRepository(makePool({ execute }))
    expect(await repo.revoke('p-1', 'ops.write')).toBe(false)
  })

  it('increments iam.capability_revoked_total only on success', async () => {
    const telemetry = { increment: vi.fn() }
    const execute = vi.fn().mockResolvedValue([{ affectedRows: 1 }])
    const repo = new PrincipalCapabilityRepository(makePool({ execute }), telemetry)
    await repo.revoke('p-1', 'ops.read')
    expect(telemetry.increment).toHaveBeenCalledWith('iam.capability_revoked_total')
  })
})

describe('PrincipalCapabilityRepository — has()', () => {
  it('returns true when capability exists and is not expired', async () => {
    const execute = vi.fn().mockResolvedValue([[{ cnt: 1 }], {}])
    const repo = new PrincipalCapabilityRepository(makePool({ execute }))
    expect(await repo.has('p-1', 'ops.read')).toBe(true)
  })

  it('returns false when capability does not exist', async () => {
    const execute = vi.fn().mockResolvedValue([[{ cnt: 0 }], {}])
    const repo = new PrincipalCapabilityRepository(makePool({ execute }))
    expect(await repo.has('p-1', 'ops.write')).toBe(false)
  })
})

// ── SecurityEventRepository ───────────────────────────────────────────────────

const SEC_EVENT_ROW = {
  id: 'se-01',
  actor_id: 'u-1',
  actor_type: 'account',
  action: 'player.ban',
  target: 'u-2',
  result: 'granted',
  source_instance_id: null,
  event_metadata: null,
  created_at: new Date(),
}

describe('SecurityEventRepository — append()', () => {
  it('inserts and returns the security event', async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce([{}, {}])                    // INSERT
      .mockResolvedValueOnce([[SEC_EVENT_ROW], {}])        // SELECT
    const repo = new SecurityEventRepository(makePool({ execute }))
    const result = await repo.append({
      actorId: 'u-1', actorType: 'account', action: 'player.ban', target: 'u-2', result: 'granted',
    })
    expect(result.actorId).toBe('u-1')
    expect(result.action).toBe('player.ban')
    expect(result.result).toBe('granted')
  })

  it('increments security.audit_events_total telemetry', async () => {
    const telemetry = { increment: vi.fn() }
    const execute = vi.fn()
      .mockResolvedValueOnce([{}, {}])
      .mockResolvedValueOnce([[SEC_EVENT_ROW], {}])
    const repo = new SecurityEventRepository(makePool({ execute }), telemetry)
    await repo.append({ actorId: 'u-1', actorType: 'account', action: 'test', result: 'granted' })
    expect(telemetry.increment).toHaveBeenCalledWith('security.audit_events_total')
  })

  it('handles null metadata correctly', async () => {
    let capturedArgs: unknown[] = []
    const execute = vi.fn()
      .mockImplementationOnce((_sql: unknown, args: unknown[]) => { capturedArgs = args; return [{}, {}] })
      .mockResolvedValueOnce([[SEC_EVENT_ROW], {}])
    const repo = new SecurityEventRepository(makePool({ execute }))
    await repo.append({ actorId: 'u-1', actorType: 'account', action: 'test', result: 'error' })
    // metadata arg should be null when not provided
    expect(capturedArgs[7]).toBeNull()
  })
})

describe('SecurityEventRepository — list()', () => {
  it('returns empty page when no events', async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce([[{ total: 0 }], {}])
      .mockResolvedValueOnce([[], {}])
    const repo = new SecurityEventRepository(makePool({ execute }))
    const page = await repo.list()
    expect(page.events).toHaveLength(0)
    expect(page.total).toBe(0)
  })

  it('applies limit=50 by default, capped at 200', async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce([[{ total: 0 }], {}])
      .mockResolvedValueOnce([[], {}])
    const repo = new SecurityEventRepository(makePool({ execute }))
    const page = await repo.list({ limit: 500 }) // should clamp to 200
    expect(page.limit).toBe(200)
  })

  it('maps rows to SecurityEventRecord with parsed metadata', async () => {
    const rowWithMeta = { ...SEC_EVENT_ROW, event_metadata: JSON.stringify({ key: 'val' }) }
    const execute = vi.fn()
      .mockResolvedValueOnce([[{ total: 1 }], {}])
      .mockResolvedValueOnce([[rowWithMeta], {}])
    const repo = new SecurityEventRepository(makePool({ execute }))
    const page = await repo.list()
    expect(page.events[0]?.metadata).toEqual({ key: 'val' })
  })
})
