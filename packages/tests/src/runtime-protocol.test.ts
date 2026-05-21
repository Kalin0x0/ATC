import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  RuntimeProtocolService,
  FederationContractService,
  DistributedContractRegistry,
  RuntimeHandshakeService,
  InterSystemBridgeService,
  ProtocolRecoveryService,
} from '@atc/runtime-protocol'
import type {
  RuntimeProtocolRepository,
  FederationContractRepository,
  ProtocolRegistryRepository,
  RuntimeHandshakeRepository,
  ProtocolBridgeRepository,
  ProtocolAuditRepository,
  RuntimeProtocolEventBus,
} from '@atc/runtime-protocol'

const ULID        = '01JABCDEFGHJKMNPQRST'
const PROTOCOL_ID = 'PROTO_001'
const CONTRACT_ID = 'CONTRACT_001'
const NODE_ID     = 'NODE_001'
const HANDSHAKE_ID = 'SHAKE_001'
const BRIDGE_ID   = 'BRIDGE_001'

function mockAudit(): ProtocolAuditRepository {
  return { append: vi.fn().mockResolvedValue(undefined) } as unknown as ProtocolAuditRepository
}

function mockBus(): RuntimeProtocolEventBus {
  return { emit: vi.fn().mockResolvedValue(undefined) }
}

// ── RuntimeProtocolService ───────────────────────────────────────────────────

describe('RuntimeProtocolService', () => {
  let protocolRepo: RuntimeProtocolRepository
  let audit: ProtocolAuditRepository
  let bus: RuntimeProtocolEventBus
  let svc: RuntimeProtocolService

  beforeEach(() => {
    const protocol = {
      id: ULID, protocolId: PROTOCOL_ID, protocolType: 'federation' as const,
      status: 'active' as const, ownerServerId: 'server-1',
      protocolNonce: 'nonce-1', protocolData: {},
      createdAt: new Date(), updatedAt: new Date(),
    }
    protocolRepo = {
      create:       vi.fn().mockResolvedValue(protocol),
      findById:     vi.fn().mockResolvedValue(protocol),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string) =>
        Promise.resolve({ ...protocol, status })
      ),
      listActive:   vi.fn().mockResolvedValue([protocol]),
      cleanupStale: vi.fn().mockResolvedValue(1),
    } as unknown as RuntimeProtocolRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new RuntimeProtocolService(protocolRepo, audit, bus)
  })

  it('registerProtocol creates an active protocol', async () => {
    const result = await svc.registerProtocol({
      protocolType: 'federation', ownerServerId: 'server-1', protocolNonce: 'nonce-1',
    })
    expect(result.protocolId).toBe(PROTOCOL_ID)
    expect(result.status).toBe('active')
    expect(protocolRepo.create).toHaveBeenCalledOnce()
  })

  it('pauseProtocol transitions to paused', async () => {
    const result = await svc.pauseProtocol(ULID)
    expect(result.status).toBe('paused')
  })

  it('terminateProtocol transitions to terminated', async () => {
    const result = await svc.terminateProtocol(ULID)
    expect(result.status).toBe('terminated')
  })

  it('getProtocol returns protocol or null', async () => {
    const result = await svc.getProtocol(ULID)
    expect(result?.protocolId).toBe(PROTOCOL_ID)
  })

  it('listActiveProtocols returns array', async () => {
    const result = await svc.listActiveProtocols()
    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(1)
  })
})

// ── FederationContractService ────────────────────────────────────────────────

describe('FederationContractService', () => {
  let contractRepo: FederationContractRepository
  let audit: ProtocolAuditRepository
  let bus: RuntimeProtocolEventBus
  let svc: FederationContractService

  beforeEach(() => {
    const contract = {
      id: ULID, contractId: CONTRACT_ID, contractType: 'peer' as const,
      status: 'pending' as const, ownerServerId: 'server-1', targetServerId: 'server-2',
      contractNonce: 'nonce-1', contractData: {}, expiresAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    }
    contractRepo = {
      create:       vi.fn().mockResolvedValue(contract),
      findById:     vi.fn().mockResolvedValue(contract),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string) =>
        Promise.resolve({ ...contract, status })
      ),
      cleanupStale: vi.fn().mockResolvedValue(0),
    } as unknown as FederationContractRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new FederationContractService(contractRepo, audit, bus)
  })

  it('registerContract creates a pending contract', async () => {
    const result = await svc.registerContract({
      contractType: 'peer', ownerServerId: 'server-1',
      targetServerId: 'server-2', contractNonce: 'nonce-1',
    })
    expect(result.contractId).toBe(CONTRACT_ID)
    expect(result.status).toBe('pending')
    expect(contractRepo.create).toHaveBeenCalledOnce()
  })

  it('activateContract transitions to active', async () => {
    const result = await svc.activateContract(ULID)
    expect(result.status).toBe('active')
  })

  it('revokeContract transitions to revoked', async () => {
    const result = await svc.revokeContract(ULID)
    expect(result.status).toBe('revoked')
  })

  it('getContract returns contract or null', async () => {
    const result = await svc.getContract(ULID)
    expect(result?.contractId).toBe(CONTRACT_ID)
  })
})

// ── DistributedContractRegistry ──────────────────────────────────────────────

describe('DistributedContractRegistry', () => {
  let registryRepo: ProtocolRegistryRepository
  let audit: ProtocolAuditRepository
  let bus: RuntimeProtocolEventBus
  let svc: DistributedContractRegistry

  beforeEach(() => {
    const entry = {
      id: ULID, nodeId: NODE_ID, entryType: 'service' as const,
      status: 'registered' as const, ownerServerId: 'server-1',
      endpointData: {}, registeredAt: new Date(),
      createdAt: new Date(), updatedAt: new Date(),
    }
    registryRepo = {
      upsert:       vi.fn().mockResolvedValue(entry),
      findByNodeId: vi.fn().mockResolvedValue(entry),
      updateStatus: vi.fn().mockResolvedValue({ ...entry, status: 'deregistered' }),
      cleanupStale: vi.fn().mockResolvedValue(0),
    } as unknown as ProtocolRegistryRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new DistributedContractRegistry(registryRepo, audit, bus)
  })

  it('upsertRegistry upserts registry entry', async () => {
    const result = await svc.upsertRegistry({
      nodeId: NODE_ID, entryType: 'service', ownerServerId: 'server-1',
    })
    expect(result.nodeId).toBe(NODE_ID)
    expect(registryRepo.upsert).toHaveBeenCalledOnce()
  })

  it('deregisterNode calls updateStatus on repo', async () => {
    await svc.deregisterNode(NODE_ID)
    expect(registryRepo.updateStatus).toHaveBeenCalledWith(NODE_ID, 'deregistered')
  })

  it('getRegistryEntry returns entry or null', async () => {
    const result = await svc.getRegistryEntry(NODE_ID)
    expect(result?.nodeId).toBe(NODE_ID)
  })
})

// ── RuntimeHandshakeService ──────────────────────────────────────────────────

describe('RuntimeHandshakeService', () => {
  let handshakeRepo: RuntimeHandshakeRepository
  let audit: ProtocolAuditRepository
  let bus: RuntimeProtocolEventBus
  let svc: RuntimeHandshakeService

  beforeEach(() => {
    const handshake = {
      id: ULID, handshakeId: HANDSHAKE_ID, handshakeType: 'initiate' as const,
      status: 'pending' as const, ownerServerId: 'server-1', remoteServerId: 'server-2',
      handshakeNonce: 'nonce-1', handshakeData: {}, completedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    }
    handshakeRepo = {
      create:       vi.fn().mockResolvedValue(handshake),
      findById:     vi.fn().mockResolvedValue(handshake),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, completedAt?: Date) =>
        Promise.resolve({ ...handshake, status, completedAt: completedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(0),
    } as unknown as RuntimeHandshakeRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new RuntimeHandshakeService(handshakeRepo, audit, bus)
  })

  it('initiateHandshake creates a pending handshake', async () => {
    const result = await svc.initiateHandshake({
      handshakeType: 'initiate', ownerServerId: 'server-1',
      remoteServerId: 'server-2', handshakeNonce: 'nonce-1',
    })
    expect(result.handshakeId).toBe(HANDSHAKE_ID)
    expect(result.status).toBe('pending')
  })

  it('acknowledgeHandshake transitions to acknowledged', async () => {
    const result = await svc.acknowledgeHandshake(ULID)
    expect(result.status).toBe('acknowledged')
  })

  it('completeHandshake transitions to completed', async () => {
    const result = await svc.completeHandshake(ULID)
    expect(result.status).toBe('completed')
  })

  it('rejectHandshake transitions to rejected', async () => {
    const result = await svc.rejectHandshake(ULID)
    expect(result.status).toBe('rejected')
  })

  it('getHandshake returns handshake or null', async () => {
    const result = await svc.getHandshake(ULID)
    expect(result?.handshakeId).toBe(HANDSHAKE_ID)
  })
})

// ── InterSystemBridgeService ─────────────────────────────────────────────────

describe('InterSystemBridgeService', () => {
  let bridgeRepo: ProtocolBridgeRepository
  let audit: ProtocolAuditRepository
  let bus: RuntimeProtocolEventBus
  let svc: InterSystemBridgeService

  beforeEach(() => {
    const bridge = {
      id: ULID, bridgeId: BRIDGE_ID, bridgeType: 'http' as const,
      status: 'active' as const, ownerServerId: 'server-1', remoteServerId: 'server-2',
      bridgeData: {}, heartbeatAt: new Date(),
      createdAt: new Date(), updatedAt: new Date(),
    }
    bridgeRepo = {
      upsert:          vi.fn().mockResolvedValue(bridge),
      findByBridgeId:  vi.fn().mockResolvedValue(bridge),
      failBridge:      vi.fn().mockResolvedValue({ ...bridge, status: 'failed' }),
      cleanupStale:    vi.fn().mockResolvedValue(0),
    } as unknown as ProtocolBridgeRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new InterSystemBridgeService(bridgeRepo, audit, bus)
  })

  it('upsertBridge upserts bridge record', async () => {
    const result = await svc.upsertBridge({
      bridgeId: BRIDGE_ID, bridgeType: 'http', ownerServerId: 'server-1', remoteServerId: 'server-2',
    })
    expect(result.bridgeId).toBe(BRIDGE_ID)
    expect(bridgeRepo.upsert).toHaveBeenCalledOnce()
  })

  it('failBridge returns the failed bridge', async () => {
    const result = await svc.failBridge(BRIDGE_ID)
    expect(bridgeRepo.failBridge).toHaveBeenCalledWith(BRIDGE_ID)
    expect(result.status).toBe('failed')
  })

  it('getBridge returns bridge or null', async () => {
    const result = await svc.getBridge(BRIDGE_ID)
    expect(result?.bridgeId).toBe(BRIDGE_ID)
  })
})

// ── ProtocolRecoveryService ──────────────────────────────────────────────────

describe('ProtocolRecoveryService', () => {
  let protocolRepo: RuntimeProtocolRepository
  let contractRepo: FederationContractRepository
  let handshakeRepo: RuntimeHandshakeRepository
  let bridgeRepo: ProtocolBridgeRepository
  let audit: ProtocolAuditRepository
  let bus: RuntimeProtocolEventBus
  let svc: ProtocolRecoveryService

  beforeEach(() => {
    protocolRepo = {
      create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn(),
      listActive: vi.fn(), cleanupStale: vi.fn().mockResolvedValue(5),
    } as unknown as RuntimeProtocolRepository
    contractRepo = {
      create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(4),
    } as unknown as FederationContractRepository
    handshakeRepo = {
      create: vi.fn(), findById: vi.fn(), updateStatus: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(3),
    } as unknown as RuntimeHandshakeRepository
    bridgeRepo = {
      upsert: vi.fn(), findById: vi.fn(), failBridge: vi.fn(),
      cleanupStale: vi.fn().mockResolvedValue(2),
    } as unknown as ProtocolBridgeRepository
    audit = mockAudit()
    bus   = mockBus()
    svc   = new ProtocolRecoveryService(protocolRepo, contractRepo, handshakeRepo, bridgeRepo, audit, bus)
  })

  it('cleanupStale returns counts for protocols, contracts, handshakes, bridges', async () => {
    const result = await svc.cleanupStale(300000)
    expect(result.protocols).toBe(5)
    expect(result.contracts).toBe(4)
    expect(result.handshakes).toBe(3)
    expect(result.bridges).toBe(2)
  })
})
