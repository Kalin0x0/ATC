import { describe, it, expect } from 'vitest'
import {
  MissionRuntimeError,
  MissionNotFoundError,
  DuplicateMissionNonceError,
  MissionAlreadyCompletedError,
  ObjectiveNotFoundError,
  AssignmentAlreadyExistsError,
  AssignmentNotFoundError,
  ScenarioNotFoundError,
  DynamicEventNotFoundError,
  DuplicateEventNonceError,
} from '@atc/mission-runtime'
import {
  createMissionSchema,
  startMissionSchema,
  completeMissionSchema,
  failMissionSchema,
  createObjectiveSchema,
  completeObjectiveSchema,
  assignMissionSchema,
  releaseMissionAssignmentSchema,
  registerScenarioSchema,
  createDynamicEventSchema,
  resolveEventSchema,
  progressMissionSchema,
} from '@atc/operations'

// ── Error Hierarchy ───────────────────────────────────────────────────────────

describe('MissionRuntimeError hierarchy', () => {
  it('MissionNotFoundError extends MissionRuntimeError', () => {
    const e = new MissionNotFoundError('mission-1')
    expect(e).toBeInstanceOf(MissionRuntimeError)
    expect(e.message).toContain('mission-1')
    expect(e.name).toBe('MissionNotFoundError')
  })

  it('DuplicateMissionNonceError extends MissionRuntimeError', () => {
    const e = new DuplicateMissionNonceError('nonce-m-1')
    expect(e).toBeInstanceOf(MissionRuntimeError)
    expect(e.message).toContain('nonce-m-1')
    expect(e.name).toBe('DuplicateMissionNonceError')
  })

  it('MissionAlreadyCompletedError extends MissionRuntimeError', () => {
    const e = new MissionAlreadyCompletedError('mission-2')
    expect(e).toBeInstanceOf(MissionRuntimeError)
    expect(e.message).toContain('mission-2')
    expect(e.name).toBe('MissionAlreadyCompletedError')
  })

  it('ObjectiveNotFoundError extends MissionRuntimeError', () => {
    const e = new ObjectiveNotFoundError('objective-1')
    expect(e).toBeInstanceOf(MissionRuntimeError)
    expect(e.message).toContain('objective-1')
    expect(e.name).toBe('ObjectiveNotFoundError')
  })

  it('AssignmentAlreadyExistsError extends MissionRuntimeError', () => {
    const e = new AssignmentAlreadyExistsError('mission-3', 'player-1')
    expect(e).toBeInstanceOf(MissionRuntimeError)
    expect(e.message).toContain('mission-3')
    expect(e.message).toContain('player-1')
    expect(e.name).toBe('AssignmentAlreadyExistsError')
  })

  it('AssignmentNotFoundError extends MissionRuntimeError', () => {
    const e = new AssignmentNotFoundError('mission-4', 'player-2')
    expect(e).toBeInstanceOf(MissionRuntimeError)
    expect(e.message).toContain('mission-4')
    expect(e.message).toContain('player-2')
    expect(e.name).toBe('AssignmentNotFoundError')
  })

  it('ScenarioNotFoundError extends MissionRuntimeError', () => {
    const e = new ScenarioNotFoundError('scenario-1')
    expect(e).toBeInstanceOf(MissionRuntimeError)
    expect(e.message).toContain('scenario-1')
    expect(e.name).toBe('ScenarioNotFoundError')
  })

  it('DynamicEventNotFoundError extends MissionRuntimeError', () => {
    const e = new DynamicEventNotFoundError('event-1')
    expect(e).toBeInstanceOf(MissionRuntimeError)
    expect(e.message).toContain('event-1')
    expect(e.name).toBe('DynamicEventNotFoundError')
  })

  it('DuplicateEventNonceError extends MissionRuntimeError', () => {
    const e = new DuplicateEventNonceError('nonce-ev-1')
    expect(e).toBeInstanceOf(MissionRuntimeError)
    expect(e.message).toContain('nonce-ev-1')
    expect(e.name).toBe('DuplicateEventNonceError')
  })
})

// ── createMissionSchema ───────────────────────────────────────────────────────

describe('createMissionSchema', () => {
  it('accepts minimal valid mission', () => {
    const result = createMissionSchema.safeParse({
      missionNonce: 'nonce-mission-abc',
      missionType:  'main',
      missionName:  'Operation Clean Sweep',
    })
    expect(result.success).toBe(true)
  })

  it('accepts mission with all optional fields', () => {
    const result = createMissionSchema.safeParse({
      missionNonce:       'nonce-mission-xyz',
      missionType:        'faction',
      missionName:        'Faction Raid',
      ownerServerId:      'server-1',
      ownerPrincipalId:   'principal-1',
      configData:         { reward: 5000, difficulty: 'hard' },
    })
    expect(result.success).toBe(true)
  })

  it('accepts all mission types', () => {
    for (const missionType of ['main', 'side', 'dynamic', 'faction', 'emergency', 'custom'] as const) {
      const result = createMissionSchema.safeParse({
        missionNonce: `nonce-${missionType}`,
        missionType,
        missionName:  `Test ${missionType}`,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid mission type', () => {
    const result = createMissionSchema.safeParse({
      missionNonce: 'nonce-1',
      missionType:  'invalid',
      missionName:  'Test',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing missionNonce', () => {
    const result = createMissionSchema.safeParse({
      missionType: 'main',
      missionName: 'Test',
    })
    expect(result.success).toBe(false)
  })
})

// ── mission lifecycle schemas ─────────────────────────────────────────────────

describe('mission lifecycle schemas', () => {
  it('startMissionSchema accepts valid missionId', () => {
    const result = startMissionSchema.safeParse({ missionId: 'mission-1' })
    expect(result.success).toBe(true)
  })

  it('completeMissionSchema accepts valid missionId', () => {
    const result = completeMissionSchema.safeParse({ missionId: 'mission-1' })
    expect(result.success).toBe(true)
  })

  it('failMissionSchema accepts valid missionId', () => {
    const result = failMissionSchema.safeParse({ missionId: 'mission-1' })
    expect(result.success).toBe(true)
  })

  it('startMissionSchema rejects missing missionId', () => {
    const result = startMissionSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

// ── createObjectiveSchema / completeObjectiveSchema ───────────────────────────

describe('createObjectiveSchema', () => {
  it('accepts minimal valid objective', () => {
    const result = createObjectiveSchema.safeParse({
      objectiveId:    'obj-1',
      missionId:      'mission-1',
      objectiveType:  'eliminate',
      objectiveName:  'Eliminate target',
    })
    expect(result.success).toBe(true)
  })

  it('accepts objective with optional fields', () => {
    const result = createObjectiveSchema.safeParse({
      objectiveId:    'obj-2',
      missionId:      'mission-1',
      objectiveType:  'collect',
      objectiveName:  'Collect evidence',
      sequenceOrder:  1,
      completionData: { required: 5 },
    })
    expect(result.success).toBe(true)
  })

  it('accepts all objective types', () => {
    for (const objectiveType of ['reach', 'collect', 'eliminate', 'protect', 'deliver', 'interact', 'custom'] as const) {
      const result = createObjectiveSchema.safeParse({
        objectiveId:    `obj-${objectiveType}`,
        missionId:      'mission-1',
        objectiveType,
        objectiveName:  `Test ${objectiveType}`,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid objective type', () => {
    const result = createObjectiveSchema.safeParse({
      objectiveId:    'obj-1',
      missionId:      'mission-1',
      objectiveType:  'kill',
      objectiveName:  'Test',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing objectiveId', () => {
    const result = createObjectiveSchema.safeParse({
      missionId:      'mission-1',
      objectiveType:  'eliminate',
      objectiveName:  'Test',
    })
    expect(result.success).toBe(false)
  })
})

describe('completeObjectiveSchema', () => {
  it('accepts valid objectiveId', () => {
    const result = completeObjectiveSchema.safeParse({ objectiveId: 'obj-1' })
    expect(result.success).toBe(true)
  })
})

// ── assignMissionSchema / releaseMissionAssignmentSchema ──────────────────────

describe('assignMissionSchema', () => {
  it('accepts minimal assignment', () => {
    const result = assignMissionSchema.safeParse({
      missionId:  'mission-1',
      assigneeId: 'player-1',
    })
    expect(result.success).toBe(true)
  })

  it('accepts assignment with all fields', () => {
    const result = assignMissionSchema.safeParse({
      missionId:    'mission-1',
      assigneeId:   'player-1',
      assigneeType: 'player',
      role:         'owner',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing assigneeId', () => {
    const result = assignMissionSchema.safeParse({ missionId: 'mission-1' })
    expect(result.success).toBe(false)
  })
})

describe('releaseMissionAssignmentSchema', () => {
  it('accepts valid release', () => {
    const result = releaseMissionAssignmentSchema.safeParse({
      missionId:  'mission-1',
      assigneeId: 'player-1',
    })
    expect(result.success).toBe(true)
  })
})

// ── registerScenarioSchema ────────────────────────────────────────────────────

describe('registerScenarioSchema', () => {
  it('accepts minimal scenario', () => {
    const result = registerScenarioSchema.safeParse({
      scenarioId:   'scenario-1',
      scenarioType: 'combat',
    })
    expect(result.success).toBe(true)
  })

  it('accepts all scenario types', () => {
    for (const scenarioType of ['combat', 'rescue', 'transport', 'investigation', 'escort', 'custom'] as const) {
      const result = registerScenarioSchema.safeParse({
        scenarioId:   `scenario-${scenarioType}`,
        scenarioType,
      })
      expect(result.success).toBe(true)
    }
  })

  it('accepts scenario with optional fields', () => {
    const result = registerScenarioSchema.safeParse({
      scenarioId:    'scenario-2',
      scenarioType:  'rescue',
      missionId:     'mission-1',
      configData:    { vehicles: 3 },
      ownerServerId: 'server-1',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid scenario type', () => {
    const result = registerScenarioSchema.safeParse({
      scenarioId:   'scenario-1',
      scenarioType: 'heist',
    })
    expect(result.success).toBe(false)
  })
})

// ── createDynamicEventSchema / resolveEventSchema ─────────────────────────────

describe('createDynamicEventSchema', () => {
  it('accepts minimal event', () => {
    const result = createDynamicEventSchema.safeParse({
      eventNonce: 'nonce-ev-abc',
      eventType:  'ambush',
    })
    expect(result.success).toBe(true)
  })

  it('accepts all event types', () => {
    for (const eventType of ['ambush', 'accident', 'weather', 'crowd', 'crime', 'emergency', 'custom'] as const) {
      const result = createDynamicEventSchema.safeParse({
        eventNonce: `nonce-${eventType}`,
        eventType,
      })
      expect(result.success).toBe(true)
    }
  })

  it('accepts event with optional fields', () => {
    const result = createDynamicEventSchema.safeParse({
      eventNonce:    'nonce-ev-xyz',
      eventType:     'crime',
      triggerData:   { location: { x: 100, y: 200 } },
      zoneId:        'zone-downtown',
      ownerServerId: 'server-1',
      expiresAt:     '2026-06-01T00:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing eventNonce', () => {
    const result = createDynamicEventSchema.safeParse({ eventType: 'ambush' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid event type', () => {
    const result = createDynamicEventSchema.safeParse({
      eventNonce: 'nonce-1',
      eventType:  'convoy',
    })
    expect(result.success).toBe(false)
  })
})

describe('resolveEventSchema', () => {
  it('accepts valid eventId', () => {
    const result = resolveEventSchema.safeParse({ eventId: 'event-1' })
    expect(result.success).toBe(true)
  })
})

// ── progressMissionSchema ─────────────────────────────────────────────────────

describe('progressMissionSchema', () => {
  it('accepts valid progression', () => {
    const result = progressMissionSchema.safeParse({
      missionId:   'mission-1',
      objectiveId: 'obj-1',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing missionId', () => {
    const result = progressMissionSchema.safeParse({ objectiveId: 'obj-1' })
    expect(result.success).toBe(false)
  })

  it('rejects missing objectiveId', () => {
    const result = progressMissionSchema.safeParse({ missionId: 'mission-1' })
    expect(result.success).toBe(false)
  })
})
