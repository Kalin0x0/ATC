import type { MetaRuntimeRepository, AtcMetaRuntime, AtcMetaType, AtcMetaStatus } from './meta-runtime.repository.js'
import type { MetaAuditRepository } from './meta-audit.repository.js'
import type { MetaRuntimeEventBus } from './self-healing-recovery.service.js'

export interface RegisterMetaParams {
  metaType: AtcMetaType
  ownerServerId: string
  metaNonce: string
  metaData?: Record<string, unknown> | undefined
}

export class MetaRuntimeService {
  constructor(
    private readonly metaRepo: MetaRuntimeRepository,
    private readonly auditRepo: MetaAuditRepository,
    private readonly eventBus: MetaRuntimeEventBus,
  ) {}

  async registerMeta(params: RegisterMetaParams): Promise<AtcMetaRuntime> {
    const meta = await this.metaRepo.create(params)
    await this.auditRepo.append({
      eventType: 'meta_registered',
      metaId: meta.metaId,
      ownerServerId: meta.ownerServerId,
      auditData: { metaType: meta.metaType, status: meta.status },
    })
    this.eventBus.emit('atc:meta:registered', { id: meta.id, metaId: meta.metaId, metaType: meta.metaType }).catch(() => undefined)
    return meta
  }

  async pauseMeta(id: string): Promise<AtcMetaRuntime> {
    const meta = await this.metaRepo.updateStatus(id, 'paused' as AtcMetaStatus)
    this.eventBus.emit('atc:meta:paused', { id: meta.id, metaId: meta.metaId }).catch(() => undefined)
    return meta
  }

  async terminateMeta(id: string): Promise<AtcMetaRuntime> {
    const meta = await this.metaRepo.updateStatus(id, 'terminated' as AtcMetaStatus)
    this.eventBus.emit('atc:meta:terminated', { id: meta.id, metaId: meta.metaId }).catch(() => undefined)
    return meta
  }

  async getMeta(id: string): Promise<AtcMetaRuntime | null> {
    return this.metaRepo.findById(id)
  }

  async listActiveMeta(ownerServerId?: string | undefined): Promise<AtcMetaRuntime[]> {
    return this.metaRepo.listActive(ownerServerId)
  }
}
