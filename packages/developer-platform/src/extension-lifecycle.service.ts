import type {
  ExtensionRuntimeRepository,
  AtcExtensionRuntime,
  CreateExtensionParams,
} from './extension-runtime.repository.js'
import type { DeveloperAuditRepository } from './developer-audit.repository.js'
import type { DeveloperPlatformEventBus } from './developer-platform.service.js'

export class ExtensionLifecycleService {
  constructor(
    private readonly repo: ExtensionRuntimeRepository,
    private readonly audit: DeveloperAuditRepository,
    private readonly bus: DeveloperPlatformEventBus
  ) {}

  async createExtension(params: CreateExtensionParams): Promise<AtcExtensionRuntime> {
    const record = await this.repo.create(params)
    await this.audit.append(record.id, 'extension.created', { extensionId: record.extensionId })
    this.bus.emit('extension.created', { extensionId: record.extensionId }).catch(() => undefined)
    return record
  }

  async activateExtension(id: string): Promise<AtcExtensionRuntime> {
    const record = await this.repo.updateStatus(id, 'active', new Date())
    await this.audit.append(record.id, 'extension_activated', { extensionId: record.extensionId })
    this.bus.emit('extension_activated', { extensionId: record.extensionId }).catch(() => undefined)
    return record
  }

  async suspendExtension(id: string): Promise<AtcExtensionRuntime> {
    const record = await this.repo.updateStatus(id, 'suspended')
    this.bus.emit('extension.suspended', { extensionId: record.extensionId }).catch(() => undefined)
    return record
  }

  async deactivateExtension(id: string): Promise<AtcExtensionRuntime> {
    const record = await this.repo.updateStatus(id, 'deactivated')
    this.bus.emit('extension.deactivated', { extensionId: record.extensionId }).catch(() => undefined)
    return record
  }

  async getExtension(id: string): Promise<AtcExtensionRuntime | null> {
    return this.repo.findById(id)
  }
}
