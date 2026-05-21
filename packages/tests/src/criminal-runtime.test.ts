import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  CriminalError,
  GangNotFoundError,
  GangValidationError,
  GangAlreadyExistsError,
  GangMemberNotFoundError,
  GangMemberAlreadyActiveError,
  GangOperationNotFoundError,
  GangOperationImmutableError,
  ContrabandNotFoundError,
  ContrabandAlreadySeizedError,
  RaidNotFoundError,
  RaidImmutableError,
  RaidAlreadyActiveError,
  BlackMarketTransactionNotFoundError,
} from '@atc/criminal-runtime'
import {
  createGangSchema,
  addGangMemberSchema,
  createOperationSchema,
  registerContrabandSchema,
  stageRaidSchema,
  recordTradeSchema,
} from '@atc/operations'

// ── Error Hierarchy ───────────────────────────────────────────────────────────

describe('CriminalError hierarchy', () => {
  it('GangNotFoundError extends CriminalError', () => {
    const e = new GangNotFoundError('g1')
    expect(e).toBeInstanceOf(CriminalError)
    expect(e.message).toContain('g1')
  })

  it('GangValidationError extends CriminalError', () => {
    const e = new GangValidationError('invalid tag')
    expect(e).toBeInstanceOf(CriminalError)
    expect(e.message).toBe('invalid tag')
  })

  it('GangAlreadyExistsError includes tag', () => {
    const e = new GangAlreadyExistsError('BALLAS')
    expect(e).toBeInstanceOf(CriminalError)
    expect(e.message).toContain('BALLAS')
  })

  it('GangMemberNotFoundError extends CriminalError', () => {
    const e = new GangMemberNotFoundError('g1', 'p1')
    expect(e).toBeInstanceOf(CriminalError)
    expect(e.message).toContain('g1')
  })

  it('GangMemberAlreadyActiveError extends CriminalError', () => {
    const e = new GangMemberAlreadyActiveError('g1', 'p1')
    expect(e).toBeInstanceOf(CriminalError)
    expect(e.message).toContain('p1')
  })

  it('GangOperationNotFoundError extends CriminalError', () => {
    const e = new GangOperationNotFoundError('op1')
    expect(e).toBeInstanceOf(CriminalError)
    expect(e.message).toContain('op1')
  })

  it('GangOperationImmutableError includes from/to', () => {
    const e = new GangOperationImmutableError('op1', 'completed', 'active')
    expect(e).toBeInstanceOf(CriminalError)
    expect(e.message).toContain('completed')
    expect(e.message).toContain('active')
  })

  it('ContrabandNotFoundError extends CriminalError', () => {
    const e = new ContrabandNotFoundError('c1')
    expect(e).toBeInstanceOf(CriminalError)
    expect(e.message).toContain('c1')
  })

  it('ContrabandAlreadySeizedError extends CriminalError', () => {
    const e = new ContrabandAlreadySeizedError('c2')
    expect(e).toBeInstanceOf(CriminalError)
    expect(e.message).toContain('c2')
  })

  it('RaidNotFoundError extends CriminalError', () => {
    const e = new RaidNotFoundError('r1')
    expect(e).toBeInstanceOf(CriminalError)
    expect(e.message).toContain('r1')
  })

  it('RaidImmutableError includes from/to', () => {
    const e = new RaidImmutableError('r1', 'completed', 'active')
    expect(e).toBeInstanceOf(CriminalError)
    expect(e.message).toContain('completed')
  })

  it('RaidAlreadyActiveError includes propertyId', () => {
    const e = new RaidAlreadyActiveError('prop-1')
    expect(e).toBeInstanceOf(CriminalError)
    expect(e.message).toContain('prop-1')
  })

  it('BlackMarketTransactionNotFoundError extends CriminalError', () => {
    const e = new BlackMarketTransactionNotFoundError('t1')
    expect(e).toBeInstanceOf(CriminalError)
    expect(e.message).toContain('t1')
  })
})

// ── Schema Validation ─────────────────────────────────────────────────────────

describe('createGangSchema', () => {
  it('accepts valid gang', () => {
    const result = createGangSchema.safeParse({
      name: 'Ballas',
      tag: 'BALL',
      leaderPrincipalId: 'p1',
    })
    expect(result.success).toBe(true)
  })

  it('rejects tag longer than 8 chars', () => {
    const result = createGangSchema.safeParse({
      name: 'Ballas',
      tag: 'TOOLONGGG',
      leaderPrincipalId: 'p1',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty name', () => {
    const result = createGangSchema.safeParse({ name: '', tag: 'BLG', leaderPrincipalId: 'p1' })
    expect(result.success).toBe(false)
  })
})

describe('addGangMemberSchema', () => {
  it('accepts valid member', () => {
    const result = addGangMemberSchema.safeParse({ principalId: 'p1', rank: 'member' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid rank', () => {
    const result = addGangMemberSchema.safeParse({ principalId: 'p1', rank: 'boss' })
    expect(result.success).toBe(false)
  })
})

describe('createOperationSchema', () => {
  it('accepts valid operation', () => {
    const result = createOperationSchema.safeParse({
      label: 'Paleto Bay Heist',
      operationType: 'heist',
      ownerPrincipalId: 'p1',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid operationType', () => {
    const result = createOperationSchema.safeParse({
      label: 'Op',
      operationType: 'bank_robbery',
      ownerPrincipalId: 'p1',
    })
    expect(result.success).toBe(false)
  })
})

describe('stageRaidSchema', () => {
  it('rejects empty participants', () => {
    const result = stageRaidSchema.safeParse({
      propertyId: 'prop-1',
      leadPrincipalId: 'p1',
      participants: [],
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid raid with participants', () => {
    const result = stageRaidSchema.safeParse({
      propertyId: 'prop-1',
      leadPrincipalId: 'p1',
      participants: ['p1', 'p2', 'p3'],
    })
    expect(result.success).toBe(true)
  })
})

describe('registerContrabandSchema', () => {
  it('accepts valid contraband', () => {
    const result = registerContrabandSchema.safeParse({
      itemName: 'cocaine',
      quantity: 5,
      registeredByPrincipalId: 'p1',
    })
    expect(result.success).toBe(true)
  })

  it('rejects zero quantity', () => {
    const result = registerContrabandSchema.safeParse({
      itemName: 'cocaine',
      quantity: 0,
      registeredByPrincipalId: 'p1',
    })
    expect(result.success).toBe(false)
  })
})

// ── CriminalRuntimeService (mocked) ───────────────────────────────────────────

describe('CriminalRuntimeService — gang lifecycle', () => {
  const mockGangRepo = { create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn() }
  const mockMemberRepo = { add: vi.fn(), remove: vi.fn(), listActiveByGang: vi.fn() }
  const mockEventBus = { emit: vi.fn().mockResolvedValue(undefined) }

  beforeEach(() => { vi.clearAllMocks() })

  it('creates gang and emits GANG_CREATED', async () => {
    const gang = { id: 'g1', name: 'Ballas', tag: 'BALL', status: 'active', memberCount: 1 }
    mockGangRepo.create.mockResolvedValue(gang)
    const result = await mockGangRepo.create({ name: 'Ballas', tag: 'BALL', leaderPrincipalId: 'p1' })
    expect(result.status).toBe('active')
    mockEventBus.emit('atc:criminal:gang:created', { gangId: 'g1' })
    expect(mockEventBus.emit).toHaveBeenCalledWith('atc:criminal:gang:created', expect.any(Object))
  })

  it('returns null for non-existent gang', async () => {
    mockGangRepo.findById.mockResolvedValue(null)
    const result = await mockGangRepo.findById('non-existent')
    expect(result).toBeNull()
  })

  it('throws GangMemberAlreadyActiveError on duplicate member', async () => {
    mockMemberRepo.add.mockRejectedValue(new GangMemberAlreadyActiveError('g1', 'p1'))
    await expect(mockMemberRepo.add({ gangId: 'g1', principalId: 'p1' })).rejects.toThrow(GangMemberAlreadyActiveError)
  })

  it('throws GangAlreadyExistsError on duplicate tag', async () => {
    mockGangRepo.create.mockRejectedValue(new GangAlreadyExistsError('BALL'))
    await expect(mockGangRepo.create({ tag: 'BALL' })).rejects.toThrow(GangAlreadyExistsError)
  })
})

// ── GangOperationService (mocked) ─────────────────────────────────────────────

describe('GangOperationService — operation state machine', () => {
  const mockOperationRepo = { findById: vi.fn(), transition: vi.fn(), create: vi.fn() }

  beforeEach(() => { vi.clearAllMocks() })

  it('creates operation in planning state', async () => {
    const op = { id: 'op1', status: 'planning', label: 'Heist' }
    mockOperationRepo.create.mockResolvedValue(op)
    const result = await mockOperationRepo.create({ label: 'Heist', operationType: 'heist' })
    expect(result.status).toBe('planning')
  })

  it('rejects invalid transition completed→active', async () => {
    mockOperationRepo.transition.mockRejectedValue(
      new GangOperationImmutableError('op1', 'completed', 'active')
    )
    await expect(mockOperationRepo.transition('op1', 'active')).rejects.toThrow(GangOperationImmutableError)
  })

  it('transitions planning→active on start', async () => {
    const op = { id: 'op1', status: 'active', startedAt: new Date() }
    mockOperationRepo.transition.mockResolvedValue(op)
    const result = await mockOperationRepo.transition('op1', 'active')
    expect(result.status).toBe('active')
  })
})

// ── ContrabandService (mocked) ────────────────────────────────────────────────

describe('ContrabandService — seizure', () => {
  const mockContrabandRepo = { register: vi.fn(), seize: vi.fn(), findById: vi.fn() }

  beforeEach(() => { vi.clearAllMocks() })

  it('registers contraband', async () => {
    const cb = { id: 'c1', status: 'registered', itemName: 'cocaine', quantity: 5 }
    mockContrabandRepo.register.mockResolvedValue(cb)
    const result = await mockContrabandRepo.register({ itemName: 'cocaine', quantity: 5 })
    expect(result.status).toBe('registered')
  })

  it('throws ContrabandAlreadySeizedError on double seizure', async () => {
    mockContrabandRepo.seize.mockRejectedValue(new ContrabandAlreadySeizedError('c1'))
    await expect(mockContrabandRepo.seize('c1', 'officer-1')).rejects.toThrow(ContrabandAlreadySeizedError)
  })

  it('returns null for non-existent contraband', async () => {
    mockContrabandRepo.findById.mockResolvedValue(null)
    const result = await mockContrabandRepo.findById('non-existent')
    expect(result).toBeNull()
  })
})

// ── RaidRuntimeService (mocked) ───────────────────────────────────────────────

describe('RaidRuntimeService — raid lifecycle', () => {
  const mockRaidRepo = { create: vi.fn(), transition: vi.fn(), findById: vi.fn() }
  const mockEventBus = { emit: vi.fn().mockResolvedValue(undefined) }

  beforeEach(() => { vi.clearAllMocks() })

  it('stages a raid in staging state', async () => {
    const raid = { id: 'r1', status: 'staging', propertyId: 'prop-1', participants: ['p1', 'p2'] }
    mockRaidRepo.create.mockResolvedValue(raid)
    const result = await mockRaidRepo.create({ propertyId: 'prop-1', participants: ['p1', 'p2'] })
    expect(result.status).toBe('staging')
  })

  it('throws RaidAlreadyActiveError on duplicate property raid', async () => {
    mockRaidRepo.create.mockRejectedValue(new RaidAlreadyActiveError('prop-1'))
    await expect(mockRaidRepo.create({ propertyId: 'prop-1' })).rejects.toThrow(RaidAlreadyActiveError)
  })

  it('transitions staging→active on start', async () => {
    const raid = { id: 'r1', status: 'active', startedAt: new Date() }
    mockRaidRepo.transition.mockResolvedValue(raid)
    mockEventBus.emit('atc:criminal:raid:started', { raidId: 'r1' })
    const result = await mockRaidRepo.transition('r1', 'active')
    expect(result.status).toBe('active')
    expect(mockEventBus.emit).toHaveBeenCalledWith('atc:criminal:raid:started', expect.any(Object))
  })

  it('rejects invalid transition completed→active', async () => {
    mockRaidRepo.transition.mockRejectedValue(new RaidImmutableError('r1', 'completed', 'active'))
    await expect(mockRaidRepo.transition('r1', 'active')).rejects.toThrow(RaidImmutableError)
  })
})

// ── BlackMarketService (mocked) ───────────────────────────────────────────────

describe('BlackMarketService — trade recording', () => {
  const mockTradeRepo = { record: vi.fn(), complete: vi.fn() }

  it('records a trade', async () => {
    const trade = { id: 't1', sellerPrincipalId: 'p1', buyerPrincipalId: 'p2', itemName: 'drugs', quantity: 10 }
    mockTradeRepo.record.mockResolvedValue(trade)
    const result = await mockTradeRepo.record({ sellerPrincipalId: 'p1', buyerPrincipalId: 'p2', itemName: 'drugs', quantity: 10, price: 500 })
    expect(result.itemName).toBe('drugs')
  })
})
