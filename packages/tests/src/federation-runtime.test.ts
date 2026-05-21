import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  FederationRuntimeService,
  MultiRegionSyncService,
  InterclusterRoutingService,
  FederationOwnershipService,
  RegionalConsistencyService,
  FederationRecoveryService,
} from '@atc/federation-runtime'
import type {
  FederationNodeRepository,
  RegionRuntimeRepository,
  InterclusterRouteRepository,
  FederationOwnershipRepository,
  RegionalConsistencyRepository,
  FederationAuditRepository,
  FederationRuntimeEventBus,
} from '@atc/federation-runtime'

const ULID       = '01JABCDEFGHJKMNPQRST'
const NODE_ID    = 'NODE_001'
const REGION_ID  = 'REGION_001'
const ROUTE_ID   = 'ROUTE_001'
const ENTITY_ID  = 'ENTITY_001'
const CHECK_ID   = 'CHECK_001'
const CLUSTER_ID = 'CLUSTER_001'

function mockAudit(): FederationAuditRepository {
  return { append: vi.fn().mockResolvedValue(undefined) } as unknown as FederationAuditRepository
}

function mockBus(): FederationRuntimeEventBus {
  return { emit: vi.fn().mockResolvedValue(undefined) }
}

// ── FederationRuntimeService ─────────────────────────────────────────────────

describe('FederationRuntimeService', () => {
  let nodeRepo: FederationNodeRepository
  let audit: FederationAuditRepository
  let bus: FederationRuntimeEventBus
  let svc: FederationRuntimeService

  beforeEach(() => {
    const node = {
      id: ULID, nodeId: NODE_ID, nodeType: 'game_server' as const,
      status: 'active' as const, ownerServerId: 'server-1',
      nodeNonce: 'nonce-1', regionId: REGION_ID, address: '127.0.0.1:30120',
      createdAt: new Date(), updatedAt: new Date(), nodeData: '{}',
    }
    nodeRepo = {
      register:     vi.fn().mockResolvedValue(node),
      findById:     vi.fn().mockResolvedValue(node),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, _d?: Date) =>
        Promise.resolve({ ...node, status })
      ),
      listActive:   vi.fn().mockResolvedValue([node]),
      cleanupStale: vi.fn().mockResolvedValue(1),
    } as unknown as FederationNodeRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new FederationRuntimeService(nodeRepo, audit, bus)
  })

  it('registerNode returns a node', async () => {
    const result = await svc.registerNode({
      nodeType: 'game_server', ownerServerId: 'server-1', nodeNonce: 'nonce-1',
      regionId: REGION_ID, address: '127.0.0.1:30120',
    })
    expect(result.nodeId).toBe(NODE_ID)
    expect(nodeRepo.register).toHaveBeenCalledOnce()
  })

  it('deregisterNode updates status to offline', async () => {
    const result = await svc.deregisterNode(ULID)
    expect(result.status).toBe('offline')
    expect(nodeRepo.updateStatus).toHaveBeenCalledWith(ULID, 'offline', expect.any(Date))
  })

  it('getNode returns node by id', async () => {
    const result = await svc.getNode(ULID)
    expect(result).not.toBeNull()
    expect(result?.nodeId).toBe(NODE_ID)
  })

  it('listActiveNodes returns array', async () => {
    const result = await svc.listActiveNodes()
    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(1)
  })
})

// ── MultiRegionSyncService ───────────────────────────────────────────────────

describe('MultiRegionSyncService', () => {
  let regionRepo: RegionRuntimeRepository
  let audit: FederationAuditRepository
  let bus: FederationRuntimeEventBus
  let svc: MultiRegionSyncService

  beforeEach(() => {
    const region = {
      id: ULID, regionId: REGION_ID, ownerServerId: 'server-1',
      syncNonce: 'nonce-1', status: 'active' as const,
      createdAt: new Date(), updatedAt: new Date(), regionData: '{}',
    }
    regionRepo = {
      upsert:       vi.fn().mockResolvedValue(region),
      findByRegion: vi.fn().mockResolvedValue(region),
      deactivate:   vi.fn().mockResolvedValue(undefined),
      cleanupStale: vi.fn().mockResolvedValue(0),
    } as unknown as RegionRuntimeRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new MultiRegionSyncService(regionRepo, bus)
  })

  it('syncRegion upserts region state', async () => {
    const result = await svc.syncRegion({
      regionId: REGION_ID, ownerServerId: 'server-1', syncNonce: 'nonce-1',
    })
    expect(result.regionId).toBe(REGION_ID)
    expect(regionRepo.upsert).toHaveBeenCalledOnce()
  })

  it('getRegionState returns region or null', async () => {
    const result = await svc.getRegionState(REGION_ID)
    expect(result).not.toBeNull()
    expect(result?.regionId).toBe(REGION_ID)
  })

  it('deactivateRegion calls deactivate', async () => {
    await svc.deactivateRegion(REGION_ID)
    expect(regionRepo.deactivate).toHaveBeenCalledWith(REGION_ID)
  })
})

// ── InterclusterRoutingService ───────────────────────────────────────────────

describe('InterclusterRoutingService', () => {
  let routeRepo: InterclusterRouteRepository
  let audit: FederationAuditRepository
  let bus: FederationRuntimeEventBus
  let svc: InterclusterRoutingService

  beforeEach(() => {
    const route = {
      id: ULID, routeId: ROUTE_ID, sourceCluster: CLUSTER_ID, targetCluster: 'CLUSTER_002',
      routeType: 'direct' as const, status: 'active' as const, ownerServerId: 'server-1',
      routeNonce: 'nonce-1', createdAt: new Date(), updatedAt: new Date(), routeData: {},
    }
    routeRepo = {
      create:       vi.fn().mockResolvedValue(route),
      findById:     vi.fn().mockResolvedValue(route),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string) =>
        Promise.resolve({ ...route, status })
      ),
      cleanupStale: vi.fn().mockResolvedValue(0),
    } as unknown as InterclusterRouteRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new InterclusterRoutingService(routeRepo, audit, bus)
  })

  it('createRoute creates an active route', async () => {
    const result = await svc.createRoute({
      sourceCluster: CLUSTER_ID, targetCluster: 'CLUSTER_002',
      routeType: 'direct', ownerServerId: 'server-1', routeNonce: 'nonce-1',
    })
    expect(result.routeId).toBe(ROUTE_ID)
    expect(result.status).toBe('active')
  })

  it('completeRoute transitions status to inactive', async () => {
    const result = await svc.completeRoute(ULID)
    expect(result.status).toBe('inactive')
  })

  it('failRoute transitions status to failed', async () => {
    const result = await svc.failRoute(ULID)
    expect(result.status).toBe('failed')
  })

  it('getRoute returns route or null', async () => {
    const result = await svc.getRoute(ULID)
    expect(result?.routeId).toBe(ROUTE_ID)
  })
})

// ── FederationOwnershipService ───────────────────────────────────────────────

describe('FederationOwnershipService', () => {
  let ownershipRepo: FederationOwnershipRepository
  let audit: FederationAuditRepository
  let bus: FederationRuntimeEventBus
  let svc: FederationOwnershipService

  beforeEach(() => {
    const ownership = {
      id: ULID, entityId: ENTITY_ID, clusterId: CLUSTER_ID,
      ownerServerId: 'server-1', claimNonce: 'nonce-1', status: 'active' as const,
      createdAt: new Date(), updatedAt: new Date(), ownershipData: '{}',
    }
    ownershipRepo = {
      upsert:        vi.fn().mockResolvedValue(ownership),
      findByEntity:  vi.fn().mockResolvedValue(ownership),
      transfer:      vi.fn().mockImplementation((_entityId: string, newClusterId: string) =>
        Promise.resolve({ ...ownership, clusterId: newClusterId })
      ),
      release:       vi.fn().mockResolvedValue(undefined),
      cleanupReleased: vi.fn().mockResolvedValue(0),
    } as unknown as FederationOwnershipRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new FederationOwnershipService(ownershipRepo, audit, bus)
  })

  it('claimOwnership upserts ownership', async () => {
    const result = await svc.claimOwnership({
      entityId: ENTITY_ID, clusterId: CLUSTER_ID,
      ownerServerId: 'server-1', claimNonce: 'nonce-1',
    })
    expect(result.entityId).toBe(ENTITY_ID)
    expect(ownershipRepo.upsert).toHaveBeenCalledOnce()
  })

  it('transferOwnership updates clusterId', async () => {
    const result = await svc.transferOwnership(ENTITY_ID, 'CLUSTER_NEW')
    expect(result.clusterId).toBe('CLUSTER_NEW')
  })

  it('releaseOwnership calls release', async () => {
    await svc.releaseOwnership(ENTITY_ID)
    expect(ownershipRepo.release).toHaveBeenCalledWith(ENTITY_ID)
  })

  it('getOwnership returns ownership or null', async () => {
    const result = await svc.getOwnership(ENTITY_ID)
    expect(result?.entityId).toBe(ENTITY_ID)
  })
})

// ── RegionalConsistencyService ───────────────────────────────────────────────

describe('RegionalConsistencyService', () => {
  let checkRepo: RegionalConsistencyRepository
  let audit: FederationAuditRepository
  let bus: FederationRuntimeEventBus
  let svc: RegionalConsistencyService

  beforeEach(() => {
    const check = {
      id: ULID, checkId: CHECK_ID, checkType: 'full' as const,
      status: 'running' as const, ownerServerId: 'server-1',
      regionId: REGION_ID, checkNonce: 'nonce-1',
      completedAt: null, createdAt: new Date(), updatedAt: new Date(), checkData: '{}',
    }
    checkRepo = {
      create:       vi.fn().mockResolvedValue(check),
      findById:     vi.fn().mockResolvedValue(check),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, completedAt?: Date) =>
        Promise.resolve({ ...check, status, completedAt: completedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(0),
    } as unknown as RegionalConsistencyRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new RegionalConsistencyService(checkRepo, audit, bus)
  })

  it('startCheck creates a running check', async () => {
    const result = await svc.startCheck({
      checkType: 'full', regionId: REGION_ID,
      ownerServerId: 'server-1', checkNonce: 'nonce-1',
    })
    expect(result.checkId).toBe(CHECK_ID)
    expect(result.status).toBe('running')
  })

  it('completeCheck transitions to passed', async () => {
    const result = await svc.completeCheck(ULID)
    expect(result.status).toBe('passed')
  })

  it('failCheck transitions to failed', async () => {
    const result = await svc.failCheck(ULID)
    expect(result.status).toBe('failed')
  })

  it('getCheck returns check or null', async () => {
    const result = await svc.getCheck(ULID)
    expect(result?.checkId).toBe(CHECK_ID)
  })
})

// ── FederationRecoveryService ────────────────────────────────────────────────

describe('FederationRecoveryService', () => {
  let nodeRepo: FederationNodeRepository
  let routeRepo: InterclusterRouteRepository
  let checkRepo: RegionalConsistencyRepository
  let audit: FederationAuditRepository
  let bus: FederationRuntimeEventBus
  let svc: FederationRecoveryService

  beforeEach(() => {
    nodeRepo = {
      register:     vi.fn(),
      findById:     vi.fn(),
      updateStatus: vi.fn(),
      listActive:   vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(3),
    } as unknown as FederationNodeRepository
    routeRepo = {
      create:       vi.fn(),
      findById:     vi.fn(),
      updateStatus: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(2),
    } as unknown as InterclusterRouteRepository
    checkRepo = {
      create:       vi.fn(),
      findById:     vi.fn(),
      updateStatus: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(1),
    } as unknown as RegionalConsistencyRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new FederationRecoveryService(nodeRepo, routeRepo, checkRepo, audit, bus)
  })

  it('cleanupStale returns counts for nodes, routes, checks', async () => {
    const result = await svc.cleanupStale(300000)
    expect(result.nodes).toBe(3)
    expect(result.routes).toBe(2)
    expect(result.checks).toBe(1)
  })
})
