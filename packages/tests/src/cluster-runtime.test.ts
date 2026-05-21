import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  ClusterRuntimeService,
  DeploymentOrchestrationService,
  NodeLifecycleService,
  RuntimeScalingService,
  ClusterAllocationService,
  DistributedDeploymentRecoveryService,
} from '@atc/cluster-runtime'
import type {
  ClusterNodeRepository,
  RuntimeDeploymentRepository,
  ClusterScalingRepository,
  RuntimeAllocationRepository,
  NodeLifecycleRepository,
  ClusterAuditRepository,
  ClusterRuntimeEventBus,
} from '@atc/cluster-runtime'

const ULID          = '01JABCDEFGHJKMNPQRST'
const NODE_ID       = 'NODE_001'
const DEPLOY_ID     = 'DEPLOY_001'
const SCALING_ID    = 'SCALING_001'
const ENTITY_ID     = 'ENTITY_001'

function mockAudit(): ClusterAuditRepository {
  return { append: vi.fn().mockResolvedValue(undefined) } as unknown as ClusterAuditRepository
}

function mockBus(): ClusterRuntimeEventBus {
  return { emit: vi.fn().mockResolvedValue(undefined) }
}

// ── ClusterRuntimeService ────────────────────────────────────────────────────

describe('ClusterRuntimeService', () => {
  let nodeRepo: ClusterNodeRepository
  let audit: ClusterAuditRepository
  let bus: ClusterRuntimeEventBus
  let svc: ClusterRuntimeService

  beforeEach(() => {
    const node = {
      id: ULID, nodeId: NODE_ID, nodeType: 'game' as const,
      status: 'online' as const, ownerServerId: 'server-1',
      nodeNonce: 'nonce-1', address: '127.0.0.1:30120',
      offlineAt: null, createdAt: new Date(), updatedAt: new Date(), nodeData: '{}',
    }
    nodeRepo = {
      register:     vi.fn().mockResolvedValue(node),
      findById:     vi.fn().mockResolvedValue(node),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, offlineAt?: Date) =>
        Promise.resolve({ ...node, status, offlineAt: offlineAt ?? null })
      ),
      listActive:   vi.fn().mockResolvedValue([node]),
      cleanupStale: vi.fn().mockResolvedValue(1),
    } as unknown as ClusterNodeRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new ClusterRuntimeService(nodeRepo, audit, bus)
  })

  it('registerNode registers node and emits event', async () => {
    const result = await svc.registerNode({
      nodeId: NODE_ID, nodeType: 'game', ownerServerId: 'server-1',
      nodeNonce: 'nonce-1', address: '127.0.0.1:30120',
    })
    expect(result.nodeId).toBe(NODE_ID)
    expect(vi.mocked(audit.append)).toHaveBeenCalledOnce()
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:cluster:node:registered', expect.any(Object))
  })

  it('deregisterNode sets node offline', async () => {
    const result = await svc.deregisterNode(ULID)
    expect(result.status).toBe('offline')
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:cluster:node:deregistered', expect.any(Object))
  })

  it('getNode returns null for unknown id', async () => {
    vi.mocked(nodeRepo.findById).mockResolvedValue(null)
    const result = await svc.getNode('unknown')
    expect(result).toBeNull()
  })

  it('listActiveNodes returns nodes', async () => {
    const results = await svc.listActiveNodes('server-1')
    expect(results).toHaveLength(1)
  })
})

// ── DeploymentOrchestrationService ──────────────────────────────────────────

describe('DeploymentOrchestrationService', () => {
  let deploymentRepo: RuntimeDeploymentRepository
  let audit: ClusterAuditRepository
  let bus: ClusterRuntimeEventBus
  let svc: DeploymentOrchestrationService

  beforeEach(() => {
    const deployment = {
      id: ULID, deploymentId: DEPLOY_ID, deploymentType: 'rolling' as const,
      targetNode: NODE_ID, status: 'pending' as const, ownerServerId: 'server-1',
      deploymentNonce: 'nonce-1', completedAt: null,
      createdAt: new Date(), updatedAt: new Date(), deploymentData: '{}',
    }
    deploymentRepo = {
      create:       vi.fn().mockResolvedValue(deployment),
      findById:     vi.fn().mockResolvedValue(deployment),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, completedAt?: Date) =>
        Promise.resolve({ ...deployment, status, completedAt: completedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(2),
    } as unknown as RuntimeDeploymentRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new DeploymentOrchestrationService(deploymentRepo, audit, bus)
  })

  it('startDeployment creates deployment and emits event', async () => {
    const result = await svc.startDeployment({
      deploymentId: DEPLOY_ID, deploymentType: 'rolling', targetNode: NODE_ID,
      ownerServerId: 'server-1', deploymentNonce: 'nonce-1',
    })
    expect(result.deploymentId).toBe(DEPLOY_ID)
    expect(vi.mocked(audit.append)).toHaveBeenCalledOnce()
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:cluster:deployment:started', expect.any(Object))
  })

  it('completeDeployment transitions to completed', async () => {
    const result = await svc.completeDeployment(ULID)
    expect(result.status).toBe('completed')
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:cluster:deployment:completed', expect.any(Object))
  })

  it('failDeployment transitions to failed', async () => {
    const result = await svc.failDeployment(ULID)
    expect(result.status).toBe('failed')
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:cluster:deployment:failed', expect.any(Object))
  })
})

// ── NodeLifecycleService ─────────────────────────────────────────────────────

describe('NodeLifecycleService', () => {
  let lifecycleRepo: NodeLifecycleRepository
  let audit: ClusterAuditRepository
  let bus: ClusterRuntimeEventBus
  let svc: NodeLifecycleService

  beforeEach(() => {
    const lifecycle = {
      id: ULID, nodeId: NODE_ID, lifecycleType: 'startup' as const,
      status: 'running' as const, ownerServerId: 'server-1',
      isActive: true, createdAt: new Date(), updatedAt: new Date(), lifecycleData: '{}',
    }
    lifecycleRepo = {
      upsert:       vi.fn().mockResolvedValue(lifecycle),
      findByNodeId: vi.fn().mockResolvedValue(lifecycle),
      deactivate:   vi.fn().mockResolvedValue(undefined),
    } as unknown as NodeLifecycleRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new NodeLifecycleService(lifecycleRepo, audit, bus)
  })

  it('upsertLifecycle persists lifecycle and emits event', async () => {
    const result = await svc.upsertLifecycle({
      nodeId: NODE_ID, lifecycleType: 'startup', status: 'running', ownerServerId: 'server-1',
    })
    expect(result.nodeId).toBe(NODE_ID)
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:cluster:lifecycle:updated', expect.any(Object))
  })

  it('getLifecycle returns null for unknown node', async () => {
    vi.mocked(lifecycleRepo.findByNodeId).mockResolvedValue(null)
    const result = await svc.getLifecycle('unknown')
    expect(result).toBeNull()
  })

  it('deactivateLifecycle deactivates and emits', async () => {
    await svc.deactivateLifecycle(NODE_ID)
    expect(vi.mocked(lifecycleRepo.deactivate)).toHaveBeenCalledWith(NODE_ID)
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:cluster:lifecycle:deactivated', expect.any(Object))
  })
})

// ── RuntimeScalingService ────────────────────────────────────────────────────

describe('RuntimeScalingService', () => {
  let scalingRepo: ClusterScalingRepository
  let audit: ClusterAuditRepository
  let bus: ClusterRuntimeEventBus
  let svc: RuntimeScalingService

  beforeEach(() => {
    const scaling = {
      id: ULID, scalingId: SCALING_ID, scalingType: 'horizontal' as const,
      status: 'pending' as const, ownerServerId: 'server-1',
      targetNode: NODE_ID, completedAt: null,
      createdAt: new Date(), updatedAt: new Date(), scalingData: '{}',
    }
    scalingRepo = {
      create:       vi.fn().mockResolvedValue(scaling),
      findById:     vi.fn().mockResolvedValue(scaling),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, completedAt?: Date) =>
        Promise.resolve({ ...scaling, status, completedAt: completedAt ?? null })
      ),
    } as unknown as ClusterScalingRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new RuntimeScalingService(scalingRepo, audit, bus)
  })

  it('startScaling creates scaling and emits event', async () => {
    const result = await svc.startScaling({
      scalingId: SCALING_ID, scalingType: 'horizontal', targetNode: NODE_ID,
      ownerServerId: 'server-1',
    })
    expect(result.scalingId).toBe(SCALING_ID)
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:cluster:scaling:started', expect.any(Object))
  })

  it('completeScaling transitions to completed', async () => {
    const result = await svc.completeScaling(ULID)
    expect(result.status).toBe('completed')
  })

  it('failScaling transitions to failed', async () => {
    const result = await svc.failScaling(ULID)
    expect(result.status).toBe('failed')
  })
})

// ── ClusterAllocationService ─────────────────────────────────────────────────

describe('ClusterAllocationService', () => {
  let allocationRepo: RuntimeAllocationRepository
  let audit: ClusterAuditRepository
  let bus: ClusterRuntimeEventBus
  let svc: ClusterAllocationService

  beforeEach(() => {
    const allocation = {
      id: ULID, entityId: ENTITY_ID, nodeId: NODE_ID,
      status: 'allocated' as const, ownerServerId: 'server-1',
      isActive: true, releasedAt: null,
      createdAt: new Date(), updatedAt: new Date(), allocationData: '{}',
    }
    allocationRepo = {
      upsert:           vi.fn().mockResolvedValue(allocation),
      findByEntity:     vi.fn().mockResolvedValue(allocation),
      release:          vi.fn().mockResolvedValue(undefined),
      cleanupReleased:  vi.fn().mockResolvedValue(4),
    } as unknown as RuntimeAllocationRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new ClusterAllocationService(allocationRepo, audit, bus)
  })

  it('allocate upserts allocation and emits event', async () => {
    const result = await svc.allocate({
      entityId: ENTITY_ID, nodeId: NODE_ID, ownerServerId: 'server-1',
    })
    expect(result.entityId).toBe(ENTITY_ID)
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:cluster:allocation:allocated', expect.any(Object))
  })

  it('getAllocation returns null for unknown entity', async () => {
    vi.mocked(allocationRepo.findByEntity).mockResolvedValue(null)
    const result = await svc.getAllocation('unknown')
    expect(result).toBeNull()
  })

  it('deallocate releases allocation and emits event', async () => {
    await svc.deallocate(ENTITY_ID)
    expect(vi.mocked(allocationRepo.release)).toHaveBeenCalledWith(ENTITY_ID)
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:cluster:allocation:released', expect.any(Object))
  })
})

// ── DistributedDeploymentRecoveryService ─────────────────────────────────────

describe('DistributedDeploymentRecoveryService', () => {
  let nodeRepo: ClusterNodeRepository
  let deploymentRepo: RuntimeDeploymentRepository
  let allocationRepo: RuntimeAllocationRepository
  let audit: ClusterAuditRepository
  let bus: ClusterRuntimeEventBus
  let svc: DistributedDeploymentRecoveryService

  beforeEach(() => {
    nodeRepo       = { cleanupStale:    vi.fn().mockResolvedValue(5) } as unknown as ClusterNodeRepository
    deploymentRepo = { cleanupStale:    vi.fn().mockResolvedValue(3) } as unknown as RuntimeDeploymentRepository
    allocationRepo = { cleanupReleased: vi.fn().mockResolvedValue(8) } as unknown as RuntimeAllocationRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new DistributedDeploymentRecoveryService(nodeRepo, deploymentRepo, allocationRepo, audit, bus)
  })

  it('cleanupStale returns aggregated counts', async () => {
    const result = await svc.cleanupStale(60000)
    expect(result.nodes).toBe(5)
    expect(result.deployments).toBe(3)
    expect(result.allocations).toBe(8)
  })

  it('cleanupStale emits cleanup completed event', async () => {
    await svc.cleanupStale(300000)
    expect(vi.mocked(bus.emit)).toHaveBeenCalledWith('atc:cluster:cleanup:completed', expect.any(Object))
  })
})
