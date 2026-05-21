import type {
  EcologyRuntimeRepository,
  AtcEcologyRuntime,
  AtcEcologyType,
} from './ecology-runtime.repository.js'
import type { EcologyAuditRepository } from './ecology-audit.repository.js'
import type { EcologyRuntimeEventBus } from './ecology-recovery.service.js'
import { generateId } from './id.js'

export interface CreateEcologyServiceParams {
  ecologyType: AtcEcologyType
  ownerServerId: string
  regionId?: string | null | undefined
  ecologyNonce: string
  ecologyData?: Record<string, unknown> | undefined
}

export class EcologyRuntimeService {
  constructor(
    private readonly ecologyRepo: EcologyRuntimeRepository,
    private readonly auditRepo: EcologyAuditRepository,
    private readonly eventBus: EcologyRuntimeEventBus,
  ) {}

  async createEcology(params: CreateEcologyServiceParams): Promise<AtcEcologyRuntime> {
    const ecology = await this.ecologyRepo.create({
      ecologyId: generateId(),
      status: 'stable',
      ecologyType: params.ecologyType,
      ownerServerId: params.ownerServerId,
      ecologyNonce: params.ecologyNonce,
      ...(params.regionId !== undefined ? { regionId: params.regionId } : {}),
      ...(params.ecologyData !== undefined ? { ecologyData: params.ecologyData } : {}),
    })

    await this.auditRepo.append({
      eventType: 'ecology_created',
      ecologyId: ecology.ecologyId,
      regionId: ecology.regionId ?? undefined,
      ownerServerId: ecology.ownerServerId,
      auditData: { ecologyType: ecology.ecologyType, status: ecology.status },
    })

    this.eventBus.emit('atc:ecology:created', {
      id: ecology.id,
      ecologyId: ecology.ecologyId,
      ecologyType: ecology.ecologyType,
      status: ecology.status,
      ownerServerId: ecology.ownerServerId,
    }).catch(() => undefined)

    return ecology
  }

  async degradeEcology(id: string): Promise<AtcEcologyRuntime> {
    const ecology = await this.ecologyRepo.updateStatus(id, 'degrading')

    this.eventBus.emit('atc:ecology:degraded', {
      id: ecology.id,
      ecologyId: ecology.ecologyId,
      status: ecology.status,
      ownerServerId: ecology.ownerServerId,
    }).catch(() => undefined)

    return ecology
  }

  async getEcology(id: string): Promise<AtcEcologyRuntime | null> {
    return this.ecologyRepo.findById(id)
  }

  async listActiveEcologies(ownerServerId?: string): Promise<AtcEcologyRuntime[]> {
    return this.ecologyRepo.listActive(ownerServerId)
  }
}
