import { describe, it, expect } from 'vitest'
import {
  AiRuntimeError,
  AiEntityNotFoundError,
  PatrolNotFoundError,
  DuplicatePatrolNonceError,
  PatrolAlreadyActiveError,
  ThreatAssessmentNotFoundError,
  ReinforcementNotFoundError,
  DuplicateReinforcementNonceError,
  AiResponseNotFoundError,
  AiResponseAlreadyActiveError,
} from '@atc/ai-runtime'
import {
  upsertAiEntitySchema,
  updateAiStateSchema,
  startPatrolSchema,
  completePatrolSchema,
  assessThreatSchema,
  requestReinforcementSchema,
  activateTacticalResponseSchema,
  updateReinforcementStatusSchema,
  recoverAiEntitySchema,
  cleanupAiRuntimeSchema,
} from '@atc/operations'

// ── Error Hierarchy ───────────────────────────────────────────────────────────

describe('AiRuntimeError hierarchy', () => {
  it('AiEntityNotFoundError extends AiRuntimeError', () => {
    const e = new AiEntityNotFoundError('entity-1')
    expect(e).toBeInstanceOf(AiRuntimeError)
    expect(e.message).toContain('entity-1')
    expect(e.name).toBe('AiEntityNotFoundError')
  })

  it('PatrolNotFoundError extends AiRuntimeError', () => {
    const e = new PatrolNotFoundError('patrol-1')
    expect(e).toBeInstanceOf(AiRuntimeError)
    expect(e.message).toContain('patrol-1')
    expect(e.name).toBe('PatrolNotFoundError')
  })

  it('DuplicatePatrolNonceError extends AiRuntimeError', () => {
    const e = new DuplicatePatrolNonceError('nonce-p-1')
    expect(e).toBeInstanceOf(AiRuntimeError)
    expect(e.message).toContain('nonce-p-1')
    expect(e.name).toBe('DuplicatePatrolNonceError')
  })

  it('PatrolAlreadyActiveError extends AiRuntimeError', () => {
    const e = new PatrolAlreadyActiveError('patrol-2')
    expect(e).toBeInstanceOf(AiRuntimeError)
    expect(e.message).toContain('patrol-2')
    expect(e.name).toBe('PatrolAlreadyActiveError')
  })

  it('ThreatAssessmentNotFoundError extends AiRuntimeError', () => {
    const e = new ThreatAssessmentNotFoundError('assessment-1')
    expect(e).toBeInstanceOf(AiRuntimeError)
    expect(e.message).toContain('assessment-1')
    expect(e.name).toBe('ThreatAssessmentNotFoundError')
  })

  it('ReinforcementNotFoundError extends AiRuntimeError', () => {
    const e = new ReinforcementNotFoundError('reinforcement-1')
    expect(e).toBeInstanceOf(AiRuntimeError)
    expect(e.message).toContain('reinforcement-1')
    expect(e.name).toBe('ReinforcementNotFoundError')
  })

  it('DuplicateReinforcementNonceError extends AiRuntimeError', () => {
    const e = new DuplicateReinforcementNonceError('nonce-r-1')
    expect(e).toBeInstanceOf(AiRuntimeError)
    expect(e.message).toContain('nonce-r-1')
    expect(e.name).toBe('DuplicateReinforcementNonceError')
  })

  it('AiResponseNotFoundError extends AiRuntimeError', () => {
    const e = new AiResponseNotFoundError('response-1')
    expect(e).toBeInstanceOf(AiRuntimeError)
    expect(e.message).toContain('response-1')
    expect(e.name).toBe('AiResponseNotFoundError')
  })

  it('AiResponseAlreadyActiveError extends AiRuntimeError', () => {
    const e = new AiResponseAlreadyActiveError('response-2')
    expect(e).toBeInstanceOf(AiRuntimeError)
    expect(e.message).toContain('response-2')
    expect(e.name).toBe('AiResponseAlreadyActiveError')
  })
})

// ── upsertAiEntitySchema ──────────────────────────────────────────────────────

describe('upsertAiEntitySchema', () => {
  it('accepts minimal valid entity', () => {
    const result = upsertAiEntitySchema.safeParse({
      entityId:   'entity-npc-1',
      entityType: 'npc',
    })
    expect(result.success).toBe(true)
  })

  it('accepts entity with all optional fields', () => {
    const result = upsertAiEntitySchema.safeParse({
      entityId:      'entity-guard-1',
      entityType:    'guard',
      aiState:       'patrolling',
      behaviorMode:  'aggressive',
      ownerServerId: 'server-1',
      positionData:  { x: 100, y: 200, z: 10 },
      threatLevel:   50,
    })
    expect(result.success).toBe(true)
  })

  it('accepts all entity types', () => {
    for (const entityType of ['npc', 'vehicle', 'drone', 'turret', 'guard', 'creature', 'custom'] as const) {
      const result = upsertAiEntitySchema.safeParse({
        entityId:   `entity-${entityType}`,
        entityType,
      })
      expect(result.success).toBe(true)
    }
  })

  it('accepts all AI states', () => {
    for (const aiState of ['idle', 'patrolling', 'alert', 'engaged', 'fleeing', 'dead', 'recovering'] as const) {
      const result = upsertAiEntitySchema.safeParse({
        entityId:   'entity-1',
        entityType: 'npc',
        aiState,
      })
      expect(result.success).toBe(true)
    }
  })

  it('accepts all behavior modes', () => {
    for (const behaviorMode of ['passive', 'defensive', 'aggressive', 'stealth', 'support', 'custom'] as const) {
      const result = upsertAiEntitySchema.safeParse({
        entityId:     'entity-1',
        entityType:   'npc',
        behaviorMode,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid entity type', () => {
    const result = upsertAiEntitySchema.safeParse({
      entityId:   'entity-1',
      entityType: 'boss',
    })
    expect(result.success).toBe(false)
  })

  it('rejects threatLevel above 100', () => {
    const result = upsertAiEntitySchema.safeParse({
      entityId:    'entity-1',
      entityType:  'npc',
      threatLevel: 101,
    })
    expect(result.success).toBe(false)
  })
})

// ── updateAiStateSchema ───────────────────────────────────────────────────────

describe('updateAiStateSchema', () => {
  it('accepts valid state update', () => {
    const result = updateAiStateSchema.safeParse({
      entityId: 'entity-1',
      aiState:  'alert',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid state', () => {
    const result = updateAiStateSchema.safeParse({
      entityId: 'entity-1',
      aiState:  'confused',
    })
    expect(result.success).toBe(false)
  })
})

// ── startPatrolSchema / completePatrolSchema ──────────────────────────────────

describe('startPatrolSchema', () => {
  it('accepts minimal patrol start', () => {
    const result = startPatrolSchema.safeParse({
      patrolNonce: 'nonce-patrol-abc',
      entityId:    'entity-guard-1',
      patrolType:  'foot',
    })
    expect(result.success).toBe(true)
  })

  it('accepts patrol with optional fields', () => {
    const result = startPatrolSchema.safeParse({
      patrolNonce:   'nonce-patrol-xyz',
      entityId:      'entity-guard-2',
      patrolType:    'vehicle',
      routeData:     { waypoints: [{ x: 0, y: 0 }, { x: 100, y: 100 }] },
      ownerServerId: 'server-1',
    })
    expect(result.success).toBe(true)
  })

  it('accepts all patrol types', () => {
    for (const patrolType of ['foot', 'vehicle', 'air', 'water', 'static', 'custom'] as const) {
      const result = startPatrolSchema.safeParse({
        patrolNonce: `nonce-${patrolType}`,
        entityId:    'entity-1',
        patrolType,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid patrol type', () => {
    const result = startPatrolSchema.safeParse({
      patrolNonce: 'nonce-1',
      entityId:    'entity-1',
      patrolType:  'helicopter',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing patrolNonce', () => {
    const result = startPatrolSchema.safeParse({
      entityId:   'entity-1',
      patrolType: 'foot',
    })
    expect(result.success).toBe(false)
  })
})

describe('completePatrolSchema', () => {
  it('accepts valid patrolId', () => {
    const result = completePatrolSchema.safeParse({ patrolId: 'patrol-1' })
    expect(result.success).toBe(true)
  })
})

// ── assessThreatSchema ────────────────────────────────────────────────────────

describe('assessThreatSchema', () => {
  it('accepts minimal threat assessment', () => {
    const result = assessThreatSchema.safeParse({
      entityId:    'entity-1',
      threatLevel: 'moderate',
      threatType:  'player',
    })
    expect(result.success).toBe(true)
  })

  it('accepts assessment with all optional fields', () => {
    const result = assessThreatSchema.safeParse({
      entityId:       'entity-1',
      threatLevel:    'critical',
      threatType:     'group',
      assessmentId:   'assessment-abc',
      threatSourceId: 'player-criminal-1',
      assessmentData: { weapons: ['pistol'], count: 2 },
      expiresAt:      '2026-06-01T00:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })

  it('accepts all threat levels', () => {
    for (const threatLevel of ['minimal', 'low', 'moderate', 'high', 'critical'] as const) {
      const result = assessThreatSchema.safeParse({
        entityId:    'entity-1',
        threatLevel,
        threatType:  'player',
      })
      expect(result.success).toBe(true)
    }
  })

  it('accepts all threat types', () => {
    for (const threatType of ['player', 'vehicle', 'group', 'zone', 'faction', 'unknown'] as const) {
      const result = assessThreatSchema.safeParse({
        entityId:    'entity-1',
        threatLevel: 'low',
        threatType,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid threat level', () => {
    const result = assessThreatSchema.safeParse({
      entityId:    'entity-1',
      threatLevel: 'extreme',
      threatType:  'player',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid threat type', () => {
    const result = assessThreatSchema.safeParse({
      entityId:    'entity-1',
      threatLevel: 'low',
      threatType:  'hostile_player',
    })
    expect(result.success).toBe(false)
  })
})

// ── requestReinforcementSchema ────────────────────────────────────────────────

describe('requestReinforcementSchema', () => {
  it('accepts minimal reinforcement request', () => {
    const result = requestReinforcementSchema.safeParse({
      reinforcementNonce: 'nonce-reinf-abc',
      reinforcementType:  'ground',
    })
    expect(result.success).toBe(true)
  })

  it('accepts request with optional fields', () => {
    const result = requestReinforcementSchema.safeParse({
      reinforcementNonce:  'nonce-reinf-xyz',
      reinforcementType:   'air',
      requestingEntityId:  'entity-guard-1',
      quantity:            3,
      ownerServerId:       'server-1',
    })
    expect(result.success).toBe(true)
  })

  it('accepts all reinforcement types', () => {
    for (const reinforcementType of ['ground', 'air', 'vehicle', 'special_ops', 'medical', 'support', 'custom'] as const) {
      const result = requestReinforcementSchema.safeParse({
        reinforcementNonce: `nonce-${reinforcementType}`,
        reinforcementType,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects missing reinforcementNonce', () => {
    const result = requestReinforcementSchema.safeParse({
      reinforcementType: 'ground',
    })
    expect(result.success).toBe(false)
  })

  it('rejects quantity above 100', () => {
    const result = requestReinforcementSchema.safeParse({
      reinforcementNonce: 'nonce-1',
      reinforcementType:  'ground',
      quantity:           101,
    })
    expect(result.success).toBe(false)
  })
})

// ── activateTacticalResponseSchema ────────────────────────────────────────────

describe('activateTacticalResponseSchema', () => {
  it('accepts minimal response', () => {
    const result = activateTacticalResponseSchema.safeParse({
      entityId:     'entity-1',
      responseType: 'pursuit',
    })
    expect(result.success).toBe(true)
  })

  it('accepts response with optional fields', () => {
    const result = activateTacticalResponseSchema.safeParse({
      entityId:      'entity-guard-1',
      responseType:  'combat',
      targetId:      'player-criminal-1',
      tacticalData:  { coverPosition: { x: 50, y: 100 } },
      ownerServerId: 'server-1',
    })
    expect(result.success).toBe(true)
  })

  it('accepts all response types', () => {
    for (const responseType of ['pursuit', 'combat', 'investigation', 'evacuation', 'lockdown', 'suppression', 'custom'] as const) {
      const result = activateTacticalResponseSchema.safeParse({
        entityId:     'entity-1',
        responseType,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid response type', () => {
    const result = activateTacticalResponseSchema.safeParse({
      entityId:     'entity-1',
      responseType: 'engage',
    })
    expect(result.success).toBe(false)
  })
})

// ── updateReinforcementStatusSchema ──────────────────────────────────────────

describe('updateReinforcementStatusSchema', () => {
  it('accepts all valid statuses', () => {
    for (const status of ['dispatched', 'arrived', 'withdrawn', 'cancelled'] as const) {
      const result = updateReinforcementStatusSchema.safeParse({
        reinforcementId: 'reinforcement-1',
        status,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid status', () => {
    const result = updateReinforcementStatusSchema.safeParse({
      reinforcementId: 'reinforcement-1',
      status:          'pending',
    })
    expect(result.success).toBe(false)
  })
})

// ── recoverAiEntitySchema / cleanupAiRuntimeSchema ────────────────────────────

describe('recoverAiEntitySchema', () => {
  it('accepts valid entityId', () => {
    const result = recoverAiEntitySchema.safeParse({ entityId: 'entity-1' })
    expect(result.success).toBe(true)
  })

  it('rejects missing entityId', () => {
    const result = recoverAiEntitySchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('cleanupAiRuntimeSchema', () => {
  it('accepts valid threshold', () => {
    const result = cleanupAiRuntimeSchema.safeParse({ thresholdMs: 300000 })
    expect(result.success).toBe(true)
  })

  it('accepts cleanup without threshold (uses default)', () => {
    const result = cleanupAiRuntimeSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejects threshold below 1000', () => {
    const result = cleanupAiRuntimeSchema.safeParse({ thresholdMs: 999 })
    expect(result.success).toBe(false)
  })
})
