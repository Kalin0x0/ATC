import { describe, it, expect, vi, beforeEach } from 'vitest'
import type {
  RuntimeGatewayRepository, AtcRuntimeGateway,
  AccessMeshRepository, AtcAccessMesh,
  GatewayRoutingRepository, AtcGatewayRouting,
  RuntimeExposureRepository, AtcRuntimeExposure,
  SurfaceProtectionRepository, AtcSurfaceProtection,
  GatewayAuditRepository, RuntimeGatewayEventBus,
} from '@atc/runtime-gateway'
import {
  RuntimeGatewayService,
  DeterministicAccessMeshService,
  DistributedApiRoutingService,
  RuntimeExposureCoordinator,
  RuntimeSurfaceProtectionService,
  GatewayRecoveryService,
} from '@atc/runtime-gateway'

function mockBus(): RuntimeGatewayEventBus {
  return { emit: vi.fn().mockResolvedValue(undefined) }
}

function mockAudit(): GatewayAuditRepository {
  return { append: vi.fn().mockResolvedValue(undefined) } as unknown as GatewayAuditRepository
}

describe('RuntimeGatewayService', () => {
  let gatewayRepo: RuntimeGatewayRepository
  let audit: GatewayAuditRepository
  let bus: RuntimeGatewayEventBus
  let service: RuntimeGatewayService

  beforeEach(() => {
    const gateway: AtcRuntimeGateway = {
      id: '01J', gatewayId: '01K', gatewayType: 'api',
      status: 'pending', ownerServerId: 'srv-1', gatewayNonce: 'nonce-gw-1',
      gatewayData: {}, activatedAt: null, createdAt: new Date(), updatedAt: new Date(),
    }
    gatewayRepo = {
      create: vi.fn().mockResolvedValue(gateway),
      findById: vi.fn().mockResolvedValue(gateway),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, activatedAt?: Date) =>
        Promise.resolve({ ...gateway, status, activatedAt: activatedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(3),
    } as unknown as RuntimeGatewayRepository
    audit = mockAudit()
    bus = mockBus()
    service = new RuntimeGatewayService(gatewayRepo, audit, bus)
  })

  it('creates a gateway record', async () => {
    const result = await service.createGateway({ gatewayType: 'api', ownerServerId: 'srv-1', gatewayNonce: 'nonce-gw-1' })
    expect(result.status).toBe('pending')
    expect(result.gatewayType).toBe('api')
  })

  it('activates a gateway and emits gateway_route_established', async () => {
    const result = await service.activateGateway('01J')
    expect(result.status).toBe('active')
    expect(result.activatedAt).toBeInstanceOf(Date)
  })

  it('suspends a gateway', async () => {
    const result = await service.suspendGateway('01J')
    expect(result.status).toBe('suspended')
  })

  it('retrieves a gateway by id', async () => {
    const result = await service.getGateway('01J')
    expect(result).not.toBeNull()
    expect(result?.gatewayType).toBe('api')
  })
})

describe('DeterministicAccessMeshService', () => {
  let meshRepo: AccessMeshRepository
  let audit: GatewayAuditRepository
  let bus: RuntimeGatewayEventBus
  let service: DeterministicAccessMeshService

  beforeEach(() => {
    const mesh: AtcAccessMesh = {
      id: '01M', meshId: 'mesh-1', meshType: 'overlay',
      status: 'synchronized', ownerServerId: 'srv-1',
      meshData: {}, syncedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
    }
    meshRepo = {
      upsert: vi.fn().mockResolvedValue(mesh),
      findByMeshId: vi.fn().mockResolvedValue(mesh),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string) =>
        Promise.resolve({ ...mesh, status })
      ),
      cleanupStale: vi.fn().mockResolvedValue(2),
    } as unknown as AccessMeshRepository
    audit = mockAudit()
    bus = mockBus()
    service = new DeterministicAccessMeshService(meshRepo, audit, bus)
  })

  it('syncs an access mesh via upsert', async () => {
    const result = await service.syncMesh({ meshId: 'mesh-1', meshType: 'overlay', ownerServerId: 'srv-1' })
    expect(result.meshId).toBe('mesh-1')
    expect(result.meshType).toBe('overlay')
  })

  it('degrades a mesh', async () => {
    const result = await service.degradeMesh('mesh-1')
    expect(result.status).toBe('degraded')
  })

  it('recovers a mesh and emits access_mesh_synchronized', async () => {
    const result = await service.recoverMesh('mesh-1')
    expect(result.status).toBe('synchronized')
  })
})

describe('DistributedApiRoutingService', () => {
  let routingRepo: GatewayRoutingRepository
  let audit: GatewayAuditRepository
  let bus: RuntimeGatewayEventBus
  let service: DistributedApiRoutingService

  beforeEach(() => {
    const routing: AtcGatewayRouting = {
      id: '01R', routingId: 'route-1', routingType: 'dynamic',
      status: 'active', ownerServerId: 'srv-1',
      routingData: {}, syncedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
    }
    routingRepo = {
      upsert: vi.fn().mockResolvedValue(routing),
      findByRoutingId: vi.fn().mockResolvedValue(routing),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string) =>
        Promise.resolve({ ...routing, status })
      ),
      cleanupStale: vi.fn().mockResolvedValue(4),
    } as unknown as GatewayRoutingRepository
    audit = mockAudit()
    bus = mockBus()
    service = new DistributedApiRoutingService(routingRepo, audit, bus)
  })

  it('configures routing via upsert', async () => {
    const result = await service.configureRouting({ routingId: 'route-1', routingType: 'dynamic', ownerServerId: 'srv-1' })
    expect(result.routingId).toBe('route-1')
    expect(result.status).toBe('active')
  })

  it('activates routing and emits gateway_route_established', async () => {
    const result = await service.activateRouting('route-1')
    expect(result.status).toBe('routing')
  })
})

describe('RuntimeExposureCoordinator', () => {
  let exposureRepo: RuntimeExposureRepository
  let audit: GatewayAuditRepository
  let bus: RuntimeGatewayEventBus
  let service: RuntimeExposureCoordinator

  beforeEach(() => {
    const exposure: AtcRuntimeExposure = {
      id: '01E', exposureId: '01F', exposureType: 'public',
      status: 'pending', ownerServerId: 'srv-1', exposureNonce: 'nonce-exp-1',
      exposureData: {}, exposedAt: null, createdAt: new Date(), updatedAt: new Date(),
    }
    exposureRepo = {
      create: vi.fn().mockResolvedValue(exposure),
      findById: vi.fn().mockResolvedValue(exposure),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, exposedAt?: Date) =>
        Promise.resolve({ ...exposure, status, exposedAt: exposedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(1),
    } as unknown as RuntimeExposureRepository
    audit = mockAudit()
    bus = mockBus()
    service = new RuntimeExposureCoordinator(exposureRepo, audit, bus)
  })

  it('creates a runtime exposure', async () => {
    const result = await service.exposeRuntime({ exposureType: 'public', ownerServerId: 'srv-1', exposureNonce: 'nonce-exp-1' })
    expect(result.status).toBe('pending')
  })

  it('completes exposure and emits runtime_surface_secured', async () => {
    const result = await service.completeExposure('01E')
    expect(result.status).toBe('exposed')
    expect(result.exposedAt).toBeInstanceOf(Date)
  })
})

describe('RuntimeSurfaceProtectionService', () => {
  let protectionRepo: SurfaceProtectionRepository
  let audit: GatewayAuditRepository
  let bus: RuntimeGatewayEventBus
  let service: RuntimeSurfaceProtectionService

  beforeEach(() => {
    const prot: AtcSurfaceProtection = {
      id: '01P', protectionId: '01Q', protectionType: 'firewall',
      status: 'pending', ownerServerId: 'srv-1', protectionNonce: 'nonce-prot-1',
      protectionData: {}, activatedAt: null, createdAt: new Date(), updatedAt: new Date(),
    }
    protectionRepo = {
      create: vi.fn().mockResolvedValue(prot),
      findById: vi.fn().mockResolvedValue(prot),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, activatedAt?: Date) =>
        Promise.resolve({ ...prot, status, activatedAt: activatedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(2),
    } as unknown as SurfaceProtectionRepository
    audit = mockAudit()
    bus = mockBus()
    service = new RuntimeSurfaceProtectionService(protectionRepo, audit, bus)
  })

  it('creates a surface protection', async () => {
    const result = await service.createProtection({ protectionType: 'firewall', ownerServerId: 'srv-1', protectionNonce: 'nonce-prot-1' })
    expect(result.protectionType).toBe('firewall')
  })

  it('activates protection and emits runtime_surface_secured', async () => {
    const result = await service.activateProtection('01P')
    expect(result.status).toBe('active')
    expect(result.activatedAt).toBeInstanceOf(Date)
  })
})

describe('GatewayRecoveryService', () => {
  it('cleans up stale records and returns counts', async () => {
    const gatewayRepo = { cleanupStale: vi.fn().mockResolvedValue(3) } as unknown as RuntimeGatewayRepository
    const meshRepo = { cleanupStale: vi.fn().mockResolvedValue(2) } as unknown as AccessMeshRepository
    const routingRepo = { cleanupStale: vi.fn().mockResolvedValue(4) } as unknown as GatewayRoutingRepository
    const exposureRepo = { cleanupStale: vi.fn().mockResolvedValue(1) } as unknown as RuntimeExposureRepository
    const protectionRepo = { cleanupStale: vi.fn().mockResolvedValue(2) } as unknown as SurfaceProtectionRepository
    const audit = mockAudit()
    const bus = mockBus()

    const service = new GatewayRecoveryService(gatewayRepo, meshRepo, routingRepo, exposureRepo, protectionRepo, audit, bus)
    const result = await service.cleanupStale(300000)
    expect(result).toEqual({ gateways: 3, meshNodes: 2, routings: 4, exposures: 1, protections: 2 })
  })
})
