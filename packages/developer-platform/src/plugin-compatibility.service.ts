import type {
  PluginCompatibilityRepository,
  AtcPluginCompatibility,
  CreateCompatibilityParams,
} from './plugin-compatibility.repository.js'
import type { DeveloperAuditRepository } from './developer-audit.repository.js'
import type { DeveloperPlatformEventBus } from './developer-platform.service.js'

export class PluginCompatibilityService {
  constructor(
    private readonly repo: PluginCompatibilityRepository,
    private readonly audit: DeveloperAuditRepository,
    private readonly bus: DeveloperPlatformEventBus
  ) {}

  async createCompatibilityCheck(params: CreateCompatibilityParams): Promise<AtcPluginCompatibility> {
    const record = await this.repo.create(params)
    await this.audit.append(record.id, 'plugin_compatibility.created', { compatibilityId: record.compatibilityId })
    this.bus.emit('plugin_compatibility.created', { compatibilityId: record.compatibilityId }).catch(() => undefined)
    return record
  }

  async beginValidating(id: string): Promise<AtcPluginCompatibility> {
    const record = await this.repo.updateStatus(id, 'validating')
    this.bus.emit('plugin_compatibility.validating', { compatibilityId: record.compatibilityId }).catch(() => undefined)
    return record
  }

  async passCompatibility(id: string): Promise<AtcPluginCompatibility> {
    const record = await this.repo.updateStatus(id, 'compatible', new Date())
    await this.audit.append(record.id, 'plugin_validated', { compatibilityId: record.compatibilityId })
    this.bus.emit('plugin_validated', { compatibilityId: record.compatibilityId }).catch(() => undefined)
    return record
  }

  async failCompatibility(id: string): Promise<AtcPluginCompatibility> {
    const record = await this.repo.updateStatus(id, 'incompatible')
    this.bus.emit('plugin_compatibility.incompatible', { compatibilityId: record.compatibilityId }).catch(() => undefined)
    return record
  }

  async getCompatibility(id: string): Promise<AtcPluginCompatibility | null> {
    return this.repo.findById(id)
  }
}
