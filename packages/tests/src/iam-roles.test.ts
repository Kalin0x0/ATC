import { describe, it, expect } from 'vitest'
import { BUILT_IN_ROLES, getBuiltInRole, isBuiltInRole } from '@atc/iam'

describe('BUILT_IN_ROLES', () => {
  it('exports exactly 8 built-in roles', () => {
    expect(BUILT_IN_ROLES).toHaveLength(8)
  })

  it('includes all expected role IDs', () => {
    const ids = BUILT_IN_ROLES.map((r) => r.id)
    expect(ids).toContain('super_admin')
    expect(ids).toContain('admin')
    expect(ids).toContain('moderator')
    expect(ids).toContain('developer')
    expect(ids).toContain('support')
    expect(ids).toContain('player')
    expect(ids).toContain('plugin')
    expect(ids).toContain('service')
  })

  it('every role has required fields', () => {
    for (const role of BUILT_IN_ROLES) {
      expect(typeof role.id).toBe('string')
      expect(typeof role.name).toBe('string')
      expect(typeof role.description).toBe('string')
      expect(Array.isArray(role.permissions)).toBe(true)
      expect(Array.isArray(role.capabilities)).toBe(true)
      expect(Array.isArray(role.inherits)).toBe(true)
      expect(Array.isArray(role.denies)).toBe(true)
    }
  })

  it('super_admin inherits from admin', () => {
    const role = getBuiltInRole('super_admin')!
    expect(role.inherits).toContain('admin')
  })

  it('admin inherits from moderator and developer', () => {
    const role = getBuiltInRole('admin')!
    expect(role.inherits).toContain('moderator')
    expect(role.inherits).toContain('developer')
  })

  it('moderator inherits from support', () => {
    const role = getBuiltInRole('moderator')!
    expect(role.inherits).toContain('support')
  })

  it('player has no inherits (base role)', () => {
    const role = getBuiltInRole('player')!
    expect(role.inherits).toHaveLength(0)
  })

  it('plugin is isolated — no inherits and no permissions', () => {
    const role = getBuiltInRole('plugin')!
    expect(role.inherits).toHaveLength(0)
    expect(role.permissions).toHaveLength(0)
    expect(role.capabilities).toHaveLength(0)
  })

  it('service is isolated — no inherits', () => {
    const role = getBuiltInRole('service')!
    expect(role.inherits).toHaveLength(0)
  })

  it('super_admin has admin.write capability', () => {
    const role = getBuiltInRole('super_admin')!
    expect(role.capabilities).toContain('admin.write')
  })

  it('player has player.read permission', () => {
    const role = getBuiltInRole('player')!
    expect(role.permissions).toContain('player.read')
  })

  it('no role has non-empty denies by default', () => {
    for (const role of BUILT_IN_ROLES) {
      expect(role.denies).toHaveLength(0)
    }
  })
})

describe('getBuiltInRole', () => {
  it('returns the role for a valid id', () => {
    const role = getBuiltInRole('admin')
    expect(role).toBeDefined()
    expect(role?.id).toBe('admin')
  })

  it('returns undefined for an unknown id', () => {
    expect(getBuiltInRole('ghost_role')).toBeUndefined()
  })
})

describe('isBuiltInRole', () => {
  it('returns true for all built-in role IDs', () => {
    for (const role of BUILT_IN_ROLES) {
      expect(isBuiltInRole(role.id)).toBe(true)
    }
  })

  it('returns false for unknown role IDs', () => {
    expect(isBuiltInRole('custom_role')).toBe(false)
    expect(isBuiltInRole('')).toBe(false)
  })
})
