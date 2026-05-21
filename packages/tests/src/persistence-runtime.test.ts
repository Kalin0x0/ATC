import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  GlobalPersistenceService,
  SnapshotCompressionService,
  DistributedSnapshotService,
  LongTermRecoveryService,
  RuntimeArchivalService,
  PersistenceConsistencyService,
} from '@atc/persistence-runtime'
import type {
  GlobalSnapshotRepository,
  SnapshotCompressionRepository,
  PersistenceRuntimeRepository,
  LongtermRecoveryRepository,
  SnapshotArchiveRepository,
  PersistenceAuditRepository,
  PersistenceRuntimeEventBus,
} from '@atc/persistence-runtime'

const ULID         = '01JABCDEFGHJKMNPQRST'
const SNAPSHOT_ID  = 'SNAP_001'
const ENTITY_ID    = 'ENTITY_001'
const COMPRESS_ID  = 'COMP_001'
const RECOVERY_ID  = 'REC_001'
const ARCHIVE_ID   = 'ARCH_001'

function mockAudit(): PersistenceAuditRepository {
  return { append: vi.fn().mockResolvedValue(undefined) } as unknown as PersistenceAuditRepository
}

function mockBus(): PersistenceRuntimeEventBus {
  return { emit: vi.fn().mockResolvedValue(undefined) }
}

// ── GlobalPersistenceService ─────────────────────────────────────────────────

describe('GlobalPersistenceService', () => {
  let snapshotRepo: GlobalSnapshotRepository
  let audit: PersistenceAuditRepository
  let bus: PersistenceRuntimeEventBus
  let svc: GlobalPersistenceService

  beforeEach(() => {
    const snapshot = {
      id: ULID, snapshotId: SNAPSHOT_ID, snapshotType: 'world' as const,
      status: 'pending' as const, ownerServerId: 'server-1',
      snapshotNonce: 'nonce-1', entityId: ENTITY_ID, completedAt: null,
      createdAt: new Date(), updatedAt: new Date(), snapshotData: '{}',
    }
    snapshotRepo = {
      create:       vi.fn().mockResolvedValue(snapshot),
      findById:     vi.fn().mockResolvedValue(snapshot),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, completedAt?: Date) =>
        Promise.resolve({ ...snapshot, status, completedAt: completedAt ?? null })
      ),
      listActive:   vi.fn().mockResolvedValue([snapshot]),
      cleanupStale: vi.fn().mockResolvedValue(2),
    } as unknown as GlobalSnapshotRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new GlobalPersistenceService(snapshotRepo, audit, bus)
  })

  it('createSnapshot creates snapshot and emits event', async () => {
    const result = await svc.createSnapshot({
      snapshotId: SNAPSHOT_ID, snapshotType: 'world', ownerServerId: 'server-1',
      snapshotNonce: 'nonce-1',
    })
    expect(result.snapshotId).toBe(SNAPSHOT_ID)
    expect(vi.mocked(audit.append)).toHaveBeenCalledOnce()
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:persistence:snapshot:created', expect.any(Object))
  })

  it('completeSnapshot transitions to completed', async () => {
    const result = await svc.completeSnapshot(ULID)
    expect(result.status).toBe('completed')
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:persistence:snapshot:completed', expect.any(Object))
  })

  it('failSnapshot transitions to failed', async () => {
    const result = await svc.failSnapshot(ULID)
    expect(result.status).toBe('failed')
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:persistence:snapshot:failed', expect.any(Object))
  })

  it('getSnapshot returns null for unknown id', async () => {
    vi.mocked(snapshotRepo.findById).mockResolvedValue(null)
    const result = await svc.getSnapshot('unknown')
    expect(result).toBeNull()
  })

  it('listActiveSnapshots returns snapshots', async () => {
    const results = await svc.listActiveSnapshots('server-1')
    expect(results).toHaveLength(1)
  })
})

// ── SnapshotCompressionService ───────────────────────────────────────────────

describe('SnapshotCompressionService', () => {
  let compressionRepo: SnapshotCompressionRepository
  let audit: PersistenceAuditRepository
  let bus: PersistenceRuntimeEventBus
  let svc: SnapshotCompressionService

  beforeEach(() => {
    const compression = {
      id: ULID, compressionId: COMPRESS_ID, compressionType: 'lz4' as const,
      snapshotId: SNAPSHOT_ID, status: 'pending' as const, ownerServerId: 'server-1',
      compressionNonce: 'nonce-1', completedAt: null,
      createdAt: new Date(), updatedAt: new Date(), compressionData: '{}',
    }
    compressionRepo = {
      create:       vi.fn().mockResolvedValue(compression),
      findById:     vi.fn().mockResolvedValue(compression),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, completedAt?: Date) =>
        Promise.resolve({ ...compression, status, completedAt: completedAt ?? null })
      ),
    } as unknown as SnapshotCompressionRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new SnapshotCompressionService(compressionRepo, audit, bus)
  })

  it('startCompression creates compression and emits event', async () => {
    const result = await svc.startCompression({
      compressionId: COMPRESS_ID, compressionType: 'lz4', snapshotId: SNAPSHOT_ID,
      ownerServerId: 'server-1', compressionNonce: 'nonce-1',
    })
    expect(result.compressionId).toBe(COMPRESS_ID)
    expect(vi.mocked(audit.append)).toHaveBeenCalledOnce()
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:persistence:compression:started', expect.any(Object))
  })

  it('completeCompression transitions to completed', async () => {
    const result = await svc.completeCompression(ULID)
    expect(result.status).toBe('completed')
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:persistence:compression:completed', expect.any(Object))
  })

  it('failCompression transitions to failed', async () => {
    const result = await svc.failCompression(ULID)
    expect(result.status).toBe('failed')
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:persistence:compression:failed', expect.any(Object))
  })
})

// ── DistributedSnapshotService ───────────────────────────────────────────────

describe('DistributedSnapshotService', () => {
  let persistenceRepo: PersistenceRuntimeRepository
  let bus: PersistenceRuntimeEventBus
  let svc: DistributedSnapshotService

  beforeEach(() => {
    const state = {
      id: ULID, entityId: ENTITY_ID, persistenceType: 'character' as const,
      status: 'active' as const, ownerServerId: 'server-1',
      isActive: true, createdAt: new Date(), updatedAt: new Date(), persistenceData: '{}',
    }
    persistenceRepo = {
      upsert:       vi.fn().mockResolvedValue(state),
      findByEntity: vi.fn().mockResolvedValue(state),
      deactivate:   vi.fn().mockResolvedValue(undefined),
      cleanupStale: vi.fn().mockResolvedValue(6),
    } as unknown as PersistenceRuntimeRepository
    bus = mockBus()
    svc = new DistributedSnapshotService(persistenceRepo, bus)
  })

  it('upsertState persists state and emits event', async () => {
    const result = await svc.upsertState({
      entityId: ENTITY_ID, persistenceType: 'character',
      ownerServerId: 'server-1',
    })
    expect(result.entityId).toBe(ENTITY_ID)
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:persistence:state:updated', expect.any(Object))
  })

  it('getState returns null for unknown entity', async () => {
    vi.mocked(persistenceRepo.findByEntity).mockResolvedValue(null)
    const result = await svc.getState('unknown')
    expect(result).toBeNull()
  })

  it('deactivateState deactivates and emits', async () => {
    await svc.deactivateState(ENTITY_ID)
    expect(vi.mocked(persistenceRepo.deactivate)).toHaveBeenCalledWith(ENTITY_ID)
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:persistence:state:deactivated', expect.any(Object))
  })
})

// ── LongTermRecoveryService ──────────────────────────────────────────────────

describe('LongTermRecoveryService', () => {
  let recoveryRepo: LongtermRecoveryRepository
  let audit: PersistenceAuditRepository
  let bus: PersistenceRuntimeEventBus
  let svc: LongTermRecoveryService

  beforeEach(() => {
    const recovery = {
      id: ULID, recoveryId: RECOVERY_ID, recoveryType: 'full' as const,
      status: 'pending' as const, ownerServerId: 'server-1',
      recoveryNonce: 'nonce-1', entityId: ENTITY_ID, completedAt: null,
      createdAt: new Date(), updatedAt: new Date(), recoveryData: '{}',
    }
    recoveryRepo = {
      create:       vi.fn().mockResolvedValue(recovery),
      findById:     vi.fn().mockResolvedValue(recovery),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, completedAt?: Date) =>
        Promise.resolve({ ...recovery, status, completedAt: completedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(3),
    } as unknown as LongtermRecoveryRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new LongTermRecoveryService(recoveryRepo, audit, bus)
  })

  it('startRecovery creates recovery and emits event', async () => {
    const result = await svc.startRecovery({
      recoveryId: RECOVERY_ID, recoveryType: 'full', ownerServerId: 'server-1',
      recoveryNonce: 'nonce-1',
    })
    expect(result.recoveryId).toBe(RECOVERY_ID)
    expect(vi.mocked(audit.append)).toHaveBeenCalledOnce()
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:persistence:recovery:started', expect.any(Object))
  })

  it('completeRecovery transitions to completed', async () => {
    const result = await svc.completeRecovery(ULID)
    expect(result.status).toBe('completed')
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:persistence:recovery:completed', expect.any(Object))
  })

  it('failRecovery transitions to failed', async () => {
    const result = await svc.failRecovery(ULID)
    expect(result.status).toBe('failed')
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:persistence:recovery:failed', expect.any(Object))
  })

  it('getRecovery returns null for unknown id', async () => {
    vi.mocked(recoveryRepo.findById).mockResolvedValue(null)
    const result = await svc.getRecovery('unknown')
    expect(result).toBeNull()
  })
})

// ── RuntimeArchivalService ───────────────────────────────────────────────────

describe('RuntimeArchivalService', () => {
  let archiveRepo: SnapshotArchiveRepository
  let audit: PersistenceAuditRepository
  let bus: PersistenceRuntimeEventBus
  let svc: RuntimeArchivalService

  beforeEach(() => {
    const archive = {
      id: ULID, archiveId: ARCHIVE_ID, archiveType: 'cold' as const,
      sourceSnapshotId: SNAPSHOT_ID, status: 'pending' as const,
      ownerServerId: 'server-1', completedAt: null,
      createdAt: new Date(), updatedAt: new Date(), archiveData: '{}',
    }
    archiveRepo = {
      create:       vi.fn().mockResolvedValue(archive),
      findById:     vi.fn().mockResolvedValue(archive),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, completedAt?: Date) =>
        Promise.resolve({ ...archive, status, completedAt: completedAt ?? null })
      ),
    } as unknown as SnapshotArchiveRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new RuntimeArchivalService(archiveRepo, audit, bus)
  })

  it('createArchive creates archive and emits event', async () => {
    const result = await svc.createArchive({
      archiveId: ARCHIVE_ID, archiveType: 'cold', sourceSnapshotId: SNAPSHOT_ID,
      ownerServerId: 'server-1',
    })
    expect(result.archiveId).toBe(ARCHIVE_ID)
    expect(vi.mocked(audit.append)).toHaveBeenCalledOnce()
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:persistence:archive:created', expect.any(Object))
  })

  it('completeArchive transitions to completed', async () => {
    const result = await svc.completeArchive(ULID)
    expect(result.status).toBe('completed')
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:persistence:archive:completed', expect.any(Object))
  })

  it('getArchive returns null for unknown id', async () => {
    vi.mocked(archiveRepo.findById).mockResolvedValue(null)
    const result = await svc.getArchive('unknown')
    expect(result).toBeNull()
  })
})

// ── PersistenceConsistencyService ────────────────────────────────────────────

describe('PersistenceConsistencyService', () => {
  let snapshotRepo: GlobalSnapshotRepository
  let persistenceRepo: PersistenceRuntimeRepository
  let recoveryRepo: LongtermRecoveryRepository
  let audit: PersistenceAuditRepository
  let bus: PersistenceRuntimeEventBus
  let svc: PersistenceConsistencyService

  beforeEach(() => {
    snapshotRepo    = { cleanupStale: vi.fn().mockResolvedValue(4) } as unknown as GlobalSnapshotRepository
    persistenceRepo = { cleanupStale: vi.fn().mockResolvedValue(7) } as unknown as PersistenceRuntimeRepository
    recoveryRepo    = { cleanupStale: vi.fn().mockResolvedValue(2) } as unknown as LongtermRecoveryRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new PersistenceConsistencyService(snapshotRepo, persistenceRepo, recoveryRepo, audit, bus)
  })

  it('cleanupStale returns aggregated counts', async () => {
    const result = await svc.cleanupStale(60000)
    expect(result.snapshots).toBe(4)
    expect(result.states).toBe(7)
    expect(result.recoveries).toBe(2)
  })

  it('cleanupStale emits cleanup completed event', async () => {
    await svc.cleanupStale(300000)
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:persistence:cleanup:completed', expect.any(Object))
  })
})
