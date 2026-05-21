import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  NarrativeRuntimeService,
  CampaignOrchestrationService,
  WorldEventService,
  StoryProgressionService,
  DynamicNarrativeService,
  NarrativeRecoveryService,
} from '@atc/narrative-runtime'
import type {
  NarrativeSessionRepository,
  CampaignRuntimeRepository,
  WorldEventRepository,
  StoryProgressionRepository,
  DynamicStoryStateRepository,
  NarrativeAuditRepository,
  NarrativeEventBus,
} from '@atc/narrative-runtime'

const ULID        = '01JABCDEFGHJKMNPQRST'
const SESSION_ID  = 'NAR_SESSION_001'
const CAMPAIGN_ID = 'CAMPAIGN_001'
const ENTITY_ID   = 'ENTITY_001'

function mockAudit(): NarrativeAuditRepository {
  return { append: vi.fn().mockResolvedValue(undefined) } as unknown as NarrativeAuditRepository
}

function mockBus(): NarrativeEventBus {
  return { emit: vi.fn().mockResolvedValue(undefined) }
}

// ── NarrativeRuntimeService ──────────────────────────────────────────────────

describe('NarrativeRuntimeService', () => {
  let sessionRepo: NarrativeSessionRepository
  let audit: NarrativeAuditRepository
  let bus: NarrativeEventBus
  let svc: NarrativeRuntimeService

  beforeEach(() => {
    const session = {
      id: ULID, sessionId: SESSION_ID, entityId: ENTITY_ID,
      narrativeType: 'mission' as const, status: 'active' as const,
      ownerServerId: 'server-1', campaignId: null,
      createdAt: new Date(), updatedAt: new Date(), narrativeData: '{}',
    }
    sessionRepo = {
      create:       vi.fn().mockResolvedValue(session),
      findById:     vi.fn().mockResolvedValue(session),
      updateStatus: vi.fn().mockResolvedValue({ ...session, status: 'completed' }),
      listActive:   vi.fn().mockResolvedValue([session]),
      cleanupStale: vi.fn().mockResolvedValue(4),
    } as unknown as NarrativeSessionRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new NarrativeRuntimeService(sessionRepo, audit, bus)
  })

  it('startSession creates session and emits event', async () => {
    const result = await svc.startSession({
      sessionId: SESSION_ID, entityId: ENTITY_ID,
      narrativeType: 'mission', ownerServerId: 'server-1',
    })
    expect(result.sessionId).toBe(SESSION_ID)
    expect(vi.mocked(audit.append)).toHaveBeenCalledOnce()
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:narrative:session:started', expect.any(Object))
  })

  it('endSession transitions to completed', async () => {
    const result = await svc.endSession(ULID, 'completed')
    expect(result.status).toBe('completed')
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:narrative:session:ended', expect.any(Object))
  })

  it('listActiveSessions returns sessions', async () => {
    const results = await svc.listActiveSessions('server-1')
    expect(results).toHaveLength(1)
  })

  it('cleanupStale returns count', async () => {
    const count = await svc.cleanupStale(60000)
    expect(count).toBe(4)
  })
})

// ── CampaignOrchestrationService ─────────────────────────────────────────────

describe('CampaignOrchestrationService', () => {
  let campaignRepo: CampaignRuntimeRepository
  let progressionRepo: StoryProgressionRepository
  let audit: NarrativeAuditRepository
  let bus: NarrativeEventBus
  let svc: CampaignOrchestrationService

  beforeEach(() => {
    const campaign = {
      id: ULID, campaignId: CAMPAIGN_ID, campaignType: 'main' as const,
      status: 'active' as const, ownerServerId: 'server-1',
      regionId: null, startedAt: new Date(), completedAt: null,
      createdAt: new Date(), updatedAt: new Date(), campaignData: '{}',
    }
    campaignRepo = {
      create:       vi.fn().mockResolvedValue(campaign),
      findById:     vi.fn().mockResolvedValue(campaign),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, completedAt?: Date) =>
        Promise.resolve({ ...campaign, status, completedAt: completedAt ?? null })
      ),
      listActive:   vi.fn().mockResolvedValue([campaign]),
      cleanupStale: vi.fn().mockResolvedValue(1),
    } as unknown as CampaignRuntimeRepository
    progressionRepo = {} as unknown as StoryProgressionRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new CampaignOrchestrationService(campaignRepo, progressionRepo, audit, bus)
  })

  it('startCampaign creates campaign and emits event', async () => {
    const result = await svc.startCampaign({
      campaignId: CAMPAIGN_ID, campaignType: 'main',
      ownerServerId: 'server-1', campaignNonce: 'nonce-1',
    })
    expect(result.campaignId).toBe(CAMPAIGN_ID)
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:narrative:campaign:started', expect.any(Object))
  })

  it('completeCampaign sets completed status', async () => {
    const result = await svc.completeCampaign(ULID)
    expect(result.status).toBe('completed')
  })

  it('failCampaign sets failed status', async () => {
    const result = await svc.failCampaign(ULID)
    expect(result.status).toBe('failed')
  })
})

// ── WorldEventService ────────────────────────────────────────────────────────

describe('WorldEventService', () => {
  let eventRepo: WorldEventRepository
  let audit: NarrativeAuditRepository
  let bus: NarrativeEventBus
  let svc: WorldEventService

  beforeEach(() => {
    const event = {
      id: ULID, eventId: 'EVT_001', eventType: 'conflict' as const,
      status: 'active' as const, ownerServerId: 'server-1',
      regionId: null, triggerCondition: null, expiresAt: null,
      activatedAt: new Date(), completedAt: null,
      createdAt: new Date(), updatedAt: new Date(), eventData: '{}',
    }
    eventRepo = {
      create:         vi.fn().mockResolvedValue(event),
      findById:       vi.fn().mockResolvedValue(event),
      updateStatus:   vi.fn().mockResolvedValue({ ...event, status: 'completed' }),
      listActive:     vi.fn().mockResolvedValue([event]),
      cleanupExpired: vi.fn().mockResolvedValue(0),
    } as unknown as WorldEventRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new WorldEventService(eventRepo, audit, bus)
  })

  it('triggerEvent creates event and emits', async () => {
    const result = await svc.triggerEvent({
      eventId: 'EVT_001', eventType: 'conflict', ownerServerId: 'server-1',
    })
    expect(result.eventId).toBe('EVT_001')
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:narrative:world_event:triggered', expect.any(Object))
  })

  it('completeEvent transitions status', async () => {
    const result = await svc.completeEvent(ULID)
    expect(result.status).toBe('completed')
  })
})

// ── StoryProgressionService ──────────────────────────────────────────────────

describe('StoryProgressionService', () => {
  let progressionRepo: StoryProgressionRepository
  let audit: NarrativeAuditRepository
  let bus: NarrativeEventBus
  let svc: StoryProgressionService

  beforeEach(() => {
    const progression = {
      id: ULID, entityId: ENTITY_ID, campaignId: CAMPAIGN_ID,
      progressionType: 'linear' as const, currentStageKey: 'stage-2',
      ownerServerId: 'server-1',
      createdAt: new Date(), updatedAt: new Date(), progressionData: '{}',
    }
    progressionRepo = {
      create:                   vi.fn().mockResolvedValue(progression),
      advanceStage:             vi.fn().mockResolvedValue({ ...progression, currentStageKey: 'stage-3' }),
      findByEntityAndCampaign:  vi.fn().mockResolvedValue([progression]),
    } as unknown as StoryProgressionRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new StoryProgressionService(progressionRepo, audit, bus)
  })

  it('advanceProgression calls repo and emits event', async () => {
    const result = await svc.advanceProgression(ULID, 'stage-3', {})
    expect(result.currentStageKey).toBe('stage-3')
    expect(vi.mocked(audit.append)).toHaveBeenCalled()
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:narrative:progression:advanced', expect.any(Object))
  })

  it('getProgressions returns list', async () => {
    const results = await svc.getProgressions(ENTITY_ID, CAMPAIGN_ID)
    expect(results).toHaveLength(1)
  })
})

// ── DynamicNarrativeService ──────────────────────────────────────────────────

describe('DynamicNarrativeService', () => {
  let storyStateRepo: DynamicStoryStateRepository
  let bus: NarrativeEventBus
  let svc: DynamicNarrativeService

  beforeEach(() => {
    const state = {
      id: ULID, entityId: ENTITY_ID, branchKey: 'choice:faction',
      stateType: 'choice' as const, isActive: true,
      ownerServerId: 'server-1',
      createdAt: new Date(), updatedAt: new Date(), storyData: '{}',
    }
    storyStateRepo = {
      upsert:                  vi.fn().mockResolvedValue(state),
      findByEntityAndBranch:   vi.fn().mockResolvedValue(state),
      listByEntity:            vi.fn().mockResolvedValue([state]),
      deactivate:              vi.fn().mockResolvedValue(undefined),
    } as unknown as DynamicStoryStateRepository
    bus = mockBus()
    svc = new DynamicNarrativeService(storyStateRepo, bus)
  })

  it('setStoryState upserts state', async () => {
    const result = await svc.setStoryState({
      entityId: ENTITY_ID, branchKey: 'choice:faction',
      stateType: 'choice', ownerServerId: 'server-1',
    })
    expect(result.branchKey).toBe('choice:faction')
  })

  it('listEntityStates returns all states for entity', async () => {
    const results = await svc.listEntityStates(ENTITY_ID)
    expect(results).toHaveLength(1)
  })
})

// ── NarrativeRecoveryService ─────────────────────────────────────────────────

describe('NarrativeRecoveryService', () => {
  let campaignRepo: CampaignRuntimeRepository
  let sessionRepo: NarrativeSessionRepository
  let eventRepo: WorldEventRepository
  let audit: NarrativeAuditRepository
  let bus: NarrativeEventBus
  let svc: NarrativeRecoveryService

  beforeEach(() => {
    campaignRepo = { cleanupStale: vi.fn().mockResolvedValue(2) } as unknown as CampaignRuntimeRepository
    sessionRepo  = {
      listActive:   vi.fn().mockResolvedValue([]),
      updateStatus: vi.fn().mockResolvedValue({}),
      cleanupStale: vi.fn().mockResolvedValue(3),
    } as unknown as NarrativeSessionRepository
    eventRepo    = { cleanupExpired: vi.fn().mockResolvedValue(1) } as unknown as WorldEventRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new NarrativeRecoveryService(campaignRepo, sessionRepo, eventRepo, audit, bus)
  })

  it('cleanupStale returns aggregated counts', async () => {
    const result = await svc.cleanupStale(60000)
    expect(result.campaigns).toBe(2)
    expect(result.sessions).toBe(3)
    expect(result.events).toBe(1)
  })

  it('recoverEntity skips active sessions for entity', async () => {
    vi.mocked(sessionRepo.listActive).mockResolvedValue([
      { id: ULID, entityId: ENTITY_ID, sessionId: SESSION_ID } as never,
    ])
    const result = await svc.recoverEntity(ENTITY_ID)
    expect(result.recovered).toBe(1)
    expect(vi.mocked(sessionRepo.updateStatus)).toHaveBeenCalledWith(ULID, 'skipped')
  })
})
