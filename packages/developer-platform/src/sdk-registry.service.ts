import type {
  SdkRegistryRepository,
  AtcSdkRegistry,
  RegisterSdkParams,
} from './sdk-registry.repository.js'
import type { DeveloperAuditRepository } from './developer-audit.repository.js'
import type { DeveloperPlatformEventBus } from './developer-platform.service.js'

export class RuntimeSdkRegistryService {
  constructor(
    private readonly repo: SdkRegistryRepository,
    private readonly audit: DeveloperAuditRepository,
    private readonly bus: DeveloperPlatformEventBus
  ) {}

  async registerSdk(params: RegisterSdkParams): Promise<AtcSdkRegistry> {
    const record = await this.repo.upsert(params)
    await this.audit.append(record.id, 'sdk.registered', { sdkId: record.sdkId })
    this.bus.emit('sdk_registered', { sdkId: record.sdkId }).catch(() => undefined)
    return record
  }

  async deprecateSdk(sdkId: string): Promise<AtcSdkRegistry> {
    const record = await this.repo.updateStatus(sdkId, 'deprecated')
    this.bus.emit('sdk.deprecated', { sdkId: record.sdkId }).catch(() => undefined)
    return record
  }

  async retireSdk(sdkId: string): Promise<AtcSdkRegistry> {
    const record = await this.repo.updateStatus(sdkId, 'retired')
    this.bus.emit('sdk.retired', { sdkId: record.sdkId }).catch(() => undefined)
    return record
  }

  async getSdk(sdkId: string): Promise<AtcSdkRegistry | null> {
    return this.repo.findBySdkId(sdkId)
  }
}
