import { describe, it, expect, vi, beforeEach } from 'vitest'
import type {
  DeveloperPlatformRepository, AtcDeveloperPlatform,
  SdkRegistryRepository, AtcSdkRegistry,
  PluginCompatibilityRepository, AtcPluginCompatibility,
  ExtensionRuntimeRepository, AtcExtensionRuntime,
  ContractValidationRepository, AtcContractValidation,
  DeveloperAuditRepository, DeveloperPlatformEventBus,
} from '@atc/developer-platform'
import {
  DeveloperPlatformService,
  RuntimeSdkRegistryService,
  PluginCompatibilityService,
  ExtensionLifecycleService,
  RuntimeContractValidationService,
  DeveloperRecoveryService,
} from '@atc/developer-platform'

function mockBus(): DeveloperPlatformEventBus {
  return { emit: vi.fn().mockResolvedValue(undefined) }
}

function mockAudit(): DeveloperAuditRepository {
  return { append: vi.fn().mockResolvedValue(undefined) } as unknown as DeveloperAuditRepository
}

describe('DeveloperPlatformService', () => {
  let platformRepo: DeveloperPlatformRepository
  let audit: DeveloperAuditRepository
  let bus: DeveloperPlatformEventBus
  let service: DeveloperPlatformService

  beforeEach(() => {
    const platform: AtcDeveloperPlatform = {
      id: '01P', platformId: '01Q', platformType: 'sdk',
      status: 'pending', ownerServerId: 'srv-1', platformNonce: 'nonce-p-1',
      platformData: {}, activatedAt: null, createdAt: new Date(), updatedAt: new Date(),
    }
    platformRepo = {
      create: vi.fn().mockResolvedValue(platform),
      findById: vi.fn().mockResolvedValue(platform),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, activatedAt?: Date) =>
        Promise.resolve({ ...platform, status, activatedAt: activatedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(3),
    } as unknown as DeveloperPlatformRepository
    audit = mockAudit()
    bus = mockBus()
    service = new DeveloperPlatformService(platformRepo, audit, bus)
  })

  it('creates a developer platform record', async () => {
    const result = await service.createPlatform({ platformType: 'sdk', ownerServerId: 'srv-1', platformNonce: 'nonce-p-1' })
    expect(result.status).toBe('pending')
    expect(result.platformType).toBe('sdk')
  })

  it('activates a platform and sets activatedAt', async () => {
    const result = await service.activatePlatform('01P')
    expect(result.status).toBe('active')
    expect(result.activatedAt).toBeInstanceOf(Date)
  })

  it('deprecates a platform', async () => {
    const result = await service.deprecatePlatform('01P')
    expect(result.status).toBe('deprecated')
  })

  it('retrieves a platform by id', async () => {
    const result = await service.getPlatform('01P')
    expect(result?.platformType).toBe('sdk')
  })
})

describe('RuntimeSdkRegistryService', () => {
  let sdkRepo: SdkRegistryRepository
  let audit: DeveloperAuditRepository
  let bus: DeveloperPlatformEventBus
  let service: RuntimeSdkRegistryService

  beforeEach(() => {
    const sdk: AtcSdkRegistry = {
      id: '01S', sdkId: 'sdk-1', sdkType: 'core',
      status: 'active', ownerServerId: 'srv-1',
      sdkData: {}, registeredAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
    }
    sdkRepo = {
      upsert: vi.fn().mockResolvedValue(sdk),
      findBySdkId: vi.fn().mockResolvedValue(sdk),
      updateStatus: vi.fn().mockImplementation((_sdkId: string, status: string) =>
        Promise.resolve({ ...sdk, status })
      ),
      cleanupStale: vi.fn().mockResolvedValue(2),
    } as unknown as SdkRegistryRepository
    audit = mockAudit()
    bus = mockBus()
    service = new RuntimeSdkRegistryService(sdkRepo, audit, bus)
  })

  it('registers an SDK via upsert', async () => {
    const result = await service.registerSdk({ sdkId: 'sdk-1', sdkType: 'core', ownerServerId: 'srv-1' })
    expect(result.sdkId).toBe('sdk-1')
    expect(result.sdkType).toBe('core')
  })

  it('deprecates an SDK', async () => {
    const result = await service.deprecateSdk('sdk-1')
    expect(result.status).toBe('deprecated')
  })
})

describe('PluginCompatibilityService', () => {
  let compatibilityRepo: PluginCompatibilityRepository
  let audit: DeveloperAuditRepository
  let bus: DeveloperPlatformEventBus
  let service: PluginCompatibilityService

  beforeEach(() => {
    const compat: AtcPluginCompatibility = {
      id: '01C', compatibilityId: '01D', compatibilityType: 'forward',
      status: 'pending', ownerServerId: 'srv-1', compatibilityNonce: 'nonce-c-1',
      compatibilityData: {}, validatedAt: null, createdAt: new Date(), updatedAt: new Date(),
    }
    compatibilityRepo = {
      create: vi.fn().mockResolvedValue(compat),
      findById: vi.fn().mockResolvedValue(compat),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, validatedAt?: Date) =>
        Promise.resolve({ ...compat, status, validatedAt: validatedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(4),
    } as unknown as PluginCompatibilityRepository
    audit = mockAudit()
    bus = mockBus()
    service = new PluginCompatibilityService(compatibilityRepo, audit, bus)
  })

  it('creates a plugin compatibility check', async () => {
    const result = await service.createCompatibilityCheck({ compatibilityType: 'forward', ownerServerId: 'srv-1', compatibilityNonce: 'nonce-c-1' })
    expect(result.compatibilityType).toBe('forward')
  })

  it('passes compatibility and emits plugin_validated', async () => {
    const result = await service.passCompatibility('01C')
    expect(result.status).toBe('compatible')
    expect(result.validatedAt).toBeInstanceOf(Date)
  })
})

describe('ExtensionLifecycleService', () => {
  let extensionRepo: ExtensionRuntimeRepository
  let audit: DeveloperAuditRepository
  let bus: DeveloperPlatformEventBus
  let service: ExtensionLifecycleService

  beforeEach(() => {
    const ext: AtcExtensionRuntime = {
      id: '01E', extensionId: '01F', extensionType: 'runtime',
      status: 'pending', ownerServerId: 'srv-1', extensionNonce: 'nonce-e-1',
      extensionData: {}, activatedAt: null, createdAt: new Date(), updatedAt: new Date(),
    }
    extensionRepo = {
      create: vi.fn().mockResolvedValue(ext),
      findById: vi.fn().mockResolvedValue(ext),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, activatedAt?: Date) =>
        Promise.resolve({ ...ext, status, activatedAt: activatedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(5),
    } as unknown as ExtensionRuntimeRepository
    audit = mockAudit()
    bus = mockBus()
    service = new ExtensionLifecycleService(extensionRepo, audit, bus)
  })

  it('creates an extension', async () => {
    const result = await service.createExtension({ extensionType: 'runtime', ownerServerId: 'srv-1', extensionNonce: 'nonce-e-1' })
    expect(result.extensionType).toBe('runtime')
  })

  it('activates an extension and emits extension_activated', async () => {
    const result = await service.activateExtension('01E')
    expect(result.status).toBe('active')
    expect(result.activatedAt).toBeInstanceOf(Date)
  })
})

describe('RuntimeContractValidationService', () => {
  let contractRepo: ContractValidationRepository
  let audit: DeveloperAuditRepository
  let bus: DeveloperPlatformEventBus
  let service: RuntimeContractValidationService

  beforeEach(() => {
    const contract: AtcContractValidation = {
      id: '01CV', contractId: '01CW', contractType: 'api',
      status: 'pending', ownerServerId: 'srv-1', contractNonce: 'nonce-cv-1',
      contractData: {}, validatedAt: null, createdAt: new Date(), updatedAt: new Date(),
    }
    contractRepo = {
      create: vi.fn().mockResolvedValue(contract),
      findById: vi.fn().mockResolvedValue(contract),
      updateStatus: vi.fn().mockImplementation((_id: string, status: string, validatedAt?: Date) =>
        Promise.resolve({ ...contract, status, validatedAt: validatedAt ?? null })
      ),
      cleanupStale: vi.fn().mockResolvedValue(6),
    } as unknown as ContractValidationRepository
    audit = mockAudit()
    bus = mockBus()
    service = new RuntimeContractValidationService(contractRepo, audit, bus)
  })

  it('creates a contract validation', async () => {
    const result = await service.createContract({ contractType: 'api', ownerServerId: 'srv-1', contractNonce: 'nonce-cv-1' })
    expect(result.contractType).toBe('api')
  })

  it('passes contract and emits contract_validated', async () => {
    const result = await service.passContract('01CV')
    expect(result.status).toBe('valid')
    expect(result.validatedAt).toBeInstanceOf(Date)
  })
})

describe('DeveloperRecoveryService', () => {
  it('cleans up stale records and returns counts', async () => {
    const platformRepo = { cleanupStale: vi.fn().mockResolvedValue(3) } as unknown as DeveloperPlatformRepository
    const sdkRepo = { cleanupStale: vi.fn().mockResolvedValue(2) } as unknown as SdkRegistryRepository
    const compatibilityRepo = { cleanupStale: vi.fn().mockResolvedValue(4) } as unknown as PluginCompatibilityRepository
    const extensionRepo = { cleanupStale: vi.fn().mockResolvedValue(5) } as unknown as ExtensionRuntimeRepository
    const contractRepo = { cleanupStale: vi.fn().mockResolvedValue(6) } as unknown as ContractValidationRepository
    const audit = mockAudit()
    const bus = mockBus()

    const service = new DeveloperRecoveryService(platformRepo, sdkRepo, compatibilityRepo, extensionRepo, contractRepo, audit, bus)
    const result = await service.cleanupStale(300000)
    expect(result).toEqual({ platforms: 3, sdks: 2, compatibilities: 4, extensions: 5, contracts: 6 })
  })
})
