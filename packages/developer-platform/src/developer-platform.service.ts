import type {
  DeveloperPlatformRepository,
  AtcDeveloperPlatform,
  CreateDeveloperPlatformParams,
} from './developer-platform.repository.js'
import type { DeveloperAuditRepository } from './developer-audit.repository.js'

export interface DeveloperPlatformEventBus {
  emit(event: string, data: Record<string, unknown>): Promise<void>
}

export class DeveloperPlatformService {
  constructor(
    private readonly repo: DeveloperPlatformRepository,
    private readonly audit: DeveloperAuditRepository,
    private readonly bus: DeveloperPlatformEventBus
  ) {}

  async createPlatform(params: CreateDeveloperPlatformParams): Promise<AtcDeveloperPlatform> {
    const record = await this.repo.create(params)
    await this.audit.append(record.id, 'developer_platform.created', { platformId: record.platformId })
    this.bus.emit('developer_platform.created', { platformId: record.platformId }).catch(() => undefined)
    return record
  }

  async activatePlatform(id: string): Promise<AtcDeveloperPlatform> {
    const record = await this.repo.updateStatus(id, 'active', new Date())
    await this.audit.append(record.id, 'developer_platform.activated', { platformId: record.platformId })
    this.bus.emit('developer_platform.activated', { platformId: record.platformId }).catch(() => undefined)
    return record
  }

  async deprecatePlatform(id: string): Promise<AtcDeveloperPlatform> {
    const record = await this.repo.updateStatus(id, 'deprecated')
    await this.audit.append(record.id, 'developer_platform.deprecated', { platformId: record.platformId })
    this.bus.emit('developer_platform.deprecated', { platformId: record.platformId }).catch(() => undefined)
    return record
  }

  async getPlatform(id: string): Promise<AtcDeveloperPlatform | null> {
    return this.repo.findById(id)
  }
}
