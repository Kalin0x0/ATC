import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  ContinuityRuntimeService,
  TemporalRecoveryService,
  InfinitePersistenceService,
  RuntimeCheckpointCoordinator,
  DistributedContinuityService,
  TemporalIntegrityRecoveryService,
} from '@atc/continuity-runtime'
import type {
  ContinuityRuntimeRepository,
  TemporalRecoveryRepository,
  CheckpointRuntimeRepository,
  InfinitePersistenceRepository,
  TemporalIntegrityRepository,
  ContinuityAuditRepository,
  ContinuityRuntimeEventBus,
} from '@atc/continuity-runtime'

const ULID          = '01JABCDEFGHJKMNPQRST'
const CONTINUITY_ID = 'CONT_001'
const RECOVERY_ID   = 'REC_001'
const CHECKPOINT_ID = 'CHKPT_001'
const NODE_ID       = 'NODE_001'
const INTEGRITY_ID  = 'INTEG_001'

function mockAudit(): ContinuityAuditRepository {
  return { append: vi.fn().mockResolvedValue(undefined) } as unknown as ContinuityAuditRepository
}

function mockBus(): ContinuityRuntimeEventBus {
  return { emit: vi.fn().mockResolvedValue(undefined) }
}

// ── ContinuityRuntimeService ─────────────────────────────────────────────────

describe('ContinuityRuntimeService', () => {
  let continuityRepo: ContinuityRuntimeRepository
  let audit: ContinuityAuditRepository
  let bus: ContinuityRuntimeEventBus
  let svc: ContinuityRuntimeService

  beforeEach(() => {
    const continuity = {
      id: ULID, continuityId: CONTINUITY_ID, continuityType: 'entity' as const,
      status: 'active' as const, ownerServerId: 'server-1',
      continuityNonce: 'nonce-1', continuityData: {}, terminatedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    }
    continuityRepo = {
      create:       vi.fn().mockResolvedValue(continuity),
      findById:     vi.fn().mockResolvedValue(continuity),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, terminatedAt?: Date) =>
        Promise.resolve({ ...continuity, status, terminatedAt: terminatedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(3),
    } as unknown as ContinuityRuntimeRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new ContinuityRuntimeService(continuityRepo, audit, bus)
  })

  it('createContinuity creates an active continuity', async () => {
    const result = await svc.createContinuity({
      continuityType: 'entity', ownerServerId: 'server-1', continuityNonce: 'nonce-1',
    })
    expect(result.continuityId).toBe(CONTINUITY_ID)
    expect(result.status).toBe('active')
    expect(continuityRepo.create).toHaveBeenCalledOnce()
  })

  it('suspendContinuity transitions to suspended', async () => {
    const result = await svc.suspendContinuity(ULID)
    expect(result.status).toBe('suspended')
  })

  it('terminateContinuity transitions to terminated', async () => {
    const result = await svc.terminateContinuity(ULID)
    expect(result.status).toBe('terminated')
  })

  it('failContinuity transitions to failed', async () => {
    const result = await svc.failContinuity(ULID)
    expect(result.status).toBe('failed')
  })

  it('getContinuity returns record or null', async () => {
    const result = await svc.getContinuity(ULID)
    expect(result?.continuityId).toBe(CONTINUITY_ID)
  })
})

// ── TemporalRecoveryService ───────────────────────────────────────────────────

describe('TemporalRecoveryService', () => {
  let recoveryRepo: TemporalRecoveryRepository
  let audit: ContinuityAuditRepository
  let bus: ContinuityRuntimeEventBus
  let svc: TemporalRecoveryService

  beforeEach(() => {
    const recovery = {
      id: ULID, recoveryId: RECOVERY_ID, recoveryType: 'point_in_time' as const,
      status: 'pending' as const, ownerServerId: 'server-1',
      recoveryNonce: 'nonce-1', targetTimestamp: null, recoveryData: {}, completedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    }
    recoveryRepo = {
      create:       vi.fn().mockResolvedValue(recovery),
      findById:     vi.fn().mockResolvedValue(recovery),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, completedAt?: Date) =>
        Promise.resolve({ ...recovery, status, completedAt: completedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(1),
    } as unknown as TemporalRecoveryRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new TemporalRecoveryService(recoveryRepo, audit, bus)
  })

  it('initiateRecovery creates a pending recovery', async () => {
    const result = await svc.initiateRecovery({
      recoveryType: 'point_in_time', ownerServerId: 'server-1', recoveryNonce: 'nonce-1',
    })
    expect(result.recoveryId).toBe(RECOVERY_ID)
    expect(result.status).toBe('pending')
  })

  it('beginRecovering transitions to recovering', async () => {
    const result = await svc.beginRecovering(ULID)
    expect(result.status).toBe('recovering')
  })

  it('completeRecovery transitions to completed', async () => {
    const result = await svc.completeRecovery(ULID)
    expect(result.status).toBe('completed')
  })

  it('failRecovery transitions to failed', async () => {
    const result = await svc.failRecovery(ULID)
    expect(result.status).toBe('failed')
  })

  it('getRecovery returns record or null', async () => {
    const result = await svc.getRecovery(ULID)
    expect(result?.recoveryId).toBe(RECOVERY_ID)
  })
})

// ── RuntimeCheckpointCoordinator ─────────────────────────────────────────────

describe('RuntimeCheckpointCoordinator', () => {
  let checkpointRepo: CheckpointRuntimeRepository
  let audit: ContinuityAuditRepository
  let bus: ContinuityRuntimeEventBus
  let svc: RuntimeCheckpointCoordinator

  beforeEach(() => {
    const checkpoint = {
      id: ULID, checkpointId: CHECKPOINT_ID, checkpointType: 'world' as const,
      status: 'pending' as const, ownerServerId: 'server-1',
      checkpointNonce: 'nonce-1', checkpointData: {}, committedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    }
    checkpointRepo = {
      create:       vi.fn().mockResolvedValue(checkpoint),
      findById:     vi.fn().mockResolvedValue(checkpoint),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, committedAt?: Date) =>
        Promise.resolve({ ...checkpoint, status, committedAt: committedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(0),
    } as unknown as CheckpointRuntimeRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new RuntimeCheckpointCoordinator(checkpointRepo, audit, bus)
  })

  it('createCheckpoint creates a pending checkpoint', async () => {
    const result = await svc.createCheckpoint({
      checkpointType: 'world', ownerServerId: 'server-1', checkpointNonce: 'nonce-1',
    })
    expect(result.checkpointId).toBe(CHECKPOINT_ID)
    expect(result.status).toBe('pending')
  })

  it('commitCheckpoint transitions to committed', async () => {
    const result = await svc.commitCheckpoint(ULID)
    expect(result.status).toBe('committed')
  })

  it('rollbackCheckpoint transitions to rolled_back', async () => {
    const result = await svc.rollbackCheckpoint(ULID)
    expect(result.status).toBe('rolled_back')
  })

  it('getCheckpoint returns record or null', async () => {
    const result = await svc.getCheckpoint(ULID)
    expect(result?.checkpointId).toBe(CHECKPOINT_ID)
  })
})

// ── InfinitePersistenceService ────────────────────────────────────────────────

describe('InfinitePersistenceService', () => {
  let persistenceRepo: InfinitePersistenceRepository
  let audit: ContinuityAuditRepository
  let bus: ContinuityRuntimeEventBus
  let svc: InfinitePersistenceService

  beforeEach(() => {
    const node = {
      id: ULID, nodeId: NODE_ID, nodeType: 'primary' as const,
      status: 'active' as const, ownerServerId: 'server-1',
      persistenceData: {}, syncedAt: new Date(),
      createdAt: new Date(), updatedAt: new Date(),
    }
    persistenceRepo = {
      upsert:       vi.fn().mockResolvedValue(node),
      findByNodeId: vi.fn().mockResolvedValue(node),
      failNode:     vi.fn().mockResolvedValue(node),
      cleanupStale: vi.fn().mockResolvedValue(0),
    } as unknown as InfinitePersistenceRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new InfinitePersistenceService(persistenceRepo, audit, bus)
  })

  it('upsertPersistenceNode upserts node record', async () => {
    const result = await svc.upsertPersistenceNode({
      nodeId: NODE_ID, nodeType: 'primary', ownerServerId: 'server-1',
    })
    expect(result.nodeId).toBe(NODE_ID)
    expect(persistenceRepo.upsert).toHaveBeenCalledOnce()
  })

  it('failNode calls failNode on repo', async () => {
    await svc.failNode(NODE_ID)
    expect(persistenceRepo.failNode).toHaveBeenCalledWith(NODE_ID)
  })

  it('getPersistenceNode returns record or null', async () => {
    const result = await svc.getPersistenceNode(NODE_ID)
    expect(result?.nodeId).toBe(NODE_ID)
  })
})

// ── DistributedContinuityService ──────────────────────────────────────────────

describe('DistributedContinuityService', () => {
  let persistenceRepo: InfinitePersistenceRepository
  let audit: ContinuityAuditRepository
  let bus: ContinuityRuntimeEventBus
  let svc: DistributedContinuityService

  beforeEach(() => {
    const node = {
      id: ULID, nodeId: NODE_ID, nodeType: 'replica' as const,
      status: 'active' as const, ownerServerId: 'server-1',
      persistenceData: {}, syncedAt: new Date(),
      createdAt: new Date(), updatedAt: new Date(),
    }
    persistenceRepo = {
      upsert:       vi.fn().mockResolvedValue(node),
      findByNodeId: vi.fn().mockResolvedValue(node),
      failNode:     vi.fn().mockResolvedValue(node),
      cleanupStale: vi.fn().mockResolvedValue(0),
    } as unknown as InfinitePersistenceRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new DistributedContinuityService(persistenceRepo, audit, bus)
  })

  it('upsertContinuityNode upserts node record', async () => {
    const result = await svc.upsertContinuityNode({
      nodeId: NODE_ID, nodeType: 'replica', ownerServerId: 'server-1',
    })
    expect(result.nodeId).toBe(NODE_ID)
    expect(persistenceRepo.upsert).toHaveBeenCalledOnce()
  })

  it('failContinuityNode calls failNode on repo', async () => {
    await svc.failContinuityNode(NODE_ID)
    expect(persistenceRepo.failNode).toHaveBeenCalledWith(NODE_ID)
  })

  it('getContinuityNode returns record or null', async () => {
    const result = await svc.getContinuityNode(NODE_ID)
    expect(result?.nodeId).toBe(NODE_ID)
  })
})

// ── TemporalIntegrityRecoveryService ─────────────────────────────────────────

describe('TemporalIntegrityRecoveryService', () => {
  let continuityRepo: ContinuityRuntimeRepository
  let recoveryRepo: TemporalRecoveryRepository
  let checkpointRepo: CheckpointRuntimeRepository
  let persistenceRepo: InfinitePersistenceRepository
  let integrityRepo: TemporalIntegrityRepository
  let audit: ContinuityAuditRepository
  let bus: ContinuityRuntimeEventBus
  let svc: TemporalIntegrityRecoveryService

  beforeEach(() => {
    const integrity = {
      id: ULID, integrityId: INTEGRITY_ID, integrityType: 'epoch' as const,
      status: 'unknown' as const, ownerServerId: 'server-1',
      integrityNonce: 'nonce-1', integrityData: {}, repairedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    }
    continuityRepo = {
      create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(6),
    } as unknown as ContinuityRuntimeRepository
    recoveryRepo = {
      create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(4),
    } as unknown as TemporalRecoveryRepository
    checkpointRepo = {
      create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(3),
    } as unknown as CheckpointRuntimeRepository
    persistenceRepo = {
      upsert: vi.fn(), findByNodeId: vi.fn(), failNode: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(2),
    } as unknown as InfinitePersistenceRepository
    integrityRepo = {
      create:       vi.fn().mockResolvedValue(integrity),
      findById:     vi.fn().mockResolvedValue(integrity),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, repairedAt?: Date) =>
        Promise.resolve({ ...integrity, status, repairedAt: repairedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(1),
    } as unknown as TemporalIntegrityRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new TemporalIntegrityRecoveryService(continuityRepo, recoveryRepo, checkpointRepo, persistenceRepo, integrityRepo, audit, bus)
  })

  it('createTemporalIntegrity creates an unknown integrity', async () => {
    const result = await svc.createTemporalIntegrity({
      integrityType: 'epoch', ownerServerId: 'server-1', integrityNonce: 'nonce-1',
    })
    expect(result.integrityId).toBe(INTEGRITY_ID)
    expect(result.status).toBe('unknown')
  })

  it('repairTemporalIntegrity transitions to repaired', async () => {
    const result = await svc.repairTemporalIntegrity(ULID)
    expect(result.status).toBe('repaired')
  })

  it('validateTemporalIntegrity transitions to valid', async () => {
    const result = await svc.validateTemporalIntegrity(ULID)
    expect(result.status).toBe('valid')
  })

  it('getTemporalIntegrity returns record or null', async () => {
    const result = await svc.getTemporalIntegrity(ULID)
    expect(result?.integrityId).toBe(INTEGRITY_ID)
  })

  it('cleanupStale returns counts for all domains', async () => {
    const result = await svc.cleanupStale(300000)
    expect(result.continuities).toBe(6)
    expect(result.recoveries).toBe(4)
    expect(result.checkpoints).toBe(3)
    expect(result.persistenceNodes).toBe(2)
    expect(result.temporalIntegrities).toBe(1)
  })
})
