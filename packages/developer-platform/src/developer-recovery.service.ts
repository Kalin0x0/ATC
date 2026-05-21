import type { DeveloperPlatformRepository } from './developer-platform.repository.js'
import type { SdkRegistryRepository } from './sdk-registry.repository.js'
import type { PluginCompatibilityRepository } from './plugin-compatibility.repository.js'
import type { ExtensionRuntimeRepository } from './extension-runtime.repository.js'
import type { ContractValidationRepository } from './contract-validation.repository.js'
import type { DeveloperAuditRepository } from './developer-audit.repository.js'
import type { DeveloperPlatformEventBus } from './developer-platform.service.js'

export interface DeveloperCleanupResult {
  platforms: number
  sdks: number
  compatibilities: number
  extensions: number
  contracts: number
}

export class DeveloperRecoveryService {
  constructor(
    private readonly platformRepo: DeveloperPlatformRepository,
    private readonly sdkRepo: SdkRegistryRepository,
    private readonly compatibilityRepo: PluginCompatibilityRepository,
    private readonly extensionRepo: ExtensionRuntimeRepository,
    private readonly contractRepo: ContractValidationRepository,
    private readonly audit: DeveloperAuditRepository,
    private readonly bus: DeveloperPlatformEventBus
  ) {}

  async cleanupStale(thresholdMs: number): Promise<DeveloperCleanupResult> {
    const [platforms, sdks, compatibilities, extensions, contracts] = await Promise.all([
      this.platformRepo.cleanupStale(thresholdMs),
      this.sdkRepo.cleanupStale(thresholdMs),
      this.compatibilityRepo.cleanupStale(thresholdMs),
      this.extensionRepo.cleanupStale(thresholdMs),
      this.contractRepo.cleanupStale(thresholdMs),
    ])
    this.bus.emit('developer.stale_cleaned', { platforms, sdks, compatibilities, extensions, contracts }).catch(() => undefined)
    return { platforms, sdks, compatibilities, extensions, contracts }
  }
}
