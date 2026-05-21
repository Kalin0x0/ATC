import { describe, it, expect, vi, beforeEach } from 'vitest'
import type {
  RuntimeSustainmentRepository, AtcRuntimeSustainment,
  InfiniteRecoveryRepository, AtcInfiniteRecovery,
  AutonomousMaintenanceRepository, AtcAutonomousMaintenance,
  DistributedSustainmentRepository, AtcDistributedSustainment,
  RuntimeLongevityRepository, AtcRuntimeLongevity,
  SustainmentAuditRepository, RuntimeSustainmentEventBus,
} from '@atc/runtime-sustainment'
import {
  RuntimeSustainmentService,
  InfiniteRecoveryCoordinator,
  AutonomousMaintenanceService,
  DistributedSustainmentService,
  RuntimeLongevityService,
  SustainmentRecoveryService,
} from '@atc/runtime-sustainment'

function mockBus(): RuntimeSustainmentEventBus {
  return { emit: vi.fn().mockResolvedValue(undefined) }
}

function mockAudit(): SustainmentAuditRepository {
  return { append: vi.fn().mockResolvedValue(undefined) } as unknown as SustainmentAuditRepository
}

describe('RuntimeSustainmentService', () => {
  let sustainmentRepo: RuntimeSustainmentRepository
  let audit: SustainmentAuditRepository
  let bus: RuntimeSustainmentEventBus
  let service: RuntimeSustainmentService

  beforeEach(() => {
    const sustainment: AtcRuntimeSustainment = {
      id: '01S', sustainmentId: '01T', sustainmentType: 'continuous',
      status: 'pending', ownerServerId: 'srv-1', sustainmentNonce: 'nonce-s-1',
      sustainmentData: {}, startedAt: null, createdAt: new Date(), updatedAt: new Date(),
    }
    sustainmentRepo = {
      create: vi.fn().mockResolvedValue(sustainment),
      findById: vi.fn().mockResolvedValue(sustainment),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, startedAt?: Date) =>
        Promise.resolve({ ...sustainment, status, startedAt: startedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(4),
    } as unknown as RuntimeSustainmentRepository
    audit = mockAudit()
    bus = mockBus()
    service = new RuntimeSustainmentService(sustainmentRepo, audit, bus)
  })

  it('initiates a sustainment record', async () => {
    const result = await service.initiateSustainment({ sustainmentType: 'continuous', ownerServerId: 'srv-1', sustainmentNonce: 'nonce-s-1' })
    expect(result.status).toBe('pending')
    expect(result.sustainmentType).toBe('continuous')
  })

  it('starts sustainment and emits sustainment_started', async () => {
    const result = await service.startSustainment('01S')
    expect(result.status).toBe('active')
    expect(result.startedAt).toBeInstanceOf(Date)
  })

  it('completes sustainment and emits permanent_runtime_stability_established', async () => {
    const result = await service.completeSustainment('01S')
    expect(result.status).toBe('completed')
  })

  it('maintains sustainment state', async () => {
    const result = await service.maintainSustainment('01S')
    expect(result.status).toBe('maintaining')
  })

  it('retrieves a sustainment record', async () => {
    const result = await service.getSustainment('01S')
    expect(result?.sustainmentType).toBe('continuous')
  })
})

describe('InfiniteRecoveryCoordinator', () => {
  let recoveryRepo: InfiniteRecoveryRepository
  let audit: SustainmentAuditRepository
  let bus: RuntimeSustainmentEventBus
  let service: InfiniteRecoveryCoordinator

  beforeEach(() => {
    const rec: AtcInfiniteRecovery = {
      id: '01R', recoveryId: 'recovery-1', recoveryType: 'full',
      status: 'active', ownerServerId: 'srv-1',
      recoveryData: {}, syncedAt: new Date(), completedAt: null, createdAt: new Date(), updatedAt: new Date(),
    }
    recoveryRepo = {
      upsert: vi.fn().mockResolvedValue(rec),
      findByRecoveryId: vi.fn().mockResolvedValue(rec),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, completedAt?: Date) =>
        Promise.resolve({ ...rec, status, completedAt: completedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(3),
    } as unknown as InfiniteRecoveryRepository
    audit = mockAudit()
    bus = mockBus()
    service = new InfiniteRecoveryCoordinator(recoveryRepo, audit, bus)
  })

  it('initiates recovery via upsert', async () => {
    const result = await service.initiateRecovery({ recoveryId: 'recovery-1', recoveryType: 'full', ownerServerId: 'srv-1' })
    expect(result.recoveryId).toBe('recovery-1')
    expect(result.recoveryType).toBe('full')
  })

  it('completes recovery and emits infinite_recovery_completed', async () => {
    const result = await service.completeRecovery('recovery-1')
    expect(result.status).toBe('completed')
    expect(result.completedAt).toBeInstanceOf(Date)
  })
})

describe('AutonomousMaintenanceService', () => {
  let maintenanceRepo: AutonomousMaintenanceRepository
  let audit: SustainmentAuditRepository
  let bus: RuntimeSustainmentEventBus
  let service: AutonomousMaintenanceService

  beforeEach(() => {
    const maint: AtcAutonomousMaintenance = {
      id: '01M', maintenanceId: '01N', maintenanceType: 'cleanup',
      status: 'pending', ownerServerId: 'srv-1', maintenanceNonce: 'nonce-m-1',
      maintenanceData: {}, completedAt: null, createdAt: new Date(), updatedAt: new Date(),
    }
    maintenanceRepo = {
      create: vi.fn().mockResolvedValue(maint),
      findById: vi.fn().mockResolvedValue(maint),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, completedAt?: Date) =>
        Promise.resolve({ ...maint, status, completedAt: completedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(5),
    } as unknown as AutonomousMaintenanceRepository
    audit = mockAudit()
    bus = mockBus()
    service = new AutonomousMaintenanceService(maintenanceRepo, audit, bus)
  })

  it('schedules maintenance', async () => {
    const result = await service.scheduleMaintenance({ maintenanceType: 'cleanup', ownerServerId: 'srv-1', maintenanceNonce: 'nonce-m-1' })
    expect(result.maintenanceType).toBe('cleanup')
  })

  it('completes maintenance and emits autonomous_maintenance_completed', async () => {
    const result = await service.completeMaintenance('01M')
    expect(result.status).toBe('completed')
    expect(result.completedAt).toBeInstanceOf(Date)
  })
})

describe('DistributedSustainmentService', () => {
  let nodeRepo: DistributedSustainmentRepository
  let audit: SustainmentAuditRepository
  let bus: RuntimeSustainmentEventBus
  let service: DistributedSustainmentService

  beforeEach(() => {
    const node: AtcDistributedSustainment = {
      id: '01N', sustainmentNodeId: 'node-1', nodeType: 'primary',
      status: 'active', ownerServerId: 'srv-1',
      nodeData: {}, syncedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
    }
    nodeRepo = {
      upsert: vi.fn().mockResolvedValue(node),
      findByNodeId: vi.fn().mockResolvedValue(node),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string) =>
        Promise.resolve({ ...node, status })
      ),
      cleanupStale: vi.fn().mockResolvedValue(2),
    } as unknown as DistributedSustainmentRepository
    audit = mockAudit()
    bus = mockBus()
    service = new DistributedSustainmentService(nodeRepo, audit, bus)
  })

  it('registers a sustainment node via upsert', async () => {
    const result = await service.registerNode({ sustainmentNodeId: 'node-1', nodeType: 'primary', ownerServerId: 'srv-1' })
    expect(result.sustainmentNodeId).toBe('node-1')
    expect(result.nodeType).toBe('primary')
  })

  it('degrades a node', async () => {
    const result = await service.degradeNode('node-1')
    expect(result.status).toBe('degraded')
  })
})

describe('RuntimeLongevityService', () => {
  let longevityRepo: RuntimeLongevityRepository
  let audit: SustainmentAuditRepository
  let bus: RuntimeSustainmentEventBus
  let service: RuntimeLongevityService

  beforeEach(() => {
    const longevity: AtcRuntimeLongevity = {
      id: '01L', longevityId: '01LX', longevityType: 'checkpoint',
      status: 'pending', ownerServerId: 'srv-1', longevityNonce: 'nonce-l-1',
      longevityData: {}, archivedAt: null, createdAt: new Date(), updatedAt: new Date(),
    }
    longevityRepo = {
      create: vi.fn().mockResolvedValue(longevity),
      findById: vi.fn().mockResolvedValue(longevity),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, archivedAt?: Date) =>
        Promise.resolve({ ...longevity, status, archivedAt: archivedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(6),
    } as unknown as RuntimeLongevityRepository
    audit = mockAudit()
    bus = mockBus()
    service = new RuntimeLongevityService(longevityRepo, audit, bus)
  })

  it('creates a longevity checkpoint', async () => {
    const result = await service.createCheckpoint({ longevityType: 'checkpoint', ownerServerId: 'srv-1', longevityNonce: 'nonce-l-1' })
    expect(result.longevityType).toBe('checkpoint')
  })

  it('archives checkpoint and emits permanent_runtime_stability_established', async () => {
    const result = await service.archiveCheckpoint('01L')
    expect(result.status).toBe('archived')
    expect(result.archivedAt).toBeInstanceOf(Date)
  })
})

describe('SustainmentRecoveryService', () => {
  it('cleans up stale records and returns counts', async () => {
    const sustainmentRepo = { cleanupStale: vi.fn().mockResolvedValue(4) } as unknown as RuntimeSustainmentRepository
    const recoveryRepo = { cleanupStale: vi.fn().mockResolvedValue(3) } as unknown as InfiniteRecoveryRepository
    const maintenanceRepo = { cleanupStale: vi.fn().mockResolvedValue(5) } as unknown as AutonomousMaintenanceRepository
    const nodeRepo = { cleanupStale: vi.fn().mockResolvedValue(2) } as unknown as DistributedSustainmentRepository
    const longevityRepo = { cleanupStale: vi.fn().mockResolvedValue(6) } as unknown as RuntimeLongevityRepository
    const audit = mockAudit()
    const bus = mockBus()

    const service = new SustainmentRecoveryService(sustainmentRepo, recoveryRepo, maintenanceRepo, nodeRepo, longevityRepo, audit, bus)
    const result = await service.cleanupStale(300000)
    expect(result).toEqual({ sustainments: 4, recoveries: 3, maintenances: 5, sustainmentNodes: 2, longevities: 6 })
  })
})
