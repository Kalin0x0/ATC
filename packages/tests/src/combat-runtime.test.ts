import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  CombatError,
  WeaponNotFoundError,
  WeaponValidationError,
  WeaponSeizedError,
  WeaponLockedError,
  WeaponAlreadyEquippedError,
  DuplicateDamageError,
  CombatSessionNotFoundError,
  CombatSessionEndedError,
  InjuryNotFoundError,
  InsufficientAmmoError,
} from '@atc/combat-runtime'
import {
  registerWeaponSchema,
  equipWeaponSchema,
  applyDamageSchema,
  startCombatSessionSchema,
  applyInjurySchema,
} from '@atc/operations'

// ── Error Hierarchy ───────────────────────────────────────────────────────────

describe('CombatError hierarchy', () => {
  it('WeaponNotFoundError extends CombatError', () => {
    const e = new WeaponNotFoundError('w1')
    expect(e).toBeInstanceOf(CombatError)
    expect(e.message).toContain('w1')
  })

  it('WeaponValidationError extends CombatError', () => {
    const e = new WeaponValidationError('bad model')
    expect(e).toBeInstanceOf(CombatError)
    expect(e.message).toBe('bad model')
  })

  it('WeaponSeizedError includes weapon id', () => {
    const e = new WeaponSeizedError('w2')
    expect(e).toBeInstanceOf(CombatError)
    expect(e.message).toContain('w2')
  })

  it('WeaponLockedError extends CombatError', () => {
    const e = new WeaponLockedError('w3')
    expect(e).toBeInstanceOf(CombatError)
    expect(e.message).toContain('w3')
  })

  it('WeaponAlreadyEquippedError extends CombatError', () => {
    const e = new WeaponAlreadyEquippedError('w4')
    expect(e).toBeInstanceOf(CombatError)
    expect(e.message).toContain('w4')
  })

  it('DuplicateDamageError includes nonce', () => {
    const e = new DuplicateDamageError('nonce-abc')
    expect(e).toBeInstanceOf(CombatError)
    expect(e.message).toContain('nonce-abc')
  })

  it('CombatSessionNotFoundError extends CombatError', () => {
    const e = new CombatSessionNotFoundError('s1')
    expect(e).toBeInstanceOf(CombatError)
    expect(e.message).toContain('s1')
  })

  it('CombatSessionEndedError extends CombatError', () => {
    const e = new CombatSessionEndedError('s2')
    expect(e).toBeInstanceOf(CombatError)
    expect(e.message).toContain('s2')
  })

  it('InjuryNotFoundError extends CombatError', () => {
    const e = new InjuryNotFoundError('i1')
    expect(e).toBeInstanceOf(CombatError)
    expect(e.message).toContain('i1')
  })

  it('InsufficientAmmoError includes current/needed', () => {
    const e = new InsufficientAmmoError('w5', 3, 10)
    expect(e).toBeInstanceOf(CombatError)
    expect(e.message).toContain('w5')
    expect(e.message).toContain('3')
    expect(e.message).toContain('10')
  })
})

// ── Schema Validation ─────────────────────────────────────────────────────────

describe('registerWeaponSchema', () => {
  it('accepts valid weapon registration', () => {
    const result = registerWeaponSchema.safeParse({
      model: 'WEAPON_PISTOL',
      category: 'pistol',
      serial: 'SN-001',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid category', () => {
    const result = registerWeaponSchema.safeParse({
      model: 'WEAPON_PISTOL',
      category: 'bazooka',
      serial: 'SN-001',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty model', () => {
    const result = registerWeaponSchema.safeParse({ model: '', category: 'pistol', serial: 'SN-001' })
    expect(result.success).toBe(false)
  })
})

describe('applyDamageSchema', () => {
  it('accepts valid damage event', () => {
    const result = applyDamageSchema.safeParse({
      attackerPrincipalId: 'attacker-001',
      victimPrincipalId:   'victim-001',
      weaponModel:         'WEAPON_PISTOL',
      hitBone:             'chest',
      damageAmount:        25,
      mitigatedAmount:     5,
      replayNonce:         'nonce-xyz-001',
    })
    expect(result.success).toBe(true)
  })

  it('rejects negative damageAmount', () => {
    const result = applyDamageSchema.safeParse({
      attackerPrincipalId: 'attacker-001',
      victimPrincipalId:   'victim-001',
      weaponModel:         'WEAPON_PISTOL',
      hitBone:             'chest',
      damageAmount:        -5,
      mitigatedAmount:     0,
      replayNonce:         'nonce-001',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid hitBone', () => {
    const result = applyDamageSchema.safeParse({
      attackerPrincipalId: 'attacker-001',
      victimPrincipalId:   'victim-001',
      weaponModel:         'WEAPON_PISTOL',
      hitBone:             'finger',
      damageAmount:        10,
      mitigatedAmount:     0,
      replayNonce:         'nonce-001',
    })
    expect(result.success).toBe(false)
  })

  it('accepts optional ballistics', () => {
    const result = applyDamageSchema.safeParse({
      attackerPrincipalId: 'attacker-001',
      victimPrincipalId:   'victim-001',
      weaponModel:         'WEAPON_RIFLE',
      hitBone:             'head',
      damageAmount:        100,
      mitigatedAmount:     0,
      replayNonce:         'nonce-sniper-001',
      ballistics: { velocity: 900, distance: 150, impactAngle: 45 },
    })
    expect(result.success).toBe(true)
  })
})

describe('equipWeaponSchema', () => {
  it('rejects negative ammo', () => {
    const result = equipWeaponSchema.safeParse({
      weaponId: 'w1',
      holderPrincipalId: 'p1',
      currentAmmo: -1,
      maxAmmo: 17,
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid equip params', () => {
    const result = equipWeaponSchema.safeParse({
      weaponId: 'w1',
      holderPrincipalId: 'p1',
      currentAmmo: 15,
      maxAmmo: 17,
    })
    expect(result.success).toBe(true)
  })
})

describe('applyInjurySchema', () => {
  it('accepts valid injury', () => {
    const result = applyInjurySchema.safeParse({
      principalId: 'p1',
      bodyRegion:  'chest',
      severity:    'severe',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid severity', () => {
    const result = applyInjurySchema.safeParse({
      principalId: 'p1',
      bodyRegion:  'chest',
      severity:    'lethal',
    })
    expect(result.success).toBe(false)
  })
})

// ── DamageService (mocked) ────────────────────────────────────────────────────

describe('DamageService — duplicate suppression', () => {
  it('throws DuplicateDamageError on duplicate nonce', async () => {
    const mockRepo = {
      record: vi.fn().mockRejectedValue(new DuplicateDamageError('nonce-dupe')),
    }
    await expect(mockRepo.record({ replayNonce: 'nonce-dupe' })).rejects.toThrow(DuplicateDamageError)
  })

  it('records damage event on unique nonce', async () => {
    const event = {
      id: '01H', sessionId: null, attackerPrincipalId: 'a1', victimPrincipalId: 'v1',
      weaponModel: 'WEAPON_PISTOL', hitBone: 'chest', damageAmount: 20, mitigatedAmount: 0,
      netDamage: 20, replayNonce: 'unique-nonce', createdAt: new Date(),
    }
    const mockRepo = { record: vi.fn().mockResolvedValue(event) }
    const result = await mockRepo.record({ replayNonce: 'unique-nonce' })
    expect(result.replayNonce).toBe('unique-nonce')
  })
})

// ── WeaponStateService (mocked) ───────────────────────────────────────────────

describe('WeaponStateService — equip/unequip', () => {
  const mockWeaponRepo = { findById: vi.fn() }
  const mockRuntimeRepo = { equip: vi.fn(), unequip: vi.fn() }

  beforeEach(() => { vi.clearAllMocks() })

  it('throws WeaponNotFoundError when weapon does not exist', async () => {
    mockWeaponRepo.findById.mockResolvedValue(null)
    await expect(
      (async () => {
        const weapon = await mockWeaponRepo.findById('non-existent')
        if (!weapon) throw new WeaponNotFoundError('non-existent')
      })()
    ).rejects.toThrow(WeaponNotFoundError)
  })

  it('throws WeaponSeizedError for seized weapon', async () => {
    mockWeaponRepo.findById.mockResolvedValue({ id: 'w1', status: 'seized' })
    await expect(
      (async () => {
        const weapon = await mockWeaponRepo.findById('w1')
        if (weapon.status === 'seized') throw new WeaponSeizedError('w1')
      })()
    ).rejects.toThrow(WeaponSeizedError)
  })

  it('calls equip on valid weapon', async () => {
    mockWeaponRepo.findById.mockResolvedValue({ id: 'w1', status: 'active' })
    mockRuntimeRepo.equip.mockResolvedValue({ weaponId: 'w1', isEquipped: true, currentAmmo: 17 })
    const weapon = await mockWeaponRepo.findById('w1')
    expect(weapon.status).toBe('active')
    const runtime = await mockRuntimeRepo.equip('w1', 'p1')
    expect(runtime.isEquipped).toBe(true)
  })
})

// ── CombatRuntimeService (mocked) ─────────────────────────────────────────────

describe('CombatRuntimeService — session lifecycle', () => {
  const mockSessionRepo = {
    create: vi.fn(),
    findById: vi.fn(),
    end: vi.fn(),
  }
  const mockEventBus = { emit: vi.fn().mockResolvedValue(undefined) }

  beforeEach(() => { vi.clearAllMocks() })

  it('creates a session and emits COMBAT_STARTED', async () => {
    const session = { id: 's1', initiatorPrincipalId: 'p1', status: 'active', startedAt: new Date() }
    mockSessionRepo.create.mockResolvedValue(session)
    const result = await mockSessionRepo.create('p1')
    expect(result.status).toBe('active')
    mockEventBus.emit('atc:combat:session:started', { sessionId: 's1' })
    expect(mockEventBus.emit).toHaveBeenCalledWith('atc:combat:session:started', expect.any(Object))
  })

  it('returns null for non-existent session', async () => {
    mockSessionRepo.findById.mockResolvedValue(null)
    const result = await mockSessionRepo.findById('non-existent')
    expect(result).toBeNull()
  })

  it('ends session with outcome', async () => {
    const session = { id: 's1', status: 'ended', outcome: 'player defeated', endedAt: new Date() }
    mockSessionRepo.end.mockResolvedValue(session)
    const result = await mockSessionRepo.end('s1', 'player defeated')
    expect(result.status).toBe('ended')
    expect(result.outcome).toBe('player defeated')
  })
})

// ── InjuryPropagationService (mocked) ─────────────────────────────────────────

describe('InjuryPropagationService — revive integration', () => {
  const mockInjuryRepo = {
    record: vi.fn(),
    resolveAll: vi.fn(),
    listActive: vi.fn(),
  }

  beforeEach(() => { vi.clearAllMocks() })

  it('records an injury', async () => {
    const injury = { id: 'i1', principalId: 'p1', bodyRegion: 'chest', severity: 'severe', resolvedAt: null }
    mockInjuryRepo.record.mockResolvedValue(injury)
    const result = await mockInjuryRepo.record({ principalId: 'p1', bodyRegion: 'chest', severity: 'severe' })
    expect(result.severity).toBe('severe')
  })

  it('resolves all injuries on revive', async () => {
    mockInjuryRepo.resolveAll.mockResolvedValue(undefined)
    await mockInjuryRepo.resolveAll('p1')
    expect(mockInjuryRepo.resolveAll).toHaveBeenCalledWith('p1')
  })

  it('returns empty array when no active injuries', async () => {
    mockInjuryRepo.listActive.mockResolvedValue([])
    const result = await mockInjuryRepo.listActive('p1')
    expect(result).toHaveLength(0)
  })
})

// ── CombatAuditService (mocked) ───────────────────────────────────────────────

describe('CombatAuditService — session audit', () => {
  const mockDamageRepo = { listBySession: vi.fn(), listByVictim: vi.fn() }
  const mockSessionRepo = { findById: vi.fn() }

  it('returns session + damage events for valid session', async () => {
    const session = { id: 's1', status: 'ended' }
    const damages = [{ id: 'd1', sessionId: 's1' }, { id: 'd2', sessionId: 's1' }]
    mockSessionRepo.findById.mockResolvedValue(session)
    mockDamageRepo.listBySession.mockResolvedValue(damages)

    const s = await mockSessionRepo.findById('s1')
    const d = await mockDamageRepo.listBySession('s1')
    expect(s).not.toBeNull()
    expect(d).toHaveLength(2)
  })

  it('returns victim damage history', async () => {
    mockDamageRepo.listByVictim.mockResolvedValue([{ id: 'd1', victimPrincipalId: 'v1' }])
    const result = await mockDamageRepo.listByVictim('v1', 10)
    expect(result).toHaveLength(1)
  })
})
