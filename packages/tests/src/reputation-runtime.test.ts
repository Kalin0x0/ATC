import { describe, it, expect } from 'vitest'
import {
  ReputationRuntimeError,
  ReputationRecordNotFoundError,
  DiplomaticRelationNotFoundError,
  DuplicateDiplomaticRelationError,
  SocialStandingNotFoundError,
  ReputationDecayNotFoundError,
  InvalidReputationScoreError,
} from '@atc/reputation-runtime'
import {
  adjustReputationSchema,
  upsertReputationSchema,
  setDiplomaticRelationSchema,
  adjustSocialStandingSchema,
  upsertSocialStandingSchema,
  scheduleDecaySchema,
  recordInfluenceSchema,
} from '@atc/operations'

// ── Error Hierarchy ───────────────────────────────────────────────────────────

describe('ReputationRuntimeError hierarchy', () => {
  it('ReputationRecordNotFoundError extends ReputationRuntimeError', () => {
    const e = new ReputationRecordNotFoundError('principal-1', 'faction-cops')
    expect(e).toBeInstanceOf(ReputationRuntimeError)
    expect(e.message).toContain('principal-1')
    expect(e.message).toContain('faction-cops')
    expect(e.name).toBe('ReputationRecordNotFoundError')
  })

  it('DiplomaticRelationNotFoundError extends ReputationRuntimeError', () => {
    const e = new DiplomaticRelationNotFoundError('faction-a', 'faction-b')
    expect(e).toBeInstanceOf(ReputationRuntimeError)
    expect(e.message).toContain('faction-a')
    expect(e.message).toContain('faction-b')
    expect(e.name).toBe('DiplomaticRelationNotFoundError')
  })

  it('DuplicateDiplomaticRelationError extends ReputationRuntimeError', () => {
    const e = new DuplicateDiplomaticRelationError('faction-c', 'faction-d')
    expect(e).toBeInstanceOf(ReputationRuntimeError)
    expect(e.message).toContain('faction-c')
    expect(e.message).toContain('faction-d')
    expect(e.name).toBe('DuplicateDiplomaticRelationError')
  })

  it('SocialStandingNotFoundError extends ReputationRuntimeError', () => {
    const e = new SocialStandingNotFoundError('principal-2')
    expect(e).toBeInstanceOf(ReputationRuntimeError)
    expect(e.message).toContain('principal-2')
    expect(e.name).toBe('SocialStandingNotFoundError')
  })

  it('ReputationDecayNotFoundError extends ReputationRuntimeError', () => {
    const e = new ReputationDecayNotFoundError('principal-3', 'faction-gov')
    expect(e).toBeInstanceOf(ReputationRuntimeError)
    expect(e.message).toContain('principal-3')
    expect(e.name).toBe('ReputationDecayNotFoundError')
  })

  it('InvalidReputationScoreError extends ReputationRuntimeError', () => {
    const e = new InvalidReputationScoreError(1500)
    expect(e).toBeInstanceOf(ReputationRuntimeError)
    expect(e.message).toContain('1500')
    expect(e.name).toBe('InvalidReputationScoreError')
  })
})

// ── adjustReputationSchema ────────────────────────────────────────────────────

describe('adjustReputationSchema', () => {
  it('accepts valid positive adjustment', () => {
    const result = adjustReputationSchema.safeParse({
      principalId: 'player-1',
      factionId:   'faction-cops',
      delta:       50,
      reason:      'helped_officer',
    })
    expect(result.success).toBe(true)
  })

  it('accepts negative delta with optional actorId', () => {
    const result = adjustReputationSchema.safeParse({
      principalId: 'player-1',
      factionId:   'faction-gang',
      delta:       -100,
      reason:      'arrested',
      actorId:     'officer-1',
    })
    expect(result.success).toBe(true)
  })

  it('rejects delta over 1000', () => {
    const result = adjustReputationSchema.safeParse({
      principalId: 'player-1',
      factionId:   'faction-1',
      delta:       1001,
      reason:      'test',
    })
    expect(result.success).toBe(false)
  })

  it('rejects delta under -1000', () => {
    const result = adjustReputationSchema.safeParse({
      principalId: 'player-1',
      factionId:   'faction-1',
      delta:       -1001,
      reason:      'test',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing reason', () => {
    const result = adjustReputationSchema.safeParse({
      principalId: 'player-1',
      factionId:   'faction-1',
      delta:       50,
    })
    expect(result.success).toBe(false)
  })
})

// ── upsertReputationSchema ────────────────────────────────────────────────────

describe('upsertReputationSchema', () => {
  it('accepts valid upsert', () => {
    const result = upsertReputationSchema.safeParse({
      principalId:     'player-1',
      factionId:       'faction-cops',
      reputationScore: 750,
      tier:            'friendly',
    })
    expect(result.success).toBe(true)
  })

  it('accepts all reputation tiers', () => {
    for (const tier of ['hostile', 'unfriendly', 'neutral', 'friendly', 'allied', 'revered'] as const) {
      const result = upsertReputationSchema.safeParse({
        principalId:     'player-1',
        factionId:       'faction-1',
        reputationScore: 0,
        tier,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects missing factionId', () => {
    const result = upsertReputationSchema.safeParse({
      principalId:     'player-1',
      reputationScore: 750,
      tier:            'neutral',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid tier', () => {
    const result = upsertReputationSchema.safeParse({
      principalId:     'player-1',
      factionId:       'faction-1',
      reputationScore: 0,
      tier:            'respected',
    })
    expect(result.success).toBe(false)
  })
})

// ── setDiplomaticRelationSchema ───────────────────────────────────────────────

describe('setDiplomaticRelationSchema', () => {
  it('accepts valid diplomatic relation', () => {
    const result = setDiplomaticRelationSchema.safeParse({
      factionAId:    'faction-cops',
      factionBId:    'faction-ems',
      status:        'allied',
      relationScore: 80,
    })
    expect(result.success).toBe(true)
  })

  it('accepts all diplomatic statuses', () => {
    for (const status of ['war', 'hostile', 'neutral', 'friendly', 'allied', 'vassal'] as const) {
      const result = setDiplomaticRelationSchema.safeParse({
        factionAId:    'faction-a',
        factionBId:    'faction-b',
        status,
        relationScore: 50,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid status', () => {
    const result = setDiplomaticRelationSchema.safeParse({
      factionAId:    'faction-a',
      factionBId:    'faction-b',
      status:        'ceasefire',
      relationScore: 50,
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing factionBId', () => {
    const result = setDiplomaticRelationSchema.safeParse({
      factionAId:    'faction-a',
      status:        'neutral',
      relationScore: 50,
    })
    expect(result.success).toBe(false)
  })
})

// ── adjustSocialStandingSchema ────────────────────────────────────────────────

describe('adjustSocialStandingSchema', () => {
  it('accepts valid standing adjustment', () => {
    const result = adjustSocialStandingSchema.safeParse({
      principalId: 'player-1',
      delta:       25,
      reason:      'community_service',
    })
    expect(result.success).toBe(true)
  })

  it('accepts negative delta', () => {
    const result = adjustSocialStandingSchema.safeParse({
      principalId: 'player-1',
      delta:       -50,
      reason:      'public_disturbance',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing principalId', () => {
    const result = adjustSocialStandingSchema.safeParse({
      delta:  25,
      reason: 'test',
    })
    expect(result.success).toBe(false)
  })
})

// ── upsertSocialStandingSchema ────────────────────────────────────────────────

describe('upsertSocialStandingSchema', () => {
  it('accepts valid standing upsert', () => {
    const result = upsertSocialStandingSchema.safeParse({
      principalId:   'player-1',
      standingScore: 600,
      tier:          'prominent',
    })
    expect(result.success).toBe(true)
  })

  it('accepts all social standing tiers', () => {
    for (const tier of ['criminal', 'disreputable', 'common', 'respected', 'prominent', 'elite'] as const) {
      const result = upsertSocialStandingSchema.safeParse({
        principalId:   'player-1',
        standingScore: 500,
        tier,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid tier', () => {
    const result = upsertSocialStandingSchema.safeParse({
      principalId:   'player-1',
      standingScore: 600,
      tier:          'notable',
    })
    expect(result.success).toBe(false)
  })

  it('rejects standingScore above 1000', () => {
    const result = upsertSocialStandingSchema.safeParse({
      principalId:   'player-1',
      standingScore: 1001,
      tier:          'common',
    })
    expect(result.success).toBe(false)
  })
})

// ── scheduleDecaySchema ───────────────────────────────────────────────────────

describe('scheduleDecaySchema', () => {
  it('accepts valid decay schedule with faction', () => {
    const result = scheduleDecaySchema.safeParse({
      principalId: 'player-1',
      factionId:   'faction-cops',
      decayRate:   5.0,
      nextDecayAt: '2026-06-01T00:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })

  it('accepts decay schedule without faction (global standing)', () => {
    const result = scheduleDecaySchema.safeParse({
      principalId: 'player-1',
      decayRate:   2.5,
      nextDecayAt: '2026-06-01T00:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing decayRate', () => {
    const result = scheduleDecaySchema.safeParse({
      principalId: 'player-1',
      nextDecayAt: '2026-06-01T00:00:00.000Z',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid datetime format', () => {
    const result = scheduleDecaySchema.safeParse({
      principalId: 'player-1',
      decayRate:   2.5,
      nextDecayAt: 'not-a-date',
    })
    expect(result.success).toBe(false)
  })
})

// ── recordInfluenceSchema ─────────────────────────────────────────────────────

describe('recordInfluenceSchema', () => {
  it('accepts minimal influence record', () => {
    const result = recordInfluenceSchema.safeParse({
      principalId:   'player-1',
      changeAmount:  100,
      changeType:    'gain',
      changeReason:  'quest_reward',
    })
    expect(result.success).toBe(true)
  })

  it('accepts influence record with optional fields', () => {
    const result = recordInfluenceSchema.safeParse({
      principalId:   'player-1',
      changeAmount:  -50,
      changeType:    'loss',
      changeReason:  'faction_penalty',
      factionId:     'faction-gang',
      actorId:       'npc-boss-1',
    })
    expect(result.success).toBe(true)
  })

  it('accepts all change types', () => {
    for (const changeType of ['gain', 'loss', 'decay', 'reset', 'transfer', 'event'] as const) {
      const result = recordInfluenceSchema.safeParse({
        principalId:   'player-1',
        changeAmount:  10,
        changeType,
        changeReason:  'test',
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid change type', () => {
    const result = recordInfluenceSchema.safeParse({
      principalId:   'player-1',
      changeAmount:  10,
      changeType:    'boost',
      changeReason:  'test',
    })
    expect(result.success).toBe(false)
  })
})
