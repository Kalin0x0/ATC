import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  RuntimeRecoveryCoordinator,
  FailoverOrchestrationService,
  ChaosSimulationService,
  RuntimeResilienceService,
  SnapshotRecoveryService,
} from '@atc/runtime-resilience'
import type {
  RecoveryOperationRepository,
  RecoverySnapshotRepository,
  RuntimeFailoverRepository,
  ChaosRuntimeRepository,
  RuntimeResilienceRepository,
  FailoverAuditRepository,
  RuntimeResilienceEventBus,
} from '@atc/runtime-resilience'

const ULID      = '01JABCDEFGHJKMNPQRST'
const ENTITY_ID = 'ENTITY_001'
const OP_ID     = 'OP_001'
const FO_ID     = 'FO_001'
const TEST_ID   = 'TEST_001'
const REC_ID    = 'REC_001'

function mockAudit(): FailoverAuditRepository {
  return { append: vi.fn().mockResolvedValue(undefined) } as unknown as FailoverAuditRepository
}

function mockBus(): RuntimeResilienceEventBus {
  return { emit: vi.fn().mockResolvedValue(undefined) }
}

// ── RuntimeRecoveryCoordinator ───────────────────────────────────────────────

describe('RuntimeRecoveryCoordinator', () => {
  let opRepo: RecoveryOperationRepository
  let snapshotRepo: RecoverySnapshotRepository
  let audit: FailoverAuditRepository
  let bus: RuntimeResilienceEventBus
  let svc: RuntimeRecoveryCoordinator

  beforeEach(() => {
    const op = {
      id: ULID, operationId: OP_ID, operationType: 'state_repair' as const,
      status: 'pending' as const, entityId: ENTITY_ID,
      ownerServerId: 'server-1', startedAt: new Date(), completedAt: null,
      createdAt: new Date(), updatedAt: new Date(), recoveryData: '{}',
    }
    opRepo = {
      create:       vi.fn().mockResolvedValue(op),
      findById:     vi.fn().mockResolvedValue(op),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, completedAt?: Date) =>
        Promise.resolve({ ...op, status, completedAt: completedAt ?? null })
      ),
      listActive:   vi.fn().mockResolvedValue([op]),
    } as unknown as RecoveryOperationRepository
    snapshotRepo = {} as unknown as RecoverySnapshotRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new RuntimeRecoveryCoordinator(opRepo, snapshotRepo, audit, bus)
  })

  it('initiateRecovery creates operation and emits event', async () => {
    const result = await svc.initiateRecovery({
      operationId: OP_ID, operationType: 'state_repair',
      ownerServerId: 'server-1', entityId: ENTITY_ID,
    })
    expect(result.operationId).toBe(OP_ID)
    expect(vi.mocked(audit.append)).toHaveBeenCalledOnce()
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:resilience:recovery:started', expect.any(Object))
  })

  it('completeRecovery transitions to completed', async () => {
    const result = await svc.completeRecovery(ULID)
    expect(result.status).toBe('completed')
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:resilience:recovery:completed', expect.any(Object))
  })

  it('failRecovery transitions to failed', async () => {
    const result = await svc.failRecovery(ULID)
    expect(result.status).toBe('failed')
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:resilience:recovery:failed', expect.any(Object))
  })

  it('getOperation returns null when not found', async () => {
    vi.mocked(opRepo.findById).mockResolvedValue(null)
    const result = await svc.getOperation('MISSING')
    expect(result).toBeNull()
  })

  it('listActiveOperations returns list', async () => {
    const results = await svc.listActiveOperations('server-1')
    expect(results).toHaveLength(1)
  })
})

// ── FailoverOrchestrationService ─────────────────────────────────────────────

describe('FailoverOrchestrationService', () => {
  let failoverRepo: RuntimeFailoverRepository
  let audit: FailoverAuditRepository
  let bus: RuntimeResilienceEventBus
  let svc: FailoverOrchestrationService

  beforeEach(() => {
    const failover = {
      id: ULID, failoverId: FO_ID, failoverType: 'emergency' as const,
      status: 'pending' as const, sourceServerId: 'server-a',
      targetServerId: 'server-b', startedAt: new Date(), completedAt: null,
      createdAt: new Date(), updatedAt: new Date(), failoverData: '{}',
    }
    failoverRepo = {
      create:       vi.fn().mockResolvedValue(failover),
      findById:     vi.fn().mockResolvedValue(failover),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, completedAt?: Date) =>
        Promise.resolve({ ...failover, status, completedAt: completedAt ?? null })
      ),
      listActive:   vi.fn().mockResolvedValue([failover]),
      cleanupStale: vi.fn().mockResolvedValue(0),
    } as unknown as RuntimeFailoverRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new FailoverOrchestrationService(failoverRepo, audit, bus)
  })

  it('initiateFailover creates record and emits started event', async () => {
    const result = await svc.initiateFailover({
      failoverId: FO_ID, failoverType: 'emergency',
      sourceServerId: 'server-a', targetServerId: 'server-b',
      failoverNonce: 'nonce-1',
    })
    expect(result.failoverId).toBe(FO_ID)
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:resilience:failover:started', expect.any(Object))
  })

  it('completeFailover transitions and emits completed', async () => {
    const result = await svc.completeFailover(ULID)
    expect(result.status).toBe('completed')
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:resilience:failover:completed', expect.any(Object))
  })

  it('failFailover transitions and emits failed', async () => {
    const result = await svc.failFailover(ULID)
    expect(result.status).toBe('failed')
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:resilience:failover:failed', expect.any(Object))
  })

  it('cleanupStale returns purged count', async () => {
    const count = await svc.cleanupStale(60000)
    expect(count).toBe(0)
  })
})

// ── ChaosSimulationService ───────────────────────────────────────────────────

describe('ChaosSimulationService', () => {
  let chaosRepo: ChaosRuntimeRepository
  let audit: FailoverAuditRepository
  let bus: RuntimeResilienceEventBus
  let svc: ChaosSimulationService

  beforeEach(() => {
    const test = {
      id: ULID, testId: TEST_ID, testType: 'network_partition' as const,
      status: 'running' as const, targetServerId: 'server-1',
      startedAt: new Date(), completedAt: null,
      createdAt: new Date(), updatedAt: new Date(), chaosData: '{}',
    }
    chaosRepo = {
      create:       vi.fn().mockResolvedValue(test),
      findById:     vi.fn().mockResolvedValue(test),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, completedAt?: Date) =>
        Promise.resolve({ ...test, status, completedAt: completedAt ?? null })
      ),
      listActive:   vi.fn().mockResolvedValue([test]),
    } as unknown as ChaosRuntimeRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new ChaosSimulationService(chaosRepo, audit, bus)
  })

  it('startTest creates test and emits event', async () => {
    const result = await svc.startTest({
      testId: TEST_ID, testType: 'network_partition',
    })
    expect(result.testId).toBe(TEST_ID)
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:resilience:chaos:started', expect.any(Object))
  })

  it('completeTest transitions status', async () => {
    const result = await svc.completeTest(ULID)
    expect(result.status).toBe('completed')
  })

  it('abortTest transitions status', async () => {
    const result = await svc.abortTest(ULID)
    expect(result.status).toBe('aborted')
  })

  it('listActiveTests returns active', async () => {
    const results = await svc.listActiveTests()
    expect(results).toHaveLength(1)
  })
})

// ── RuntimeResilienceService ─────────────────────────────────────────────────

describe('RuntimeResilienceService', () => {
  let resilienceRepo: RuntimeResilienceRepository
  let bus: RuntimeResilienceEventBus
  let svc: RuntimeResilienceService

  beforeEach(() => {
    const record = {
      id: ULID, recordId: REC_ID, resilienceType: 'server' as const,
      status: 'healthy' as const, ownerServerId: 'server-1',
      healthScore: 95, lastCheckAt: new Date(),
      createdAt: new Date(), updatedAt: new Date(), resilienceData: '{}',
    }
    resilienceRepo = {
      upsert:           vi.fn().mockResolvedValue(record),
      findByRecordId:   vi.fn().mockResolvedValue(record),
      updateHealthScore: vi.fn().mockResolvedValue({ ...record, healthScore: 40, status: 'critical' }),
      listAll:          vi.fn().mockResolvedValue([record]),
    } as unknown as RuntimeResilienceRepository
    bus = mockBus()
    svc = new RuntimeResilienceService(resilienceRepo, bus)
  })

  it('upsertHealth upserts record', async () => {
    const result = await svc.upsertHealth({
      recordId: REC_ID, resilienceType: 'server',
      ownerServerId: 'server-1', healthScore: 95,
    })
    expect(result.recordId).toBe(REC_ID)
  })

  it('updateHealthScore to critical fires degraded event', async () => {
    const result = await svc.updateHealthScore(REC_ID, 40)
    expect(result.status).toBe('critical')
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:resilience:health:degraded', expect.any(Object))
  })

  it('updateHealthScore to healthy does not fire event', async () => {
    vi.mocked(resilienceRepo.updateHealthScore).mockResolvedValue({ healthScore: 90, status: 'healthy' } as never)
    await svc.updateHealthScore(REC_ID, 90)
    expect(vi.mocked(bus.emit)).not.toHaveBeenCalled()
  })
})

// ── SnapshotRecoveryService ──────────────────────────────────────────────────

describe('SnapshotRecoveryService', () => {
  let snapshotRepo: RecoverySnapshotRepository
  let audit: FailoverAuditRepository
  let bus: RuntimeResilienceEventBus
  let svc: SnapshotRecoveryService

  beforeEach(() => {
    const snapshot = {
      id: ULID, entityId: ENTITY_ID, snapshotType: 'full' as const,
      ownerServerId: 'server-1', sequenceNumber: 1,
      isApplied: false, createdAt: new Date(), snapshotData: '{}',
    }
    snapshotRepo = {
      create:       vi.fn().mockResolvedValue(snapshot),
      markApplied:  vi.fn().mockResolvedValue({ ...snapshot, isApplied: true }),
      findById:     vi.fn().mockResolvedValue(snapshot),
      listByEntity: vi.fn().mockResolvedValue([snapshot]),
      listUnapplied: vi.fn().mockResolvedValue([snapshot]),
    } as unknown as RecoverySnapshotRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new SnapshotRecoveryService(snapshotRepo, audit, bus)
  })

  it('createSnapshot creates and emits event', async () => {
    const result = await svc.createSnapshot({
      entityId: ENTITY_ID, snapshotType: 'full',
      ownerServerId: 'server-1', snapshotData: { state: 'ok' },
      sequenceNumber: 1,
    })
    expect(result.entityId).toBe(ENTITY_ID)
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:resilience:snapshot:created', expect.any(Object))
  })

  it('restoreSnapshot marks applied and emits event', async () => {
    const result = await svc.restoreSnapshot(ULID)
    expect(result.isApplied).toBe(true)
    expect(vi.mocked(audit.append)).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'snapshot_restored' }))
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:resilience:snapshot:restored', expect.any(Object))
  })

  it('listByEntity returns snapshots', async () => {
    const results = await svc.listByEntity(ENTITY_ID)
    expect(results).toHaveLength(1)
  })
})
