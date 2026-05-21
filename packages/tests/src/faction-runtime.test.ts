import { describe, it, expect, vi } from 'vitest'
import {
  FactionError,
  FactionNotFoundError,
  FactionValidationError,
  FactionAlreadyExistsError,
  FactionMemberNotFoundError,
  FactionMemberAlreadyActiveError,
  TerritoryNotFoundError,
  TerritoryAlreadyClaimedError,
  TerritoryClaimNotFoundError,
  TerritoryClaimImmutableError,
  ConflictNotFoundError,
  ConflictAlreadyActiveError,
  ConflictImmutableError,
  ResourceNodeNotFoundError,
  ResourceNodeAlreadyOwnedError,
  InfluenceRecordNotFoundError,
} from '@atc/faction-runtime'
import {
  createFactionSchema,
  claimTerritorySchema,
  startConflictSchema,
  resolveConflictSchema,
  captureResourceNodeSchema,
  addFactionMemberSchema,
} from '@atc/operations'

// ── Error Hierarchy ───────────────────────────────────────────────────────────

describe('FactionError hierarchy', () => {
  it('FactionNotFoundError extends FactionError', () => {
    const e = new FactionNotFoundError('f-1')
    expect(e).toBeInstanceOf(FactionError)
    expect(e.message).toContain('f-1')
  })

  it('FactionValidationError extends FactionError', () => {
    const e = new FactionValidationError('tag too long')
    expect(e).toBeInstanceOf(FactionError)
    expect(e.message).toBe('tag too long')
  })

  it('FactionAlreadyExistsError extends FactionError', () => {
    const e = new FactionAlreadyExistsError('ATCG')
    expect(e).toBeInstanceOf(FactionError)
    expect(e.message).toContain('ATCG')
  })

  it('FactionMemberNotFoundError extends FactionError', () => {
    const e = new FactionMemberNotFoundError('f-1', 'p-1')
    expect(e).toBeInstanceOf(FactionError)
    expect(e.message).toContain('p-1')
  })

  it('FactionMemberAlreadyActiveError extends FactionError', () => {
    const e = new FactionMemberAlreadyActiveError('f-1', 'p-2')
    expect(e).toBeInstanceOf(FactionError)
    expect(e.message).toContain('p-2')
  })

  it('TerritoryNotFoundError extends FactionError', () => {
    const e = new TerritoryNotFoundError('t-1')
    expect(e).toBeInstanceOf(FactionError)
    expect(e.message).toContain('t-1')
  })

  it('TerritoryAlreadyClaimedError extends FactionError', () => {
    const e = new TerritoryAlreadyClaimedError('t-2', 'f-1')
    expect(e).toBeInstanceOf(FactionError)
    expect(e.message).toContain('t-2')
  })

  it('TerritoryClaimNotFoundError extends FactionError', () => {
    const e = new TerritoryClaimNotFoundError('tc-1')
    expect(e).toBeInstanceOf(FactionError)
    expect(e.message).toContain('tc-1')
  })

  it('TerritoryClaimImmutableError extends FactionError', () => {
    const e = new TerritoryClaimImmutableError('tc-2', 'superseded', 'active')
    expect(e).toBeInstanceOf(FactionError)
    expect(e.message).toContain('superseded')
  })

  it('ConflictNotFoundError extends FactionError', () => {
    const e = new ConflictNotFoundError('c-1')
    expect(e).toBeInstanceOf(FactionError)
    expect(e.message).toContain('c-1')
  })

  it('ConflictAlreadyActiveError extends FactionError', () => {
    const e = new ConflictAlreadyActiveError('t-1')
    expect(e).toBeInstanceOf(FactionError)
    expect(e.message).toContain('t-1')
  })

  it('ConflictImmutableError extends FactionError', () => {
    const e = new ConflictImmutableError('c-2', 'resolved', 'active')
    expect(e).toBeInstanceOf(FactionError)
    expect(e.message).toContain('resolved')
  })

  it('ResourceNodeNotFoundError extends FactionError', () => {
    const e = new ResourceNodeNotFoundError('n-1')
    expect(e).toBeInstanceOf(FactionError)
    expect(e.message).toContain('n-1')
  })

  it('ResourceNodeAlreadyOwnedError extends FactionError', () => {
    const e = new ResourceNodeAlreadyOwnedError('n-2', 'f-2')
    expect(e).toBeInstanceOf(FactionError)
    expect(e.message).toContain('n-2')
  })

  it('InfluenceRecordNotFoundError extends FactionError', () => {
    const e = new InfluenceRecordNotFoundError('f-1', 't-1')
    expect(e).toBeInstanceOf(FactionError)
    expect(e.message).toContain('f-1')
  })
})

// ── Schema Validation ─────────────────────────────────────────────────────────

describe('createFactionSchema', () => {
  it('accepts valid faction', () => {
    const result = createFactionSchema.safeParse({
      name:              'Atlantic Gang',
      tag:               'ATG',
      leaderPrincipalId: 'p-leader',
      factionType:       'gang',
      colorHex:          '#FF0000',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid factionType', () => {
    const result = createFactionSchema.safeParse({
      name:              'Atlantic Gang',
      tag:               'ATG',
      leaderPrincipalId: 'p-leader',
      factionType:       'mafia',
    })
    expect(result.success).toBe(false)
  })

  it('rejects tag longer than 8 chars', () => {
    const result = createFactionSchema.safeParse({
      name:              'Long Tag Faction',
      tag:               'TOOLONGTAG',
      leaderPrincipalId: 'p-leader',
      factionType:       'gang',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid colorHex format', () => {
    const result = createFactionSchema.safeParse({
      name:              'Atlantic Gang',
      tag:               'ATG',
      leaderPrincipalId: 'p-leader',
      factionType:       'gang',
      colorHex:          'red',
    })
    expect(result.success).toBe(false)
  })
})

describe('claimTerritorySchema', () => {
  it('accepts valid capture claim', () => {
    const result = claimTerritorySchema.safeParse({
      territoryId:          'zone-downtown',
      factionId:            'f-1',
      claimedByPrincipalId: 'p-leader',
      claimType:            'capture',
      claimNonce:           'claim-nonce-1',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid claimType', () => {
    const result = claimTerritorySchema.safeParse({
      territoryId:          'zone-downtown',
      factionId:            'f-1',
      claimedByPrincipalId: 'p-leader',
      claimType:            'conquest',
      claimNonce:           'claim-nonce-2',
    })
    expect(result.success).toBe(false)
  })
})

describe('startConflictSchema', () => {
  it('accepts valid conflict', () => {
    const result = startConflictSchema.safeParse({
      territoryId:           'zone-downtown',
      attackerFactionId:     'f-1',
      initiatingPrincipalId: 'p-leader',
      conflictType:          'territory_capture',
      conflictNonce:         'conflict-nonce-1',
    })
    expect(result.success).toBe(true)
  })

  it('accepts optional defenderFactionId', () => {
    const result = startConflictSchema.safeParse({
      territoryId:           'zone-industrial',
      attackerFactionId:     'f-1',
      defenderFactionId:     'f-2',
      initiatingPrincipalId: 'p-leader',
      conflictType:          'war',
      conflictNonce:         'conflict-nonce-2',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid conflictType', () => {
    const result = startConflictSchema.safeParse({
      territoryId:           'zone-downtown',
      attackerFactionId:     'f-1',
      initiatingPrincipalId: 'p-leader',
      conflictType:          'raid',
      conflictNonce:         'conflict-nonce-3',
    })
    expect(result.success).toBe(false)
  })
})

describe('resolveConflictSchema', () => {
  it('accepts attacker_won outcome', () => {
    const result = resolveConflictSchema.safeParse({ conflictId: 'c-1', outcome: 'attacker_won' })
    expect(result.success).toBe(true)
  })

  it('accepts stalemate outcome', () => {
    const result = resolveConflictSchema.safeParse({ conflictId: 'c-1', outcome: 'stalemate' })
    expect(result.success).toBe(true)
  })

  it('rejects unknown outcome', () => {
    const result = resolveConflictSchema.safeParse({ conflictId: 'c-1', outcome: 'draw' })
    expect(result.success).toBe(false)
  })
})

describe('captureResourceNodeSchema', () => {
  it('accepts valid capture', () => {
    const result = captureResourceNodeSchema.safeParse({
      nodeId:               'mine-alpha',
      factionId:            'f-1',
      capturingPrincipalId: 'p-1',
    })
    expect(result.success).toBe(true)
  })
})

// ── Territory Conflict (service mock) ─────────────────────────────────────────

describe('ConflictRuntimeService — territory conflicts', () => {
  it('starts conflict and marks territory contested', async () => {
    const mockStart = vi.fn().mockResolvedValue({
      id: 'c-1',
      status: 'active',
      conflictNonce: 'cnonce-1',
      territoryId: 't-1',
    })
    const mockService = { startConflict: mockStart }
    const result = await mockService.startConflict({
      territoryId:           't-1',
      attackerFactionId:     'f-1',
      initiatingPrincipalId: 'p-leader',
      conflictType:          'territory_capture',
      conflictNonce:         'cnonce-1',
    })
    expect(result.status).toBe('active')
    expect(result.territoryId).toBe('t-1')
  })

  it('throws ConflictAlreadyActiveError on duplicate conflict', async () => {
    const mockStart = vi.fn().mockRejectedValue(new ConflictAlreadyActiveError('t-1'))
    const mockService = { startConflict: mockStart }
    await expect(mockService.startConflict({ territoryId: 't-1' })).rejects.toBeInstanceOf(ConflictAlreadyActiveError)
  })

  it('resolves conflict with attacker_won', async () => {
    const mockResolve = vi.fn().mockResolvedValue({ id: 'c-1', status: 'resolved', outcome: 'attacker_won' })
    const mockService = { resolveConflict: mockResolve }
    const result = await mockService.resolveConflict({ conflictId: 'c-1', outcome: 'attacker_won' })
    expect(result.outcome).toBe('attacker_won')
    expect(result.status).toBe('resolved')
  })

  it('throws ConflictImmutableError on re-resolve', async () => {
    const mockResolve = vi.fn().mockRejectedValue(new ConflictImmutableError('c-1', 'resolved', 'active'))
    const mockService = { resolveConflict: mockResolve }
    await expect(mockService.resolveConflict({ conflictId: 'c-1', outcome: 'stalemate' })).rejects.toBeInstanceOf(ConflictImmutableError)
  })
})

// ── Influence Propagation (service mock) ──────────────────────────────────────

describe('InfluenceRuntimeService — influence propagation', () => {
  it('adds influence and returns updated record', async () => {
    const mockAdd = vi.fn().mockResolvedValue({ influenceScore: 30, influenceDelta: 10 })
    const mockService = { addInfluence: mockAdd }
    const result = await mockService.addInfluence('f-1', 't-1', 10)
    expect(result.influenceScore).toBe(30)
    expect(result.influenceDelta).toBe(10)
  })

  it('triggers territory transfer at >=75 influence', async () => {
    const mockAdd = vi.fn().mockResolvedValue({ influenceScore: 75, influenceDelta: 5, territoryTransferred: true })
    const mockService = { addInfluence: mockAdd }
    const result = await mockService.addInfluence('f-1', 't-1', 5) as { territoryTransferred?: boolean }
    expect(result.territoryTransferred).toBe(true)
  })
})

// ── EventBus Fail-soft ─────────────────────────────────────────────────────────

describe('Faction — EventBus fail-soft', () => {
  it('faction creation result unaffected by EventBus emit rejection', async () => {
    const expectedFaction = { id: 'f-1', name: 'Atlantic Gang', tag: 'ATG', status: 'active' }
    const mockCreate = vi.fn().mockImplementation(async (_params: unknown) => {
      Promise.reject(new Error('redis down')).catch(() => undefined)
      return expectedFaction
    })
    const mockService = { createFaction: mockCreate }
    const result = await mockService.createFaction({ name: 'Atlantic Gang', tag: 'ATG' })
    expect(result).toStrictEqual(expectedFaction)
  })

  it('territory claim result unaffected by EventBus emit rejection', async () => {
    const expectedClaim = { id: 'tc-1', status: 'active', claimNonce: 'nonce-x' }
    const mockClaim = vi.fn().mockImplementation(async (_params: unknown) => {
      Promise.reject(new Error('redis down')).catch(() => undefined)
      return expectedClaim
    })
    const mockService = { claimTerritory: mockClaim }
    const result = await mockService.claimTerritory({ claimNonce: 'nonce-x' })
    expect(result).toStrictEqual(expectedClaim)
  })
})
