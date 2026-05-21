import type {
  ResourceRegenerationRepository,
  AtcResourceRegeneration,
  AtcResourceRegenerationType,
} from './resource-regeneration.repository.js'
import type { EcologyAuditRepository } from './ecology-audit.repository.js'
import type { EcologyRuntimeEventBus } from './ecology-recovery.service.js'
import { generateId } from './id.js'

export interface CreateRegenerationServiceParams {
  resourceType: AtcResourceRegenerationType
  ownerServerId: string
  regionId?: string | null | undefined
  regenerationNonce: string
  regenerationData?: Record<string, unknown> | undefined
}

export class ResourceRegenerationService {
  constructor(
    private readonly regenerationRepo: ResourceRegenerationRepository,
    private readonly auditRepo: EcologyAuditRepository,
    private readonly eventBus: EcologyRuntimeEventBus,
  ) {}

  async startRegeneration(params: CreateRegenerationServiceParams): Promise<AtcResourceRegeneration> {
    const regenerationId = generateId()
    const regeneration = await this.regenerationRepo.create({
      regenerationId,
      status: 'pending',
      resourceType: params.resourceType,
      ownerServerId: params.ownerServerId,
      regenerationNonce: params.regenerationNonce,
      ...(params.regionId !== undefined ? { regionId: params.regionId } : {}),
      ...(params.regenerationData !== undefined ? { regenerationData: params.regenerationData } : {}),
    })

    await this.auditRepo.append({
      eventType: 'regeneration_started',
      ecologyId: regenerationId,
      regionId: regeneration.regionId ?? undefined,
      ownerServerId: regeneration.ownerServerId,
      auditData: { resourceType: regeneration.resourceType, status: regeneration.status },
    })

    this.eventBus.emit('atc:ecology:regeneration:started', {
      id: regeneration.id,
      regenerationId: regeneration.regenerationId,
      resourceType: regeneration.resourceType,
      status: regeneration.status,
      ownerServerId: regeneration.ownerServerId,
    }).catch(() => undefined)

    return regeneration
  }

  async completeRegeneration(id: string): Promise<AtcResourceRegeneration> {
    const regeneration = await this.regenerationRepo.updateStatus(id, 'completed', new Date())

    this.eventBus.emit('atc:ecology:regeneration:completed', {
      id: regeneration.id,
      regenerationId: regeneration.regenerationId,
      resourceType: regeneration.resourceType,
      status: regeneration.status,
      ownerServerId: regeneration.ownerServerId,
    }).catch(() => undefined)

    return regeneration
  }

  async failRegeneration(id: string): Promise<AtcResourceRegeneration> {
    return this.regenerationRepo.updateStatus(id, 'failed')
  }

  async getRegeneration(id: string): Promise<AtcResourceRegeneration | null> {
    return this.regenerationRepo.findById(id)
  }
}
